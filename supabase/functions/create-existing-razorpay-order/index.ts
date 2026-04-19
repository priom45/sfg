import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  getBearerToken,
  shouldResolveUserFromAuthToken,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateBody {
  appOrderId?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toPaise(value: number) {
  return Math.max(100, Math.round(value * 100));
}

async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  amount: number,
  receipt: string,
  notes: Record<string, string>,
) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt,
      notes,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload?.error?.description === "string"
        ? payload.error.description
        : typeof payload?.error?.message === "string"
          ? payload.error.message
          : "Failed to create Razorpay order";
    throw new Error(message);
  }

  return payload as { id: string; amount: number; currency: string };
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
    const { appOrderId } = await req.json() as CreateBody;
    const normalizedOrderId = appOrderId?.trim() || "";

    if (!normalizedOrderId) {
      return jsonResponse({ success: false, error: "appOrderId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
    const razorpaySecret = Deno.env.get("RAZORPAY_SECRET")?.trim();
    const authToken = getBearerToken(authHeader);
    const shouldResolveUser = shouldResolveUserFromAuthToken(authToken, anonKey);

    if (!razorpayKeyId || !razorpaySecret) {
      return jsonResponse({ success: false, error: "Razorpay is not configured" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let user: { id: string } | null = null;
    if (shouldResolveUser) {
      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${authToken}` } },
      });
      const {
        data: { user: requestUser },
        error: authError,
      } = await userClient.auth.getUser();

      if (authError || !requestUser) {
        return jsonResponse({ success: false, error: "Unauthorized request" }, 401);
      }

      user = { id: requestUser.id };
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select(`
        id,
        order_id,
        user_id,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        status,
        total,
        payment_status
      `)
      .eq("order_id", normalizedOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    if (order.user_id && order.user_id !== user?.id) {
      return jsonResponse({ success: false, error: "Order access denied" }, 403);
    }

    if (order.order_type !== "pickup") {
      return jsonResponse({ success: false, error: "Online payment is only available for pickup orders here" }, 400);
    }

    if (["cancelled", "expired", "delivered"].includes(order.status)) {
      return jsonResponse({ success: false, error: "This order can no longer be paid online" }, 400);
    }

    if (order.payment_status === "paid") {
      return jsonResponse({ success: false, error: "This order is already paid" }, 400);
    }

    const total = Number(order.total ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      return jsonResponse({ success: false, error: "Invalid order total" }, 400);
    }

    const razorpayOrder = await createRazorpayOrder(
      razorpayKeyId,
      razorpaySecret,
      toPaise(total),
      order.order_id,
      { app_order_id: order.order_id, existing_order: "true" },
    );

    const { error: updateError } = await adminClient
      .from("orders")
      .update({
        razorpay_order_id: razorpayOrder.id,
      })
      .eq("id", order.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      keyId: razorpayKeyId,
      razorpayOrderId: razorpayOrder.id,
      appOrderId: order.order_id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
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
