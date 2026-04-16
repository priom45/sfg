import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  calculateReviewRewardDiscount,
  getReviewRewardCouponForCheckout,
  releaseReviewRewardCoupon,
  reserveReviewRewardCoupon,
} from "../_shared/review-rewards.ts";
import { reserveOrderInventory } from "../_shared/inventory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};
const TAKEAWAY_FEE = 10;

interface CheckoutItem {
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
  reviewRewardCouponId?: string;
  reviewRewardDiscountAmount?: number;
  items?: CheckoutItem[];
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
  takeaway_fee: number;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "card";
  payment_provider: "razorpay";
  payment_status: "pending";
  review_reward_coupon_id: string | null;
  review_reward_discount_amount: number;
};

type AppOrderInsertCompat = Omit<
  AppOrderInsert,
  "pickup_option" | "takeaway_fee" | "review_reward_coupon_id" | "review_reward_discount_amount"
> &
  Partial<
    Pick<
      AppOrderInsert,
      "pickup_option" | "takeaway_fee" | "review_reward_coupon_id" | "review_reward_discount_amount"
    >
  >;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingOrderColumn(
  error: { code?: string; message?: string } | null,
  columnName:
    | "pickup_option"
    | "takeaway_fee"
    | "review_reward_coupon_id"
    | "review_reward_discount_amount",
) {
  return !!error?.message?.includes(columnName) &&
    (error.code === "42703" || error.code === "PGRST204");
}

