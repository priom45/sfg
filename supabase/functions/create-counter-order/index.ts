import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CounterOrderItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  customizations: unknown;
}

interface CreateBody {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  pickupOption?: "dine_in" | "takeaway";
  subtotal?: number;
  discount?: number;
  total?: number;
  paymentMethod?: "cod" | "upi" | "card";
  items?: CounterOrderItem[];
}

type AppOrderInsert = {
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address: string;
  pincode: string;
  order_type: "pickup";
  pickup_option: "dine_in" | "takeaway";
  delivery_fee: number;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "cod" | "upi" | "card";
  payment_status: "pending" | "paid";
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingPickupOptionColumn(error: { code?: string; message?: string } | null) {
  return !!error?.message?.includes("pickup_option") &&
    (error.code === "42703" || error.code === "PGRST204");
}

async function createAppOrder(
  adminClient: ReturnType<typeof createClient>,
  orderInsert: AppOrderInsert,
) {
  let { data, error } = await adminClient
    .from("orders")
    .insert(orderInsert)
    .select("id, order_id")
    .single();

  if (isMissingPickupOptionColumn(error)) {
    const { pickup_option: ignoredPickupOption, ...legacyInsert } = orderInsert;
    void ignoredPickupOption;

    ({ data, error } = await adminClient
      .from("orders")
      .insert(legacyInsert)
      .select("id, order_id")
      .single());
  }

  return { data, error };
}

async function requestReceiptEmail(
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
  orderId: string,
  type: "receipt" | "confirmation" = "receipt",
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-order-receipt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId, type }),
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
        // Ignore parsing failures and keep fallback text.
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

    const body = await req.json() as CreateBody;
    const customerName = body.customerName?.trim() || "";
    const customerPhone = body.customerPhone?.trim() || "";
    const customerEmail = body.customerEmail?.trim() || "";
    const pickupOption = body.pickupOption === "dine_in" ? "dine_in" : "takeaway";
    const paymentMethod = body.paymentMethod === "upi"
      ? "upi"
      : body.paymentMethod === "card"
        ? "card"
        : "cod";
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = Number(body.subtotal ?? 0);
    const discount = Number(body.discount ?? 0);
    const total = Number(body.total ?? 0);

    if (!customerName || !customerPhone) {
      return jsonResponse({ success: false, error: "Customer details are required" }, 400);
    }

    if (!items.length) {
      return jsonResponse({ success: false, error: "Cart is empty" }, 400);
    }

    if (!Number.isFinite(total) || total < 0) {
      return jsonResponse({ success: false, error: "Invalid order total" }, 400);
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

    const { data: siteSettings } = await adminClient
      .from("site_settings")
      .select("site_is_open, reopening_text")
      .eq("id", true)
      .maybeSingle();

    if (siteSettings && !siteSettings.site_is_open) {
      return jsonResponse({
        success: false,
        error: siteSettings.reopening_text || "Ordering is currently unavailable",
      }, 409);
    }

    const paymentStatus = total <= 0 ? "paid" : "pending";

    const orderInsert: AppOrderInsert = {
      user_id: user.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      address: "",
      pincode: "",
      order_type: "pickup",
      pickup_option: pickupOption,
      delivery_fee: 0,
      subtotal,
      discount,
      total,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    };

    const { data: order, error: orderError } = await createAppOrder(adminClient, orderInsert);

    if (orderError || !order) {
      throw orderError || new Error("Failed to create order");
    }

    const { error: itemsError } = await adminClient.from("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        customizations: item.customizations ?? [],
      })),
    );

    if (itemsError) {
      await adminClient.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    let receiptEmailSent = false;
    try {
      const emailType = paymentStatus === "paid" ? "receipt" : "confirmation";
      await requestReceiptEmail(supabaseUrl, anonKey, serviceKey, order.order_id, emailType);
      receiptEmailSent = true;
    } catch (receiptError) {
      console.error("Failed to send order email", receiptError);
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
