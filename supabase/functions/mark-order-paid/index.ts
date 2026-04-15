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
  counterPaymentMethod?: "cash" | "online";
  cashReceivedAmount?: number;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getCounterPaymentMethod(value: unknown) {
  if (value === "online" || value === "cash") {
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
      apikey: anonKey,
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

    const { orderId, counterPaymentMethod, cashReceivedAmount } = await req.json() as MarkPaidBody;
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

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_id, total, payment_status, payment_provider, payment_method")
      .eq("order_id", appOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    const orderTotal = roundCurrency(Number(order.total ?? 0));
    const selectedCounterPaymentMethod = getCounterPaymentMethod(counterPaymentMethod) ??
      (order.payment_method === "upi" ? "online" : "cash");
    const rawCashAmount = Number(cashReceivedAmount ?? orderTotal);
    const cashAmount = roundCurrency(rawCashAmount);

    if (
      order.payment_provider !== "razorpay" &&
      selectedCounterPaymentMethod === "cash" &&
      orderTotal > 0 &&
      (!Number.isFinite(cashAmount) || cashAmount < orderTotal)
    ) {
      return jsonResponse({
        success: false,
        error: `Cash received must be at least ₹${orderTotal.toFixed(2)}`,
      }, 400);
    }

    if (order.payment_status !== "paid") {
      const paymentUpdate: Record<string, string | number | null> = {
        payment_status: "paid",
        payment_verified_at: new Date().toISOString(),
      };

      if (order.payment_provider !== "razorpay") {
        paymentUpdate.payment_method = selectedCounterPaymentMethod === "online" ? "upi" : "cod";
        paymentUpdate.payment_provider = null;
        paymentUpdate.counter_payment_method = selectedCounterPaymentMethod;
        paymentUpdate.cash_received_amount = selectedCounterPaymentMethod === "cash" ? cashAmount : null;
      }

      const { error: updateError } = await adminClient
        .from("orders")
        .update(paymentUpdate)
        .eq("id", order.id);

      if (updateError) {
        throw updateError;
      }
    }

    let receiptEmailSent = true;
    try {
      await requestReceiptEmail(supabaseUrl, anonKey, serviceKey, order.order_id);
    } catch (receiptError) {
      receiptEmailSent = false;
      console.error("Failed to send payment receipt email", receiptError);
    }

    return jsonResponse({
      success: true,
      appOrderId: order.order_id,
      receiptEmailSent,
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
