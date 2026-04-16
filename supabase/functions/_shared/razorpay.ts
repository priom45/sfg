import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHmac } from "node:crypto";
import { releaseReviewRewardCoupon } from "./review-rewards.ts";
import { reserveOrderInventory } from "./inventory.ts";

export type AdminClient = ReturnType<typeof createClient>;

export type PaymentState = "paid" | "pending" | "failed";

export interface RazorpayEnv {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  razorpayKeyId: string;
  razorpaySecret: string;
  webhookSecret?: string;
}

export interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  order_id: string;
  notes?: Record<string, string>;
  created_at?: number;
}

export interface OrderRecord {
  id: string;
  order_id: string;
  payment_status: string | null;
  payment_provider: string | null;
  payment_method: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_verified_at: string | null;
  review_reward_coupon_id: string | null;
  review_reward_discount_amount: number | null;
  inventory_reserved: boolean | null;
  status: string;
}

export interface PaymentResolution {
  success: boolean;
  appOrderId: string;
  paymentState: PaymentState;
  orderStatus: string;
  paymentMethod?: "upi" | "card";
  receiptEmailSent?: boolean;
  error?: string;
  manualReview?: boolean;
}

const ORDER_SELECT_FIELDS = `
  id,
  order_id,
  payment_status,
  payment_provider,
  payment_method,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  payment_verified_at,
  review_reward_coupon_id,
  review_reward_discount_amount,
  inventory_reserved,
  status
`;

function razorpayAuthHeader(keyId: string, keySecret: string) {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

export function loadRazorpayEnv(options?: { requireWebhookSecret?: boolean }) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const razorpaySecret = Deno.env.get("RAZORPAY_SECRET")?.trim();
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")?.trim();

  if (!razorpayKeyId || !razorpaySecret) {
    throw new Error("Razorpay is not configured");
  }

  if (options?.requireWebhookSecret && !webhookSecret) {
    throw new Error("Razorpay webhook secret is not configured");
  }

  return {
    supabaseUrl,
    anonKey,
    serviceKey,
    razorpayKeyId,
    razorpaySecret,
    webhookSecret,
  } satisfies RazorpayEnv;
}

export function verifyCheckoutSignature(
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

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
}

function paymentMethodFromRazorpay(method?: string | null): "upi" | "card" | undefined {
  if (!method) return undefined;
  return method === "upi" ? "upi" : "card";
}

function paymentStateFromStatus(status?: string | null): PaymentState {
  if (!status) return "pending";
  if (status === "captured") return "paid";
  if (["failed", "refunded"].includes(status)) return "failed";
  return "pending";
}

function paymentPriority(status?: string | null) {
  switch (status) {
    case "captured":
      return 4;
    case "authorized":
      return 3;
    case "created":
      return 2;
    case "failed":
      return 1;
    default:
      return 0;
  }
}

