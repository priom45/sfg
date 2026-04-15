import { customerSupabase } from './supabase';
import type { ItemReview, ReviewRewardCoupon } from '../types';

interface SubmitItemReviewPayload {
  orderItemId: string;
  rating: number;
  comment: string;
}

interface SubmitItemReviewResponse {
  success: boolean;
  review?: ItemReview;
  rewardCoupon?: ReviewRewardCoupon;
  error?: string;
}

export function calculateReviewRewardDiscount(subtotal: number, discountPercentage: number) {
  return Math.round((subtotal * discountPercentage) / 100);
}

export async function submitItemReview(payload: SubmitItemReviewPayload) {
  const { data, error } = await customerSupabase.functions.invoke<SubmitItemReviewResponse>(
    'submit-item-review',
    {
      body: payload,
    },
  );

  if (error) {
    throw error;
  }

  if (!data?.success || !data.review || !data.rewardCoupon) {
    throw new Error(data?.error || 'Failed to submit item review');
  }

  return {
    review: data.review,
    rewardCoupon: data.rewardCoupon,
  };
}
