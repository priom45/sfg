import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MarkPaidBody {
  orderId?: string;
  counterPaymentMethod?: "cash" | "online" | "split";
  cashReceivedAmount?: number;
  onlineReceivedAmount?: number;
}

type CounterPaymentMethod = "cash" | "online" | "split";

type PaymentOrder = {
  id: string;
  order_id: string;
  total: number | string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_method: string | null;
  counter_payment_method?: CounterPaymentMethod | null;
  cash_received_amount?: number | string | null;
  online_received_amount?: number | string | null;
  paid_amount?: number | string | null;
  supportsCounterPaymentCapture: boolean;
};

type PaymentUpdatePayload = Record<string, string | number | null>;

const BASE_PAYMENT_ORDER_SELECT = "id, order_id, total, payment_status, payment_provider, payment_method";
const COUNTER_PAYMENT_ORDER_SELECT =
  `${BASE_PAYMENT_ORDER_SELECT}, counter_payment_method, cash_received_amount, online_received_amount, paid_amount`;
const COUNTER_PAYMENT_CAPTURE_COLUMNS = [
  "counter_payment_method",
  "cash_received_amount",
  "online_received_amount",
  "paid_amount",
];

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getCounterPaymentMethod(value: unknown) {
  if (value === "online" || value === "cash" || value === "split") {
    return value;
  }
  return null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : String(message);
  }

  return String(error);
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function isCounterPaymentCaptureSchemaError(error: unknown) {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  return (
    code === "42703" ||
    code === "PGRST204" ||
    /column .* does not exist/i.test(message) ||
    /could not find .* column/i.test(message)
  ) && COUNTER_PAYMENT_CAPTURE_COLUMNS.some((column) => message.includes(column));
}

function withCounterPaymentDefaults(
  order: Omit<PaymentOrder, "supportsCounterPaymentCapture">,
  supportsCounterPaymentCapture: boolean,
): PaymentOrder {
  return {
    ...order,
    counter_payment_method: order.counter_payment_method ?? null,
    cash_received_amount: order.cash_received_amount ?? null,
    online_received_amount: order.online_received_amount ?? null,
    paid_amount: order.paid_amount ?? null,
    supportsCounterPaymentCapture,
  };
}

async function fetchPaymentOrder(
  adminClient: ReturnType<typeof createClient>,
  appOrderId: string,
) {
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select(COUNTER_PAYMENT_ORDER_SELECT)
    .eq("order_id", appOrderId)
    .maybeSingle<Omit<PaymentOrder, "supportsCounterPaymentCapture">>();

  if (!orderError && order) {
    return withCounterPaymentDefaults(order, true);
  }

  if (orderError && isCounterPaymentCaptureSchemaError(orderError)) {
    const { data: baseOrder, error: baseOrderError } = await adminClient
      .from("orders")
      .select(BASE_PAYMENT_ORDER_SELECT)
      .eq("order_id", appOrderId)
      .maybeSingle<Omit<PaymentOrder, "supportsCounterPaymentCapture">>();

    if (baseOrderError) {
      throw baseOrderError;
    }

    return baseOrder ? withCounterPaymentDefaults(baseOrder, false) : null;
  }

  if (orderError) {
    throw orderError;
  }

  return null;
}

function getBasePaymentUpdate(paymentUpdate: PaymentUpdatePayload): PaymentUpdatePayload {
  const basePaymentUpdate = { ...paymentUpdate };
  delete basePaymentUpdate.counter_payment_method;
  delete basePaymentUpdate.cash_received_amount;
  delete basePaymentUpdate.online_received_amount;
  delete basePaymentUpdate.paid_amount;

  return basePaymentUpdate;
}

async function updateOrderPayment(
  adminClient: ReturnType<typeof createClient>,
  order: PaymentOrder,
  paymentUpdate: PaymentUpdatePayload,
) {
  const updatePayload = order.supportsCounterPaymentCapture
    ? paymentUpdate
    : getBasePaymentUpdate(paymentUpdate);
  const { error: updateError } = await adminClient
    .from("orders")
    .update(updatePayload)
    .eq("id", order.id);

  if (
    updateError &&
    order.supportsCounterPaymentCapture &&
    isCounterPaymentCaptureSchemaError(updateError)
  ) {
    const { error: fallbackUpdateError } = await adminClient
      .from("orders")
      .update(getBasePaymentUpdate(paymentUpdate))
      .eq("id", order.id);

    if (!fallbackUpdateError) {
      return;
    }
  }

  if (updateError) {
    throw updateError;
  }
}

