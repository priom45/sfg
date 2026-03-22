import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHmac } from "node:crypto";

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

interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  order_id: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchRazorpayPayment(
  keyId: string,
  keySecret: string,
  paymentId: string,
) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload?.error?.description === "string"
        ? payload.error.description
        : typeof payload?.error?.message === "string"
          ? payload.error.message
          : "Failed to fetch Razorpay payment";
    throw new Error(message);
  }

  return payload as RazorpayPayment;
}

async function captureRazorpayPayment(
  keyId: string,
  keySecret: string,
  paymentId: string,
  amount: number,
) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload?.error?.description === "string"
        ? payload.error.description
        : typeof payload?.error?.message === "string"
          ? payload.error.message
          : "Failed to capture Razorpay payment";
    throw new Error(message);
  }

  return payload as RazorpayPayment;
}

function verifySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  secret: string,
) {
  const expectedSignature = createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return expectedSignature === razorpaySignature;
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
        // Ignore fallback parsing failures.
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

    const body = await req.json() as VerifyBody;
    const appOrderId = body.appOrderId?.trim() || "";
    const razorpayOrderId = body.razorpayOrderId?.trim() || "";
    const razorpayPaymentId = body.razorpayPaymentId?.trim() || "";
    const razorpaySignature = body.razorpaySignature?.trim() || "";

    if (!appOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return jsonResponse({ success: false, error: "Payment verification details are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
    const razorpaySecret = Deno.env.get("RAZORPAY_SECRET")?.trim();

    if (!razorpayKeyId || !razorpaySecret) {
      return jsonResponse({ success: false, error: "Razorpay is not configured" }, 500);
    }

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

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_id, user_id, razorpay_order_id, payment_status, payment_provider")
      .eq("order_id", appOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ success: false, error: "Order not found" }, 404);
    }

    if (order.user_id !== user.id) {
      return jsonResponse({ success: false, error: "Order access denied" }, 403);
    }

    if (order.payment_provider !== "razorpay") {
      return jsonResponse({ success: false, error: "This order is not using Razorpay" }, 400);
    }

    if (order.payment_status === "paid") {
      return jsonResponse({ success: true, appOrderId: order.order_id });
    }

    if (!order.razorpay_order_id || order.razorpay_order_id !== razorpayOrderId) {
      return jsonResponse({ success: false, error: "Razorpay order mismatch" }, 400);
    }

    if (!verifySignature(order.razorpay_order_id, razorpayPaymentId, razorpaySignature, razorpaySecret)) {
      return jsonResponse({ success: false, error: "Invalid Razorpay signature" }, 400);
    }

    let payment = await fetchRazorpayPayment(razorpayKeyId, razorpaySecret, razorpayPaymentId);

    if (payment.order_id !== order.razorpay_order_id) {
      return jsonResponse({ success: false, error: "Payment does not belong to this order" }, 400);
    }

    if (payment.status === "authorized") {
      payment = await captureRazorpayPayment(
        razorpayKeyId,
        razorpaySecret,
        razorpayPaymentId,
        payment.amount,
      );
    }

    if (payment.status !== "captured") {
      return jsonResponse({ success: false, error: "Payment is not captured yet" }, 400);
    }

    const paymentMethod = payment.method === "upi" ? "upi" : "card";

    const { error: updateError } = await adminClient
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: paymentMethod,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        payment_verified_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      throw updateError;
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
      paymentMethod,
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