export async function requestReceiptEmail(env: RazorpayEnv, orderId: string) {
  const response = await fetch(`${env.supabaseUrl}/functions/v1/send-order-receipt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.serviceKey}`,
      apikey: env.anonKey,
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

export async function fetchRazorpayPayment(
  env: RazorpayEnv,
  paymentId: string,
) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: razorpayAuthHeader(env.razorpayKeyId, env.razorpaySecret),
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

export async function captureRazorpayPayment(
  env: RazorpayEnv,
  paymentId: string,
  amount: number,
) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(env.razorpayKeyId, env.razorpaySecret),
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

export async function fetchRazorpayOrderPayments(
  env: RazorpayEnv,
  razorpayOrderId: string,
) {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`, {
    headers: {
      Authorization: razorpayAuthHeader(env.razorpayKeyId, env.razorpaySecret),
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload?.error?.description === "string"
        ? payload.error.description
        : typeof payload?.error?.message === "string"
          ? payload.error.message
          : "Failed to fetch Razorpay order payments";
    throw new Error(message);
  }

  return Array.isArray(payload?.items) ? payload.items as RazorpayPayment[] : [];
}

export function chooseBestRazorpayPayment(payments: RazorpayPayment[]) {
  if (!payments.length) {
    return null;
  }

  return [...payments].sort((left, right) => {
    const priorityDiff = paymentPriority(right.status) - paymentPriority(left.status);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return Number(right.created_at ?? 0) - Number(left.created_at ?? 0);
  })[0] ?? null;
}

export async function getOrderByAppOrderId(adminClient: AdminClient, appOrderId: string) {
  const { data, error } = await adminClient
    .from("orders")
    .select(ORDER_SELECT_FIELDS)
    .eq("order_id", appOrderId)
    .maybeSingle();

  return { data: data as OrderRecord | null, error };
}

export async function getOrderByRazorpayOrderId(adminClient: AdminClient, razorpayOrderId: string) {
  const { data, error } = await adminClient
    .from("orders")
    .select(ORDER_SELECT_FIELDS)
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  return { data: data as OrderRecord | null, error };
}

async function getLatestOrderState(adminClient: AdminClient, orderId: string) {
  const { data, error } = await adminClient
    .from("orders")
    .select(ORDER_SELECT_FIELDS)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    throw error || new Error("Order not found");
  }

  return data as OrderRecord;
}

async function finalizeCapturedPayment(
  adminClient: AdminClient,
  env: RazorpayEnv,
  order: OrderRecord,
  payment: RazorpayPayment,
  razorpaySignature?: string,
): Promise<PaymentResolution> {
  if (order.status === "cancelled" && order.payment_status !== "paid") {
    console.error("Captured Razorpay payment requires manual review for cancelled order", {
      appOrderId: order.order_id,
      razorpayOrderId: order.razorpay_order_id,
      razorpayPaymentId: payment.id,
    });

    return {
      success: false,
      appOrderId: order.order_id,
      paymentState: "failed",
      orderStatus: order.status,
      paymentMethod: paymentMethodFromRazorpay(payment.method),
      manualReview: true,
      error: "Payment was captured for a cancelled order and requires manual review.",
    };
  }

  const paymentMethod = paymentMethodFromRazorpay(payment.method) ?? "card";

  if (order.status === "expired" && !order.inventory_reserved) {
    const inventoryReservation = await reserveOrderInventory(adminClient, order.id);

    if (!inventoryReservation.success) {
      console.error("Captured Razorpay payment requires manual review because inventory is no longer available", {
        appOrderId: order.order_id,
        razorpayOrderId: order.razorpay_order_id,
        razorpayPaymentId: payment.id,
        inventoryError: inventoryReservation.error,
      });

      return {
        success: false,
        appOrderId: order.order_id,
        paymentState: "failed",
        orderStatus: order.status,
        paymentMethod,
        manualReview: true,
        error: inventoryReservation.error || "Payment was captured after inventory was released and needs manual review.",
      };
    }
  }

  const nextStatus = order.status === "expired" ? "pending" : order.status;

  const { data: updatedOrder, error: updateError } = await adminClient
    .from("orders")
    .update({
      payment_provider: "razorpay",
      payment_status: "paid",
      payment_method: paymentMethod,
      razorpay_payment_id: payment.id,
      razorpay_signature: razorpaySignature ?? order.razorpay_signature,
      payment_verified_at: new Date().toISOString(),
      status: nextStatus,
    })
    .eq("id", order.id)
    .neq("payment_status", "paid")
    .select(ORDER_SELECT_FIELDS)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  let receiptEmailSent: boolean | undefined;
  if (updatedOrder) {
    receiptEmailSent = true;
    try {
      await requestReceiptEmail(env, order.order_id);
    } catch (receiptError) {
      receiptEmailSent = false;
      console.error("Failed to send payment receipt email", receiptError);
    }

    return {
      success: true,
      appOrderId: order.order_id,
      paymentState: "paid",
      orderStatus: (updatedOrder as OrderRecord).status,
      paymentMethod,
      receiptEmailSent,
    };
  }

  const latestOrder = await getLatestOrderState(adminClient, order.id);

  return {
    success: latestOrder.payment_status === "paid",
    appOrderId: latestOrder.order_id,
    paymentState: latestOrder.payment_status === "paid" ? "paid" : paymentStateFromStatus(payment.status),
    orderStatus: latestOrder.status,
    paymentMethod: paymentMethodFromRazorpay(latestOrder.payment_method) ?? paymentMethod,
  };
}

async function resolveKnownPayment(
  adminClient: AdminClient,
  env: RazorpayEnv,
  order: OrderRecord,
  payment: RazorpayPayment,
  razorpaySignature?: string,
): Promise<PaymentResolution> {
  if (order.payment_status === "paid") {
    return {
      success: true,
      appOrderId: order.order_id,
      paymentState: "paid",
      orderStatus: order.status,
      paymentMethod: paymentMethodFromRazorpay(order.payment_method) ?? paymentMethodFromRazorpay(payment.method),
    };
  }

  if (!order.razorpay_order_id || payment.order_id !== order.razorpay_order_id) {
    return {
      success: false,
      appOrderId: order.order_id,
      paymentState: "failed",
      orderStatus: order.status,
      error: "Payment does not belong to this order",
    };
  }

  let resolvedPayment = payment;

  if (resolvedPayment.status === "authorized") {
    resolvedPayment = await captureRazorpayPayment(env, resolvedPayment.id, resolvedPayment.amount);
  }

  if (resolvedPayment.status !== "captured") {
    return {
      success: resolvedPayment.status !== "failed",
      appOrderId: order.order_id,
      paymentState: paymentStateFromStatus(resolvedPayment.status),
      orderStatus: order.status,
      paymentMethod: paymentMethodFromRazorpay(resolvedPayment.method),
      error: resolvedPayment.status === "failed" ? "Payment failed" : undefined,
    };
  }

  return finalizeCapturedPayment(adminClient, env, order, resolvedPayment, razorpaySignature);
}

export async function resolvePaymentByPaymentId(
  adminClient: AdminClient,
  env: RazorpayEnv,
  order: OrderRecord,
  paymentId: string,
  razorpaySignature?: string,
) {
  const payment = await fetchRazorpayPayment(env, paymentId);
  return resolveKnownPayment(adminClient, env, order, payment, razorpaySignature);
}

export async function resolvePaymentForExistingOrder(
  adminClient: AdminClient,
  env: RazorpayEnv,
  order: OrderRecord,
) {
  if (order.payment_status === "paid") {
    return {
      success: true,
      appOrderId: order.order_id,
      paymentState: "paid",
      orderStatus: order.status,
      paymentMethod: paymentMethodFromRazorpay(order.payment_method),
    } satisfies PaymentResolution;
  }

  if (!order.razorpay_order_id) {
    return {
      success: order.payment_status !== "failed",
      appOrderId: order.order_id,
      paymentState: order.payment_status === "failed" ? "failed" : "pending",
      orderStatus: order.status,
      paymentMethod: paymentMethodFromRazorpay(order.payment_method),
    } satisfies PaymentResolution;
  }

  const payments = await fetchRazorpayOrderPayments(env, order.razorpay_order_id);
  const bestPayment = chooseBestRazorpayPayment(payments);

  if (!bestPayment) {
    return {
      success: order.payment_status !== "failed",
      appOrderId: order.order_id,
      paymentState: order.payment_status === "failed" ? "failed" : "pending",
      orderStatus: order.status,
      paymentMethod: paymentMethodFromRazorpay(order.payment_method),
    } satisfies PaymentResolution;
  }

  return resolveKnownPayment(adminClient, env, order, bestPayment);
}

export async function markOrderPaymentFailed(
  adminClient: AdminClient,
  order: OrderRecord,
) {
  const { data, error } = await adminClient
    .from("orders")
    .update({
      payment_status: "failed",
      status: "expired",
    })
    .eq("id", order.id)
    .neq("payment_status", "paid")
    .select(ORDER_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    const failedOrder = data as OrderRecord;
    if (failedOrder.review_reward_coupon_id) {
      await releaseReviewRewardCoupon(adminClient, failedOrder);
      return getLatestOrderState(adminClient, order.id);
    }
    return failedOrder;
  }

  return getLatestOrderState(adminClient, order.id);
}
