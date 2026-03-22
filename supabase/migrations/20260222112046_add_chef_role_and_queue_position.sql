/*
  # Add chef role to profiles and queue_position to orders

  1. Modified Tables
    - `profiles`
      - `role` (text, default 'customer') - 'customer', 'chef', 'admin'
    - `orders`
      - `accepted_at` (timestamptz, nullable) - when chef accepted the order
      - `completed_at` (timestamptz, nullable) - when chef marked order ready

  2. Security
    - Chefs can view all orders
    - Chefs can update order status

  3. Notes
    - Existing flow: pending -> confirmed -> preparing -> packed -> delivered
    - Chef flow: pending orders appear in queue, chef accepts (sets confirmed + preparing),
      chef completes (sets packed/ready)
    - The estimated_minutes column already exists on orders
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'chef', 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN accepted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

CREATE POLICY "Chefs can update orders"
  ON orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('chef', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('chef', 'admin')
    )
  );

CREATE POLICY "Chefs can view all orders"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('chef', 'admin')
    )
  );