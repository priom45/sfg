import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  getOrderByAppOrderId,
  getOrderByRazorpayOrderId,
  loadRazorpayEnv,
  resolvePaymentByPaymentId,
  resolvePaymentForExistingOrder,
  verifyCheckoutSignature,
} from "../_shared/razorpay.ts";

interface CallbackFormFields {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  error_description: string;
}

function getFirstNonEmptyValue(candidates: Array<FormDataEntryValue | null>) {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function withCallbackParams(target: string, params: Record<string, string | undefined>) {
  const url = new URL(target);

  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    url.searchParams.set(key, value);
  });

  return url.toString();
}

function resolveReturnUrl(req: Request, appOrderId: string) {
  const requestUrl = new URL(req.url);
  const returnUrl = requestUrl.searchParams.get("return_url")?.trim() || "";

  if (returnUrl) {
    try {
      const parsed = new URL(returnUrl);
      if (["http:", "https:"].includes(parsed.protocol)) {
        return parsed.toString();
      }
    } catch {
      // Fall through to the default return URL.
    }
  }

  return `${requestUrl.origin}/order-success/${encodeURIComponent(appOrderId)}`;
}

function redirectHtml(target: string, message: string, status = 200) {
  const escapedTarget = escapeHtml(target);
  const escapedMessage = escapeHtml(message);

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0;url=${escapedTarget}" />
    <title>Redirecting...</title>
  </head>
  <body style="font-family: sans-serif; padding: 24px; background: #0f140d; color: #f6f3e8;">
    <p>${escapedMessage}</p>
    <p><a href="${escapedTarget}" style="color: #d8b24e;">Continue</a></p>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

function readCallbackFields(formData: FormData): CallbackFormFields {
  return {
    razorpay_payment_id: getFirstNonEmptyValue([
      formData.get("razorpay_payment_id"),
      formData.get("error[metadata][payment_id]"),
      formData.get("error.metadata.payment_id"),
    ]),
    razorpay_order_id: getFirstNonEmptyValue([
      formData.get("razorpay_order_id"),
      formData.get("error[metadata][order_id]"),
      formData.get("error.metadata.order_id"),
    ]),
    razorpay_signature: getFirstNonEmptyValue([
      formData.get("razorpay_signature"),
    ]),
    error_description: getFirstNonEmptyValue([
      formData.get("error[description]"),
      formData.get("error.description"),
      formData.get("error_description"),
    ]),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const requestUrl = new URL(req.url);
    const appOrderId = requestUrl.searchParams.get("app_order_id")?.trim() || "";
    const returnUrl = resolveReturnUrl(req, appOrderId);
    return redirectHtml(returnUrl, "Redirecting back to your order...");
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const requestUrl = new URL(req.url);
    const appOrderIdFromQuery = requestUrl.searchParams.get("app_order_id")?.trim() || "";
    const returnUrl = resolveReturnUrl(req, appOrderIdFromQuery);
    const env = loadRazorpayEnv();
    const formData = await req.formData();
    const callbackFields = readCallbackFields(formData);
    const adminClient = createClient(env.supabaseUrl, env.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const orderLookup = appOrderIdFromQuery
      ? await getOrderByAppOrderId(adminClient, appOrderIdFromQuery)
      : callbackFields.razorpay_order_id
        ? await getOrderByRazorpayOrderId(adminClient, callbackFields.razorpay_order_id)
        : { data: null, error: null };

    if (orderLookup.error || !orderLookup.data) {
      const target = withCallbackParams(returnUrl, {
        source: "razorpay_callback",
        payment_state: "failed",
      });
      return redirectHtml(target, "We could not find your order. Redirecting...");
    }

    const order = orderLookup.data;
    const resolvedReturnUrl = resolveReturnUrl(req, order.order_id);

    if (
      callbackFields.razorpay_payment_id
      && callbackFields.razorpay_order_id
      && callbackFields.razorpay_signature
      && verifyCheckoutSignature(
        callbackFields.razorpay_order_id,
        callbackFields.razorpay_payment_id,
        callbackFields.razorpay_signature,
        env.razorpaySecret,
      )
    ) {
      const resolution = await resolvePaymentByPaymentId(
        adminClient,
        env,
        order,
        callbackFields.razorpay_payment_id,
        callbackFields.razorpay_signature,
      );

      const target = withCallbackParams(resolvedReturnUrl, {
        source: "razorpay_callback",
        payment_state: resolution.paymentState,
        order_status: resolution.orderStatus,
        manual_review: resolution.manualReview ? "true" : undefined,
      });

      return redirectHtml(
        target,
        resolution.paymentState === "paid"
          ? "Payment confirmed. Redirecting to your order..."
          : "Payment is being checked. Redirecting to your order...",
      );
    }

    const fallbackResolution = await resolvePaymentForExistingOrder(adminClient, env, order);
    const target = withCallbackParams(resolvedReturnUrl, {
      source: "razorpay_callback",
      payment_state: fallbackResolution.paymentState,
      order_status: fallbackResolution.orderStatus,
      manual_review: fallbackResolution.manualReview ? "true" : undefined,
      callback_error: callbackFields.error_description || undefined,
    });

    return redirectHtml(
      target,
      fallbackResolution.paymentState === "paid"
        ? "Payment confirmed. Redirecting to your order..."
        : "Redirecting back to your order...",
    );
  } catch (error) {
    const requestUrl = new URL(req.url);
    const appOrderId = requestUrl.searchParams.get("app_order_id")?.trim() || "";
    const returnUrl = resolveReturnUrl(req, appOrderId);
    const target = withCallbackParams(returnUrl, {
      source: "razorpay_callback",
      payment_state: "pending",
    });

    console.error("Razorpay callback processing failed", error);
    return redirectHtml(target, "We are redirecting you back to your order...");
  }
});
