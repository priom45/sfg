/*
  # Add estimated preparation time to orders

  1. Modified Tables
    - `orders`
      - `estimated_minutes` (integer, nullable) - Chef sets this when confirming an order.
        Represents how many minutes the order will take to prepare.

  2. Notes
    - Nullable because the value is set at confirmation time, not at order placement
    - Combined with `confirmed_at`, the frontend calculates a countdown timer
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'estimated_minutes'
  ) THEN
    ALTER TABLE orders ADD COLUMN estimated_minutes integer;
  END IF;
END $$;
