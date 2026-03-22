/*
  # Add pickup option to orders

  1. Changes
    - Add `pickup_option` to `orders`
    - Distinguish pickup orders as either `dine_in` or `takeaway`
    - Default existing and new pickup orders to `takeaway`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'pickup_option'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN pickup_option text NOT NULL DEFAULT 'takeaway'
      CHECK (pickup_option IN ('dine_in', 'takeaway'));
  END IF;
END $$;
