import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  loadRazorpayEnv,
  markOrderPaymentFailed,
  resolvePaymentForExistingOrder,
} from "../_shared/razorpay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReconcileBody {
  appOrderId?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    const { appOrderId } = await req.json() as ReconcileBody;
    const normalizedOrderId = appOrderId?.trim() || "";

    if (!normalizedOrderId) {
      return jsonResponse({ success: false, error: "appOrderId is required" }, 400);
    }

    const env = loadRazorpayEnv();

    const userClient = createClient(env.supabaseUrl, env.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(env.supabaseUrl, env.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized request" }, 401);
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_id, user_id, payment_status, payment_provider, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_verified_at, status")
      .eq("order_id", normalizedOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    if (order.user_id !== user.id) {
      return jsonResponse({ success: false, error: "Order access denied" }, 403);
    }

    if (order.payment_provider !== "razorpay") {
      return jsonResponse({ success: false, error: "Order is not using Razorpay" }, 400);
    }

    const resolution = await resolvePaymentForExistingOrder(adminClient, env, order);

    if (resolution.paymentState === "failed" && order.payment_status !== "failed") {
      const failedOrder = await markOrderPaymentFailed(adminClient, order);
      return jsonResponse({
        success: true,
        appOrderId: failedOrder.order_id,
        paymentState: "failed",
        orderStatus: failedOrder.status,
      });
    }

    return jsonResponse({
      success: resolution.success,
      appOrderId: resolution.appOrderId,
      paymentState: resolution.paymentState,
      orderStatus: resolution.orderStatus,
      paymentMethod: resolution.paymentMethod,
      receiptEmailSent: resolution.receiptEmailSent,
      manualReview: resolution.manualReview,
      error: resolution.error,
    }, resolution.manualReview ? 409 : 200);
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
