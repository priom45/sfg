/*
  # Create item reviews and review reward coupons

  1. New tables
    - `item_reviews`
      - Stores one review per ordered item line
    - `review_reward_coupons`
      - Stores 10% reward coupons earned from item reviews

  2. Orders updates
    - Adds `review_reward_coupon_id`
    - Adds `review_reward_discount_amount`

  3. Security
    - Users can view their own reviews and reward coupons
    - Staff can also view item reviews
*/

CREATE TABLE IF NOT EXISTS public.item_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_reviews_unique_user_order_item UNIQUE (user_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS item_reviews_user_created_at_idx
  ON public.item_reviews (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS item_reviews_order_id_idx
  ON public.item_reviews (order_id);

CREATE TABLE IF NOT EXISTS public.review_reward_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_review_id uuid NOT NULL UNIQUE REFERENCES public.item_reviews(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  discount_percentage numeric(5,2) NOT NULL DEFAULT 10
    CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  is_redeemed boolean NOT NULL DEFAULT false,
  redeemed_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_reward_coupons_user_created_at_idx
  ON public.review_reward_coupons (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_reward_coupons_user_redeemed_idx
  ON public.review_reward_coupons (user_id, is_redeemed, created_at DESC);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS review_reward_coupon_id uuid REFERENCES public.review_reward_coupons(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS review_reward_discount_amount numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.item_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reward_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and staff can view item reviews" ON public.item_reviews;
CREATE POLICY "Users and staff can view item reviews"
  ON public.item_reviews
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Users can view own review reward coupons" ON public.review_reward_coupons;
CREATE POLICY "Users can view own review reward coupons"
  ON public.review_reward_coupons
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