function toPaise(value: number) {
  return Math.max(100, Math.round(value * 100));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

async function getUnavailableMenuItemNames(
  adminClient: ReturnType<typeof createClient>,
  items: CheckoutItem[],
) {
  const menuItemIds = Array.from(
    new Set(items.map((item) => item.menu_item_id).filter((menuItemId) => typeof menuItemId === "string" && menuItemId.trim())),
  );

  if (menuItemIds.length === 0) {
    return [];
  }

  const { data, error } = await adminClient
    .from("menu_items")
    .select("id, name, is_available")
    .in("id", menuItemIds);

  if (error) {
    throw error;
  }

  const menuItemsById = new Map(
    (data || []).map((item) => [item.id as string, item as { id: string; name: string; is_available: boolean }]),
  );

  return menuItemIds.flatMap((menuItemId) => {
    const matchingItem = menuItemsById.get(menuItemId);
    if (matchingItem && matchingItem.is_available !== false) {
      return [];
    }

    const fallbackName = items.find((item) => item.menu_item_id === menuItemId)?.item_name || "Item";
    return [matchingItem?.name || fallbackName];
  });
}

async function createAppOrder(
  adminClient: ReturnType<typeof createClient>,
  orderInsert: AppOrderInsert,
) {
  let { data, error } = await adminClient
    .from("orders")
    .insert(orderInsert)
    .select("id, order_id, customer_name, customer_phone, customer_email")
    .single();

  if (
    isMissingOrderColumn(error, "pickup_option")
    || isMissingOrderColumn(error, "takeaway_fee")
    || isMissingOrderColumn(error, "review_reward_coupon_id")
    || isMissingOrderColumn(error, "review_reward_discount_amount")
  ) {
    const legacyInsert: AppOrderInsertCompat = { ...orderInsert };

    if (isMissingOrderColumn(error, "pickup_option")) {
      delete legacyInsert.pickup_option;
    }

    if (isMissingOrderColumn(error, "takeaway_fee")) {
      delete legacyInsert.takeaway_fee;
    }

    if (isMissingOrderColumn(error, "review_reward_coupon_id")) {
      delete legacyInsert.review_reward_coupon_id;
    }

    if (isMissingOrderColumn(error, "review_reward_discount_amount")) {
      delete legacyInsert.review_reward_discount_amount;
    }

    ({ data, error } = await adminClient
      .from("orders")
      .insert(legacyInsert)
      .select("id, order_id, customer_name, customer_phone, customer_email")
      .single());
  }

  return { data, error };
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
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Missing authorization" }, 401);
    }

    const body = await req.json() as CreateBody;
    const customerName = body.customerName?.trim() || "";
    const customerPhone = body.customerPhone?.trim() || "";
    const customerEmail = body.customerEmail?.trim() || "";
    const pickupOption = body.pickupOption === "dine_in" ? "dine_in" : "takeaway";
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = Number(body.subtotal ?? 0);
    const discount = Number(body.discount ?? 0);
    const total = Number(body.total ?? 0);
    const reviewRewardCouponId = body.reviewRewardCouponId?.trim() || "";
    const reviewRewardDiscountAmount = Number(body.reviewRewardDiscountAmount ?? 0);
    const takeawayFee = pickupOption === "takeaway" ? TAKEAWAY_FEE : 0;
    const expectedTotal = roundCurrency(Math.max(0, subtotal - discount) + takeawayFee);

    if (!customerName || !customerPhone) {
      return jsonResponse({ success: false, error: "Customer details are required" }, 400);
    }

    if (!items.length) {
      return jsonResponse({ success: false, error: "Cart is empty" }, 400);
    }

    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return jsonResponse({ success: false, error: "Invalid subtotal" }, 400);
    }

    if (!Number.isFinite(discount) || discount < 0) {
      return jsonResponse({ success: false, error: "Invalid discount" }, 400);
    }

    if (!Number.isFinite(total) || total <= 0) {
      return jsonResponse({ success: false, error: "Invalid order total" }, 400);
    }

    if (!Number.isFinite(reviewRewardDiscountAmount) || reviewRewardDiscountAmount < 0) {
      return jsonResponse({ success: false, error: "Invalid review reward discount" }, 400);
    }

    if (!reviewRewardCouponId && reviewRewardDiscountAmount > 0) {
      return jsonResponse({ success: false, error: "Review reward coupon is required for this discount" }, 400);
    }

    if (Math.abs(roundCurrency(total) - expectedTotal) > 0.01) {
      return jsonResponse({ success: false, error: "Order total mismatch" }, 400);
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

    const [
      {
        data: { user },
        error: authError,
      },
      { data: siteSettings },
    ] = await Promise.all([
      userClient.auth.getUser(),
      adminClient
        .from("site_settings")
        .select("site_is_open, reopening_text")
        .eq("id", true)
        .maybeSingle(),
    ]);

    if (authError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized request" }, 401);
    }

    if (siteSettings && !siteSettings.site_is_open) {
      return jsonResponse({
        success: false,
        error: siteSettings.reopening_text || "Ordering is currently unavailable",
      }, 409);
    }

    const { error: expireOrdersError } = await adminClient.rpc("expire_stale_pending_orders");
    if (expireOrdersError) {
      throw expireOrdersError;
    }

    const unavailableMenuItemNames = await getUnavailableMenuItemNames(adminClient, items);

    if (unavailableMenuItemNames.length > 0) {
      return jsonResponse({
        success: false,
        error: unavailableMenuItemNames.length === 1
          ? `${unavailableMenuItemNames[0]} is out of stock right now`
          : `Some items are out of stock right now: ${unavailableMenuItemNames.join(", ")}`,
      }, 409);
    }

    let expectedReviewRewardDiscount = 0;
    if (reviewRewardCouponId) {
      const reviewRewardCoupon = await getReviewRewardCouponForCheckout(adminClient, reviewRewardCouponId, user.id);

      if (!reviewRewardCoupon) {
        return jsonResponse({ success: false, error: "Review reward coupon not found" }, 404);
      }

      if (reviewRewardCoupon.is_redeemed) {
        return jsonResponse({ success: false, error: "This review reward has already been used" }, 409);
      }

      expectedReviewRewardDiscount = calculateReviewRewardDiscount(
        subtotal,
        Number(reviewRewardCoupon.discount_percentage ?? 10),
      );

      if (reviewRewardDiscountAmount !== expectedReviewRewardDiscount) {
        return jsonResponse({ success: false, error: "Review reward discount mismatch" }, 400);
      }
    }

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
      takeaway_fee: takeawayFee,
      subtotal,
      discount,
      total,
      payment_method: "card",
      payment_provider: "razorpay",
      payment_status: "pending",
      review_reward_coupon_id: reviewRewardCouponId || null,
      review_reward_discount_amount: expectedReviewRewardDiscount,
    };

    const { data: order, error: orderError } = await createAppOrder(adminClient, orderInsert);

    if (orderError || !order) {
      throw orderError || new Error("Failed to create app order");
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      customizations: item.customizations ?? [],
    }));

    const itemsResult = await adminClient.from("order_items").insert(orderItems);
    if (itemsResult.error) {
      await adminClient
        .from("orders")
        .update({
          payment_status: "failed",
          status: "expired",
        })
        .eq("id", order.id);

      if (reviewRewardCouponId) {
        await releaseReviewRewardCoupon(adminClient, {
          id: order.id,
          review_reward_coupon_id: reviewRewardCouponId,
          review_reward_discount_amount: expectedReviewRewardDiscount,
        });
      }

      throw itemsResult.error;
    }

    const inventoryReservation = await reserveOrderInventory(adminClient, order.id);
    if (!inventoryReservation.success) {
      await adminClient
        .from("orders")
        .update({
          payment_status: "failed",
          status: "expired",
        })
        .eq("id", order.id);

      return jsonResponse({
        success: false,
        error: inventoryReservation.error || "Some items are out of stock right now",
      }, 409);
    }

    let rewardReserved = false;
    if (reviewRewardCouponId) {
      const reservedReviewReward = await reserveReviewRewardCoupon(
        adminClient,
        reviewRewardCouponId,
        user.id,
        order.id,
      );

      if (!reservedReviewReward) {
        await adminClient
          .from("orders")
          .update({
            payment_status: "failed",
            status: "expired",
          })
          .eq("id", order.id);

        await releaseReviewRewardCoupon(adminClient, {
          id: order.id,
          review_reward_coupon_id: reviewRewardCouponId,
          review_reward_discount_amount: expectedReviewRewardDiscount,
        });

        throw new Error("This review reward is no longer available");
      }

      rewardReserved = true;
    }

    const razorpayOrderResult = await Promise.allSettled([
      createRazorpayOrder(
        razorpayKeyId,
        razorpaySecret,
        toPaise(total),
        order.order_id,
        { app_order_id: order.order_id },
      ),
    ]);

    const razorpayOrder = razorpayOrderResult[0]?.status === "fulfilled"
      ? razorpayOrderResult[0].value
      : null;
    const razorpayError = razorpayOrderResult[0]?.status === "rejected"
      ? razorpayOrderResult[0].reason
      : null;

    if (!razorpayOrder || razorpayError) {
      await adminClient
        .from("orders")
        .update({
          payment_status: "failed",
          status: "expired",
        })
        .eq("id", order.id);

      if (rewardReserved && reviewRewardCouponId) {
        await releaseReviewRewardCoupon(adminClient, {
          id: order.id,
          review_reward_coupon_id: reviewRewardCouponId,
          review_reward_discount_amount: expectedReviewRewardDiscount,
        });
      }

      throw razorpayError || new Error("Failed to create Razorpay order");
    }

    const { error: razorpayLinkError } = await adminClient
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq("id", order.id);

    if (razorpayLinkError) {
      await adminClient
        .from("orders")
        .update({
          payment_status: "failed",
          status: "expired",
        })
        .eq("id", order.id);

      if (reviewRewardCouponId) {
        await releaseReviewRewardCoupon(adminClient, {
          id: order.id,
          review_reward_coupon_id: reviewRewardCouponId,
          review_reward_discount_amount: expectedReviewRewardDiscount,
        });
      }

      throw razorpayLinkError;
    }

    return jsonResponse({
      success: true,
      keyId: razorpayKeyId,
      razorpayOrderId: razorpayOrder.id,
      appOrderId: order.order_id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      customerName,
      customerPhone,
      customerEmail,
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
