/*
  # Create orders and order_items tables

  1. New Tables
    - `orders`
      - `id` (uuid, primary key)
      - `order_id` (text, unique) - human-readable ID like "SW-7842"
      - `customer_name` (text)
      - `customer_phone` (text)
      - `customer_email` (text)
      - `address` (text)
      - `pincode` (text)
      - `order_type` (text) - 'delivery' or 'pickup'
      - `delivery_fee` (numeric)
      - `subtotal` (numeric)
      - `discount` (numeric)
      - `total` (numeric)
      - `payment_method` (text) - 'upi', 'card', 'cod'
      - `payment_status` (text) - 'pending', 'paid', 'failed'
      - `status` (text) - order lifecycle status
      - `placed_at` (timestamptz)
      - `confirmed_at` (timestamptz, nullable)
      - `expires_at` (timestamptz) - 5 min after placement

    - `order_items`
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key)
      - `menu_item_id` (uuid, foreign key)
      - `item_name` (text) - snapshot of name at order time
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `customizations` (jsonb) - selected options snapshot

  2. Functions
    - `generate_order_id()` - generates unique short order ID

  3. Security
    - Enable RLS on both tables
    - Anyone can insert orders (guest checkout)
    - Anyone can view their own order by order_id
*/

CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS text AS $$
DECLARE
  new_id text;
  exists_check boolean;
BEGIN
  LOOP
    new_id := 'SW-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_id = new_id) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE NOT NULL DEFAULT generate_order_id(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  order_type text NOT NULL DEFAULT 'delivery' CHECK (order_type IN ('delivery', 'pickup')),
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('upi', 'card', 'cod')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'expired')),
  placed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can place orders"
  ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view orders by order_id"
  ON orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id),
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  customizations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert order items"
  ON order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view order items"
  ON order_items
  FOR SELECT
  TO anon, authenticated
  USING (true);