async function requestReceiptEmail(
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
  orderId: string,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-order-receipt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    let receiptError = "Failed to send receipt email";

    try {
      const payload = await response.clone().json() as { error?: string; message?: string };
      if (typeof payload.error === "string" && payload.error.trim()) {
        receiptError = payload.error;
      } else if (typeof payload.message === "string" && payload.message.trim()) {
        receiptError = payload.message;
      }
    } catch {
      try {
        const text = await response.text();
        if (text.trim()) {
          receiptError = text.trim();
        }
      } catch {
        // Ignore parsing failures and keep the fallback text.
      }
    }

    throw new Error(receiptError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Missing authorization" }, 401);
    }

    const { orderId, counterPaymentMethod, cashReceivedAmount, onlineReceivedAmount } =
      await req.json() as MarkPaidBody;
    const appOrderId = orderId?.trim() || "";

    if (!appOrderId) {
      return jsonResponse({ success: false, error: "orderId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized request" }, 401);
    }

    const { data: requesterProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const requesterIsStaff = requesterProfile?.role === "admin" ||
      requesterProfile?.role === "chef";

    if (!requesterIsStaff) {
      return jsonResponse({ success: false, error: "Staff access required" }, 403);
    }

    const order = await fetchPaymentOrder(adminClient, appOrderId);

    if (!order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    const orderTotal = roundCurrency(Number(order.total ?? 0));
    const existingPaidAmount = order.payment_status === "paid"
      ? orderTotal
      : roundCurrency(Number(order.paid_amount ?? 0));
    const amountDue = Math.max(0, roundCurrency(orderTotal - existingPaidAmount));
    const selectedCounterPaymentMethod = getCounterPaymentMethod(counterPaymentMethod) ??
      (order.payment_method === "upi" ? "online" : "cash");
    const rawCashAmount = Number(
      cashReceivedAmount ?? (selectedCounterPaymentMethod === "cash" ? amountDue : 0),
    );
    const rawOnlineAmount = Number(
      onlineReceivedAmount ?? (selectedCounterPaymentMethod === "online" ? amountDue : 0),
    );
    const cashAmount = roundCurrency(rawCashAmount);
    const onlineAmount = roundCurrency(rawOnlineAmount);

    if (
      order.payment_provider !== "razorpay" &&
      selectedCounterPaymentMethod === "cash" &&
      amountDue > 0 &&
      (!Number.isFinite(cashAmount) || cashAmount < amountDue)
    ) {
      return jsonResponse({
        success: false,
        error: `Cash received must be at least ₹${amountDue.toFixed(2)}`,
      }, 400);
    }

    if (
      order.payment_provider !== "razorpay" &&
      selectedCounterPaymentMethod === "split" &&
      amountDue > 0
    ) {
      if (!Number.isFinite(cashAmount) || cashAmount <= 0) {
        return jsonResponse({
          success: false,
          error: "Enter the cash amount for this split payment",
        }, 400);
      }

      if (!Number.isFinite(onlineAmount) || onlineAmount <= 0) {
        return jsonResponse({
          success: false,
          error: "Enter the UPI amount for this split payment",
        }, 400);
      }

      if (roundCurrency(cashAmount + onlineAmount) < amountDue) {
        return jsonResponse({
          success: false,
          error: `Cash + UPI must cover ₹${amountDue.toFixed(2)}`,
        }, 400);
      }
    }

    if (
      order.payment_provider !== "razorpay" &&
      selectedCounterPaymentMethod === "online" &&
      amountDue > 0 &&
      (!Number.isFinite(onlineAmount) || onlineAmount < amountDue)
    ) {
      return jsonResponse({
        success: false,
        error: `UPI received must be at least ₹${amountDue.toFixed(2)}`,
      }, 400);
    }

    if (order.payment_status !== "paid") {
      const paymentUpdate: PaymentUpdatePayload = {
        payment_status: "paid",
        payment_verified_at: new Date().toISOString(),
      };

      if (order.supportsCounterPaymentCapture) {
        paymentUpdate.paid_amount = orderTotal;
      }

      if (order.payment_provider !== "razorpay") {
        const existingCashAmount = roundCurrency(Number(order.cash_received_amount ?? 0));
        const existingOnlineAmount = roundCurrency(Number(order.online_received_amount ?? 0));
        const cashDelta = selectedCounterPaymentMethod === "cash" || selectedCounterPaymentMethod === "split"
          ? cashAmount
          : 0;
        const onlineDelta = selectedCounterPaymentMethod === "online"
          ? amountDue
          : selectedCounterPaymentMethod === "split"
            ? onlineAmount
            : 0;
        const nextCashAmount = roundCurrency(existingCashAmount + cashDelta);
        const nextOnlineAmount = roundCurrency(existingOnlineAmount + onlineDelta);
        const resolvedCounterPaymentMethod = nextCashAmount > 0 && nextOnlineAmount > 0
          ? "split"
          : nextOnlineAmount > 0
            ? "online"
            : "cash";

        paymentUpdate.payment_method = resolvedCounterPaymentMethod === "cash" ? "cod" : "upi";
        paymentUpdate.payment_provider = null;

        if (order.supportsCounterPaymentCapture) {
          paymentUpdate.counter_payment_method = resolvedCounterPaymentMethod;
          paymentUpdate.cash_received_amount = nextCashAmount > 0 ? nextCashAmount : null;
          paymentUpdate.online_received_amount = nextOnlineAmount > 0 ? nextOnlineAmount : null;
        }
      }

      await updateOrderPayment(adminClient, order, paymentUpdate);
    }

    EdgeRuntime.waitUntil(
      requestReceiptEmail(supabaseUrl, anonKey, serviceKey, order.order_id)
        .catch((receiptError) => {
          console.error("Failed to send payment receipt email", receiptError);
        }),
    );

    return jsonResponse({
      success: true,
      appOrderId: order.order_id,
      receiptEmailSent: true,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
