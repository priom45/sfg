DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'payment_provider'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN payment_provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'razorpay_order_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN razorpay_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'razorpay_payment_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN razorpay_payment_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'razorpay_signature'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN razorpay_signature text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'payment_verified_at'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN payment_verified_at timestamptz;
  END IF;
END $$;
