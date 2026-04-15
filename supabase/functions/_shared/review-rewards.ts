import type { AdminClient } from "./razorpay.ts";

export interface ReviewRewardCouponRecord {
  id: string;
  user_id: string;
  code: string;
  discount_percentage: number;
  is_redeemed: boolean;
  redeemed_order_id: string | null;
}

export interface ReviewRewardOrderRecord {
  id: string;
  review_reward_coupon_id: string | null;
  review_reward_discount_amount: number | null;
}

const REVIEW_REWARD_COUPON_SELECT = `
  id,
  user_id,
  code,
  discount_percentage,
  is_redeemed,
  redeemed_order_id
`;

export function calculateReviewRewardDiscount(subtotal: number, discountPercentage: number) {
  return Math.round((subtotal * discountPercentage) / 100);
}

export async function getReviewRewardCouponForCheckout(
  adminClient: AdminClient,
  couponId: string,
  userId: string,
) {
  const { data, error } = await adminClient
    .from("review_reward_coupons")
    .select(REVIEW_REWARD_COUPON_SELECT)
    .eq("id", couponId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ReviewRewardCouponRecord | null;
}

export async function reserveReviewRewardCoupon(
  adminClient: AdminClient,
  couponId: string,
  userId: string,
  orderId: string,
) {
  const { data, error } = await adminClient
    .from("review_reward_coupons")
    .update({
      is_redeemed: true,
      redeemed_at: new Date().toISOString(),
      redeemed_order_id: orderId,
    })
    .eq("id", couponId)
    .eq("user_id", userId)
    .eq("is_redeemed", false)
    .select(REVIEW_REWARD_COUPON_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ReviewRewardCouponRecord | null;
}

export async function releaseReviewRewardCoupon(
  adminClient: AdminClient,
  order: ReviewRewardOrderRecord,
) {
  if (!order.review_reward_coupon_id) {
    return;
  }

  const { error: couponError } = await adminClient
    .from("review_reward_coupons")
    .update({
      is_redeemed: false,
      redeemed_at: null,
      redeemed_order_id: null,
    })
    .eq("id", order.review_reward_coupon_id)
    .eq("redeemed_order_id", order.id);

  if (couponError) {
    throw couponError;
  }

  const { error: orderError } = await adminClient
    .from("orders")
    .update({
      review_reward_coupon_id: null,
      review_reward_discount_amount: 0,
    })
    .eq("id", order.id);

  if (orderError) {
    throw orderError;
  }
}
