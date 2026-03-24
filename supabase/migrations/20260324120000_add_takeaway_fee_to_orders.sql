/*
  # Add takeaway fee to orders

  1. Changes
    - Add `takeaway_fee` to `orders`
    - Store the extra charge applied to takeaway orders
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'takeaway_fee'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN takeaway_fee numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
