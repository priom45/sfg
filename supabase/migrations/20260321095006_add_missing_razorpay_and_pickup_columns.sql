/*
  # Add missing Razorpay payment and pickup columns to orders

  1. Modified Tables
    - `orders`
      - `payment_provider` (text, nullable) - identifies payment gateway (e.g. razorpay)
      - `razorpay_order_id` (text, nullable) - Razorpay order reference
      - `razorpay_payment_id` (text, nullable) - Razorpay payment reference
      - `razorpay_signature` (text, nullable) - Razorpay verification signature
      - `payment_verified_at` (timestamptz, nullable) - when payment was verified
      - `pickup_option` (text, nullable) - dine_in or takeaway

  2. Important Notes
    - These columns were defined in earlier migration files but not applied to the live database
    - All columns are nullable to avoid breaking existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_provider'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'razorpay_order_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN razorpay_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'razorpay_payment_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN razorpay_payment_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'razorpay_signature'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN razorpay_signature text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_verified_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pickup_option'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN pickup_option text;
  END IF;
END $$;
