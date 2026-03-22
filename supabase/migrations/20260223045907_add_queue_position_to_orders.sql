/*
  # Add queue_position column to orders table

  1. Modified Tables
    - `orders`
      - `queue_position` (integer, nullable) - position in chef's queue when order is pending

  2. Notes
    - Queue position is set when an order is placed
    - Recalculated when orders move out of pending status
    - Helps customers understand their wait time
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'queue_position'
  ) THEN
    ALTER TABLE orders ADD COLUMN queue_position integer;
  END IF;
END $$;