/*
  # Add counter payment capture fields to orders

  1. Changes
    - Add `counter_payment_method` to `orders`
    - Add `cash_received_amount` to `orders`
    - Store how counter payments were collected and how much cash was received
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'counter_payment_method'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN counter_payment_method text
      CHECK (counter_payment_method IN ('cash', 'online'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'cash_received_amount'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN cash_received_amount numeric(10,2);
  END IF;
END $$;
