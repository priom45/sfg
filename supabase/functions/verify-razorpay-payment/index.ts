import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  loadRazorpayEnv,
  resolvePaymentByPaymentId,
  verifyCheckoutSignature,
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

interface VerifyBody {
  appOrderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
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
    const body = await req.json() as VerifyBody;
    const appOrderId = body.appOrderId?.trim() || "";
    const razorpayOrderId = body.razorpayOrderId?.trim() || "";
    const razorpayPaymentId = body.razorpayPaymentId?.trim() || "";
    const razorpaySignature = body.razorpaySignature?.trim() || "";

    if (!appOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return jsonResponse({ success: false, error: "Payment verification details are required" }, 400);
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
      .select("id, order_id, user_id, razorpay_order_id, payment_status, payment_provider, payment_method, razorpay_payment_id, razorpay_signature, payment_verified_at, review_reward_coupon_id, review_reward_discount_amount, inventory_reserved, status")
      .eq("order_id", appOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    if (order.user_id && order.user_id !== user?.id) {
      return jsonResponse({ success: false, error: "Order access denied" }, 403);
    }

    if (order.payment_status === "paid") {
      return jsonResponse({ success: true, appOrderId: order.order_id });
    }

    if (!order.razorpay_order_id || order.razorpay_order_id !== razorpayOrderId) {
      return jsonResponse({ success: false, error: "Razorpay order mismatch" }, 400);
    }

    if (!verifyCheckoutSignature(order.razorpay_order_id, razorpayPaymentId, razorpaySignature, env.razorpaySecret)) {
      return jsonResponse({ success: false, error: "Invalid Razorpay signature" }, 400);
    }

    const resolution = await resolvePaymentByPaymentId(
      adminClient,
      env,
      order,
      razorpayPaymentId,
      razorpaySignature,
    );

    if (!resolution.success) {
      return jsonResponse(
        {
          success: false,
          appOrderId: resolution.appOrderId,
          paymentState: resolution.paymentState,
          orderStatus: resolution.orderStatus,
          paymentMethod: resolution.paymentMethod,
          error: resolution.error || "Payment could not be verified",
          manualReview: resolution.manualReview,
        },
        resolution.manualReview ? 409 : 400,
      );
    }

    return jsonResponse({
      success: true,
      appOrderId: resolution.appOrderId,
      paymentState: resolution.paymentState,
      orderStatus: resolution.orderStatus,
      paymentMethod: resolution.paymentMethod,
      receiptEmailSent: resolution.receiptEmailSent,
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
