import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  getOrderByAppOrderId,
  getOrderByRazorpayOrderId,
  loadRazorpayEnv,
  resolvePaymentByPaymentId,
  resolvePaymentForExistingOrder,
  verifyWebhookSignature,
  type RazorpayPayment,
} from "../_shared/razorpay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Razorpay-Signature",
};

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: { entity?: { id?: string; notes?: Record<string, string> } };
  };
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
    const env = loadRazorpayEnv({ requireWebhookSecret: true });
    const signature = req.headers.get("x-razorpay-signature")?.trim() || "";
    const rawBody = await req.text();

    if (!signature || !env.webhookSecret || !verifyWebhookSignature(rawBody, signature, env.webhookSecret)) {
      return jsonResponse({ success: false, error: "Invalid webhook signature" }, 401);
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const event = payload.event?.trim() || "";
    const payment = payload.payload?.payment?.entity;
    const webhookOrderId = payload.payload?.order?.entity?.id?.trim()
      || payment?.order_id?.trim()
      || "";
    const appOrderId = payload.payload?.order?.entity?.notes?.app_order_id?.trim()
      || payment?.notes?.app_order_id?.trim()
      || "";

    if (!["payment.authorized", "payment.captured", "order.paid"].includes(event)) {
      return jsonResponse({ success: true, ignored: true, event });
    }

    const adminClient = createClient(env.supabaseUrl, env.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const orderLookup = appOrderId
      ? await getOrderByAppOrderId(adminClient, appOrderId)
      : webhookOrderId
        ? await getOrderByRazorpayOrderId(adminClient, webhookOrderId)
        : { data: null, error: null };

    if (orderLookup.error || !orderLookup.data) {
      return jsonResponse({
        success: true,
        ignored: true,
        event,
        error: "Matching order not found",
      });
    }

    const resolution = payment?.id
      ? await resolvePaymentByPaymentId(adminClient, env, orderLookup.data, payment.id)
      : await resolvePaymentForExistingOrder(adminClient, env, orderLookup.data);

    return jsonResponse({
      success: resolution.success,
      appOrderId: resolution.appOrderId,
      paymentState: resolution.paymentState,
      orderStatus: resolution.orderStatus,
      paymentMethod: resolution.paymentMethod,
      receiptEmailSent: resolution.receiptEmailSent,
      manualReview: resolution.manualReview,
      error: resolution.error,
      event,
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
