import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  loadRazorpayEnv,
  markOrderPaymentFailed,
  resolvePaymentForExistingOrder,
} from "../_shared/razorpay.ts";
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

interface ReconcileBody {
  appOrderId?: string;
  customerEmail?: string;
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
    const { appOrderId, customerEmail } = await req.json() as ReconcileBody;
    const normalizedOrderId = appOrderId?.trim() || "";
    const normalizedCustomerEmail = customerEmail?.trim().toLowerCase() || "";

    if (!normalizedOrderId) {
      return jsonResponse({ success: false, error: "appOrderId is required" }, 400);
    }

    const env = loadRazorpayEnv();
    const authToken = getBearerToken(authHeader);
    const shouldResolveUser = shouldResolveUserFromAuthToken(authToken, env.anonKey);

    const adminClient = createClient(env.supabaseUrl, env.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let user: { id: string } | null = null;
    if (shouldResolveUser) {
      const userClient = createClient(env.supabaseUrl, env.anonKey, {
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
      .select("id, order_id, user_id, customer_email, payment_status, payment_provider, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_verified_at, review_reward_coupon_id, review_reward_discount_amount, inventory_reserved, status")
      .eq("order_id", normalizedOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    const orderCustomerEmail = order.customer_email?.trim().toLowerCase() || "";

    if (order.user_id) {
      if (order.user_id !== user?.id) {
        return jsonResponse({ success: false, error: "Order not found" }, 404);
      }
    } else if (!normalizedCustomerEmail || !orderCustomerEmail || orderCustomerEmail !== normalizedCustomerEmail) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
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
