-- Auto-generated bootstrap file for a fresh Supabase project
-- Generated from supabase/migrations in chronological order

-- ===============================================
-- BEGIN MIGRATION: 20260207042017_create_categories_table.sql
-- ===============================================

/*
  # Create categories table

  1. New Tables
    - `categories`
      - `id` (uuid, primary key)
      - `name` (text, unique) - category display name
      - `slug` (text, unique) - URL-friendly identifier
      - `image_url` (text) - category image
      - `display_order` (integer) - sort order
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `categories` table
    - Add policy for public read access (anyone can browse menu)
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  image_url text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- END MIGRATION: 20260207042017_create_categories_table.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042034_create_menu_items_table.sql
-- ===============================================

/*
  # Create menu_items table

  1. New Tables
    - `menu_items`
      - `id` (uuid, primary key)
      - `category_id` (uuid, foreign key to categories)
      - `name` (text) - item display name
      - `description` (text) - item description
      - `price` (numeric) - base price
      - `image_url` (text) - item image
      - `prep_time` (integer) - preparation time in minutes
      - `rating` (numeric) - average rating
      - `is_veg` (boolean) - vegetarian flag
      - `is_eggless` (boolean) - eggless flag
      - `is_available` (boolean) - availability toggle
      - `display_order` (integer) - sort order
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `menu_items` table
    - Add policy for public read access
*/

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text NOT NULL DEFAULT '',
  prep_time integer NOT NULL DEFAULT 10,
  rating numeric(2,1) NOT NULL DEFAULT 4.0,
  is_veg boolean NOT NULL DEFAULT false,
  is_eggless boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view menu items"
  ON menu_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- END MIGRATION: 20260207042034_create_menu_items_table.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042039_create_customization_tables.sql
-- ===============================================

/*
  # Create customization tables

  1. New Tables
    - `customization_groups`
      - `id` (uuid, primary key)
      - `name` (text) - group name (Syrups, Toppings, Add-ons)
      - `selection_type` (text) - 'single' or 'multi'
      - `is_required` (boolean)
      - `display_order` (integer)

    - `customization_options`
      - `id` (uuid, primary key)
      - `group_id` (uuid, foreign key)
      - `name` (text) - option name
      - `price` (numeric) - additional price
      - `is_available` (boolean)
      - `display_order` (integer)

  2. Security
    - Enable RLS on both tables
    - Public read access for browsing
*/

CREATE TABLE IF NOT EXISTS customization_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  selection_type text NOT NULL DEFAULT 'multi' CHECK (selection_type IN ('single', 'multi')),
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customization_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view customization groups"
  ON customization_groups
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS customization_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES customization_groups(id),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  preview_image_url text NOT NULL DEFAULT '',
  is_available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customization_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view customization options"
  ON customization_options
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- END MIGRATION: 20260207042039_create_customization_tables.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042054_create_delivery_zones_table.sql
-- ===============================================

/*
  # Create delivery_zones table

  1. New Tables
    - `delivery_zones`
      - `id` (uuid, primary key)
      - `pincode` (text, unique) - delivery area pincode
      - `area_name` (text) - human-readable area name
      - `delivery_fee` (numeric) - fee for this zone
      - `min_order` (numeric) - minimum order amount
      - `estimated_time` (integer) - estimated delivery time in minutes
      - `is_active` (boolean) - zone availability

  2. Security
    - Enable RLS
    - Public read access for zone lookup
*/

CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode text UNIQUE NOT NULL,
  area_name text NOT NULL DEFAULT '',
  delivery_fee numeric(10,2) NOT NULL DEFAULT 30,
  min_order numeric(10,2) NOT NULL DEFAULT 150,
  estimated_time integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view delivery zones"
  ON delivery_zones
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- END MIGRATION: 20260207042054_create_delivery_zones_table.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042058_create_offers_table.sql
-- ===============================================

/*
  # Create offers table

  1. New Tables
    - `offers`
      - `id` (uuid, primary key)
      - `title` (text) - offer headline
      - `description` (text) - offer details
      - `code` (text, unique) - promo code
      - `discount_type` (text) - 'percentage' or 'flat'
      - `discount_value` (numeric) - discount amount
      - `min_order` (numeric) - minimum order for offer
      - `valid_from` (timestamptz)
      - `valid_until` (timestamptz)
      - `is_active` (boolean)

  2. Security
    - Enable RLS
    - Public read for active offers
*/

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offers"
  ON offers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- END MIGRATION: 20260207042058_create_offers_table.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042119_create_orders_and_order_items_tables.sql
-- ===============================================

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

CREATE SEQUENCE IF NOT EXISTS public.order_id_sequence
  AS bigint
  START WITH 1
  INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS text AS $$
BEGIN
  RETURN 'SW-' || nextval('public.order_id_sequence')::text;
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

-- END MIGRATION: 20260207042119_create_orders_and_order_items_tables.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042138_create_contact_messages_table.sql
-- ===============================================

/*
  # Create contact_messages table

  1. New Tables
    - `contact_messages`
      - `id` (uuid, primary key)
      - `name` (text) - sender name
      - `email` (text) - sender email
      - `message` (text) - message content
      - `is_read` (boolean) - admin read status
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anyone can submit a contact message
*/

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- END MIGRATION: 20260207042138_create_contact_messages_table.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042143_create_admin_policies.sql
-- ===============================================

/*
  # Create admin RLS policies

  1. Security
    - Admin users (authenticated) can manage all tables
    - INSERT, UPDATE, DELETE policies for admin operations
    - Uses auth.uid() to verify authenticated admin access

  2. Notes
    - For this MVP, any authenticated user is treated as admin
    - In production, add role-based checks via app_metadata
*/

CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert menu items"
  ON menu_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update menu items"
  ON menu_items FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete menu items"
  ON menu_items FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert customization groups"
  ON customization_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update customization groups"
  ON customization_groups FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete customization groups"
  ON customization_groups FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert customization options"
  ON customization_options FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update customization options"
  ON customization_options FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete customization options"
  ON customization_options FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert delivery zones"
  ON delivery_zones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update delivery zones"
  ON delivery_zones FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete delivery zones"
  ON delivery_zones FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage offers"
  ON offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update offers"
  ON offers FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete offers"
  ON offers FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can view contact messages"
  ON contact_messages FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update contact messages"
  ON contact_messages FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- END MIGRATION: 20260207042143_create_admin_policies.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207042151_enable_realtime_on_orders.sql
-- ===============================================

/*
  # Enable Realtime on orders table

  1. Changes
    - Add orders table to Supabase Realtime publication
    - This allows customers to get live status updates
*/

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- END MIGRATION: 20260207042151_enable_realtime_on_orders.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207043752_create_profiles_and_link_orders.sql
-- ===============================================

/*
  # Create profiles table and link orders to users

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `full_name` (text)
      - `phone` (text)
      - `email` (text)
      - `default_address` (text)
      - `default_pincode` (text)
      - `created_at` (timestamptz)

  2. Modified Tables
    - `orders` - add `user_id` column (nullable uuid, references auth.users)

  3. Security
    - Enable RLS on profiles
    - Users can read and update their own profile
    - Users can view their own orders via user_id

  4. Triggers
    - Auto-create profile on user signup
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  default_address text NOT NULL DEFAULT '',
  default_pincode text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- END MIGRATION: 20260207043752_create_profiles_and_link_orders.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207044739_update_profile_trigger_for_phone.sql
-- ===============================================

/*
  # Update profile trigger to store phone number

  1. Changes
    - Update `handle_new_user()` function to also extract phone number
      from user metadata during sign up
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- END MIGRATION: 20260207044739_update_profile_trigger_for_phone.sql

-- ===============================================
-- BEGIN MIGRATION: 20260207050926_add_estimated_minutes_to_orders.sql
-- ===============================================

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

-- END MIGRATION: 20260207050926_add_estimated_minutes_to_orders.sql

-- ===============================================
-- BEGIN MIGRATION: 20260220141652_replace_menu_with_actual_data.sql
-- ===============================================

/*
  # Replace entire menu with The Supreme Waffel actual menu

  1. Data Changes
    - Delete all existing menu_items
    - Delete all existing categories
    - Delete all existing customization_options and customization_groups
    - Insert 9 new categories:
      - Belgian Waffles, Stick Waffles, Hot Dog Waffle, Cone Waffles,
        Milkshakes, Thick Shakes, Fries, Chicken Momos, Chicken Snacks
    - Insert all menu items with correct prices
    - Insert updated customization groups (Base, Topping, Drizzle)

  2. Notes
    - All waffles are vegetarian
    - Momos and Hot Dog are non-veg
    - Chicken Snacks are non-veg
    - Prices match the official The Supreme Waffel menu
*/

-- Clear existing data (no orders exist)
DELETE FROM customization_options;
DELETE FROM customization_groups;
DELETE FROM menu_items;
DELETE FROM categories;

-- Insert new categories
INSERT INTO categories (id, name, slug, image_url, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000001', 'Belgian Waffles', 'belgian-waffles', 'https://images.pexels.com/photos/2280545/pexels-photo-2280545.jpeg?auto=compress&cs=tinysrgb&w=400', 1),
  ('c0000000-0001-0000-0000-000000000002', 'Stick Waffles', 'stick-waffles', 'https://images.pexels.com/photos/5765/food-sweet-cookies-dessert.jpg?auto=compress&cs=tinysrgb&w=400', 2),
  ('c0000000-0001-0000-0000-000000000003', 'Hot Dog Waffle', 'hot-dog-waffle', 'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=400', 3),
  ('c0000000-0001-0000-0000-000000000004', 'Cone Waffles', 'cone-waffles', 'https://images.pexels.com/photos/1343504/pexels-photo-1343504.jpeg?auto=compress&cs=tinysrgb&w=400', 4),
  ('c0000000-0001-0000-0000-000000000005', 'Milkshakes', 'milkshakes', 'https://images.pexels.com/photos/3727250/pexels-photo-3727250.jpeg?auto=compress&cs=tinysrgb&w=400', 5),
  ('c0000000-0001-0000-0000-000000000006', 'Thick Shakes', 'thick-shakes', 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 6),
  ('c0000000-0001-0000-0000-000000000007', 'Fries', 'fries', 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 7),
  ('c0000000-0001-0000-0000-000000000008', 'Chicken Momos', 'chicken-momos', 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 8),
  ('c0000000-0001-0000-0000-000000000009', 'Chicken Snacks', 'chicken-snacks', 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 9);

-- BELGIAN WAFFLES (Regular base)
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000001', 'Classic Belgian', 'Classic vanilla belgian waffle', 49, 'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.2, true, true, 1),
  ('c0000000-0001-0000-0000-000000000001', 'Dark Fantasy Belgian', 'Rich dark chocolate belgian waffle', 79, 'https://images.pexels.com/photos/2373520/pexels-photo-2373520.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000001', 'White Fantasy Belgian', 'Creamy white chocolate belgian waffle', 79, 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 3),
  ('c0000000-0001-0000-0000-000000000001', 'Milk Fantasy Belgian', 'Smooth milk chocolate belgian waffle', 79, 'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 4),
  ('c0000000-0001-0000-0000-000000000001', 'Dark & Milk Belgian', 'Dark and milk chocolate combo', 89, 'https://images.pexels.com/photos/1055270/pexels-photo-1055270.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 5),
  ('c0000000-0001-0000-0000-000000000001', 'Dark & White Belgian', 'Dark and white chocolate combo', 89, 'https://images.pexels.com/photos/2280545/pexels-photo-2280545.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 6),
  ('c0000000-0001-0000-0000-000000000001', 'Triple Chocolate Belgian', 'All three chocolates in one waffle', 109, 'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 7),
  ('c0000000-0001-0000-0000-000000000001', 'Crunchy Oreo Belgian', 'Loaded with crushed Oreo cookies', 129, 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 8),
  ('c0000000-0001-0000-0000-000000000001', 'KitKat Belgian', 'Topped with KitKat chunks', 129, 'https://images.pexels.com/photos/2541310/pexels-photo-2541310.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 9),
  ('c0000000-0001-0000-0000-000000000001', 'Nutella Belgian', 'Generous Nutella spread', 139, 'https://images.pexels.com/photos/3026804/pexels-photo-3026804.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.9, true, true, 10),
  ('c0000000-0001-0000-0000-000000000001', 'Snickers Belgian', 'Loaded with Snickers pieces', 149, 'https://images.pexels.com/photos/3185509/pexels-photo-3185509.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 11);

-- STICK WAFFLES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000002', 'Classic Stick', 'Classic vanilla stick waffle', 59, 'https://images.pexels.com/photos/5765/food-sweet-cookies-dessert.jpg?auto=compress&cs=tinysrgb&w=400', 5, 4.2, true, true, 1),
  ('c0000000-0001-0000-0000-000000000002', 'Dark Fantasy Stick', 'Rich dark chocolate stick waffle', 89, 'https://images.pexels.com/photos/2373520/pexels-photo-2373520.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000002', 'White Fantasy Stick', 'Creamy white chocolate stick waffle', 89, 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 3),
  ('c0000000-0001-0000-0000-000000000002', 'Milk Fantasy Stick', 'Smooth milk chocolate stick waffle', 89, 'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 4),
  ('c0000000-0001-0000-0000-000000000002', 'Dark & Milk Stick', 'Dark and milk chocolate combo stick', 99, 'https://images.pexels.com/photos/1055270/pexels-photo-1055270.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 5),
  ('c0000000-0001-0000-0000-000000000002', 'Dark & White Stick', 'Dark and white chocolate combo stick', 99, 'https://images.pexels.com/photos/2280545/pexels-photo-2280545.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 6),
  ('c0000000-0001-0000-0000-000000000002', 'Triple Chocolate Stick', 'All three chocolates stick waffle', 119, 'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 7),
  ('c0000000-0001-0000-0000-000000000002', 'Crunchy Oreo Stick', 'Loaded with Oreo cookies stick', 139, 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 8),
  ('c0000000-0001-0000-0000-000000000002', 'KitKat Stick', 'KitKat chunks on stick waffle', 139, 'https://images.pexels.com/photos/2541310/pexels-photo-2541310.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 9),
  ('c0000000-0001-0000-0000-000000000002', 'Nutella Stick', 'Nutella spread stick waffle', 149, 'https://images.pexels.com/photos/3026804/pexels-photo-3026804.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.9, true, true, 10),
  ('c0000000-0001-0000-0000-000000000002', 'Snickers Stick', 'Snickers loaded stick waffle', 159, 'https://images.pexels.com/photos/3185509/pexels-photo-3185509.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 11);

-- HOT DOG WAFFLE
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000003', 'Hot Dog Waffle', 'Waffle wrapped chicken sausage', 189, 'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.6, false, true, 1);

-- CONE WAFFLES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000004', 'Vanilla Cone Waffle', 'Waffle cone with vanilla ice cream', 59, 'https://images.pexels.com/photos/1343504/pexels-photo-1343504.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 1),
  ('c0000000-0001-0000-0000-000000000004', 'Chocolate Cone Waffle', 'Waffle cone with chocolate ice cream', 69, 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000004', 'Black Currant Cone Waffle', 'Waffle cone with black currant ice cream', 89, 'https://images.pexels.com/photos/1352296/pexels-photo-1352296.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 3),
  ('c0000000-0001-0000-0000-000000000004', 'Black Forest Cone Waffle', 'Waffle cone with black forest ice cream', 89, 'https://images.pexels.com/photos/1362534/pexels-photo-1362534.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 4),
  ('c0000000-0001-0000-0000-000000000004', 'Choco Brownie Cone Waffle', 'Waffle cone with choco brownie ice cream', 99, 'https://images.pexels.com/photos/2144112/pexels-photo-2144112.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.7, true, true, 5);

-- MILKSHAKES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000005', 'Vanilla Milkshake', 'Creamy vanilla milkshake', 79, 'https://images.pexels.com/photos/3727250/pexels-photo-3727250.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.2, true, true, 1),
  ('c0000000-0001-0000-0000-000000000005', 'Chocolate Milkshake', 'Rich chocolate milkshake', 89, 'https://images.pexels.com/photos/3026810/pexels-photo-3026810.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000005', 'Oreo Milkshake', 'Oreo cookie milkshake', 99, 'https://images.pexels.com/photos/3727249/pexels-photo-3727249.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 3),
  ('c0000000-0001-0000-0000-000000000005', 'KitKat Milkshake', 'KitKat blended milkshake', 99, 'https://images.pexels.com/photos/2551177/pexels-photo-2551177.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 4),
  ('c0000000-0001-0000-0000-000000000005', 'Dark Fantasy Milkshake', 'Dark Fantasy cookie milkshake', 109, 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.7, true, true, 5);

-- THICK SHAKES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000006', 'Vanilla Thick Shake', 'Thick creamy vanilla shake', 89, 'https://images.pexels.com/photos/3727250/pexels-photo-3727250.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 1),
  ('c0000000-0001-0000-0000-000000000006', 'Chocolate Thick Shake', 'Thick rich chocolate shake', 99, 'https://images.pexels.com/photos/3026810/pexels-photo-3026810.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 2),
  ('c0000000-0001-0000-0000-000000000006', 'Oreo Thick Shake', 'Thick Oreo cookie shake', 109, 'https://images.pexels.com/photos/3727249/pexels-photo-3727249.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.7, true, true, 3),
  ('c0000000-0001-0000-0000-000000000006', 'KitKat Thick Shake', 'Thick KitKat blended shake', 109, 'https://images.pexels.com/photos/2551177/pexels-photo-2551177.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 4),
  ('c0000000-0001-0000-0000-000000000006', 'Dark Fantasy Thick Shake', 'Thick Dark Fantasy cookie shake', 119, 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.8, true, true, 5);

-- FRIES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000007', 'French Fries - Regular', 'Crispy french fries (80g)', 49, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 1),
  ('c0000000-0001-0000-0000-000000000007', 'French Fries - Medium', 'Crispy french fries (110g)', 89, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 2),
  ('c0000000-0001-0000-0000-000000000007', 'French Fries - Large', 'Crispy french fries (160g)', 129, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 3),
  ('c0000000-0001-0000-0000-000000000007', 'Peri Peri Fries - Regular', 'Spicy peri peri fries (80g)', 59, 'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 4),
  ('c0000000-0001-0000-0000-000000000007', 'Peri Peri Fries - Medium', 'Spicy peri peri fries (110g)', 99, 'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 5),
  ('c0000000-0001-0000-0000-000000000007', 'Peri Peri Fries - Large', 'Spicy peri peri fries (160g)', 129, 'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 6);

-- CHICKEN MOMOS
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000008', 'Schezwan Momos - 4 pcs', 'Spicy schezwan chicken momos', 79, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.5, false, true, 1),
  ('c0000000-0001-0000-0000-000000000008', 'Schezwan Momos - 6 pcs', 'Spicy schezwan chicken momos', 99, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 10, 4.5, false, true, 2),
  ('c0000000-0001-0000-0000-000000000008', 'Schezwan Momos - 8 pcs', 'Spicy schezwan chicken momos', 119, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.5, false, true, 3),
  ('c0000000-0001-0000-0000-000000000008', 'Fried Momos - 4 pcs', 'Crispy fried chicken momos', 69, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.4, false, true, 4),
  ('c0000000-0001-0000-0000-000000000008', 'Fried Momos - 6 pcs', 'Crispy fried chicken momos', 89, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 10, 4.4, false, true, 5),
  ('c0000000-0001-0000-0000-000000000008', 'Fried Momos - 8 pcs', 'Crispy fried chicken momos', 109, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.4, false, true, 6),
  ('c0000000-0001-0000-0000-000000000008', 'Kurkure Momos - 4 pcs', 'Crunchy kurkure coated chicken momos', 89, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.6, false, true, 7),
  ('c0000000-0001-0000-0000-000000000008', 'Kurkure Momos - 6 pcs', 'Crunchy kurkure coated chicken momos', 109, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 10, 4.6, false, true, 8),
  ('c0000000-0001-0000-0000-000000000008', 'Kurkure Momos - 8 pcs', 'Crunchy kurkure coated chicken momos', 129, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.6, false, true, 9),
  ('c0000000-0001-0000-0000-000000000008', 'Momos Platter - Regular', '6 pcs (2 Schezwan + 2 Fried + 2 Kurkure)', 109, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.7, false, true, 10),
  ('c0000000-0001-0000-0000-000000000008', 'Momos Platter - Medium', '8 pcs (2 Schezwan + 4 Fried + 2 Kurkure)', 129, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 14, 4.7, false, true, 11),
  ('c0000000-0001-0000-0000-000000000008', 'Momos Platter - Large', '10 pcs (4 Fried + 4 Kurkure + 2 Schezwan)', 149, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 16, 4.8, false, true, 12);

-- CHICKEN SNACKS
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000009', 'Chicken Nuggets', 'Crispy chicken nuggets (8 pcs)', 99, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.4, false, true, 1),
  ('c0000000-0001-0000-0000-000000000009', 'Chicken Popcorn', 'Bite-sized crispy chicken popcorn', 149, 'https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.6, false, true, 2);

-- CUSTOMIZATION GROUPS
INSERT INTO customization_groups (id, name, selection_type, is_required, display_order) VALUES
  ('d0000000-0001-0000-0000-000000000001', 'Base', 'single', false, 1),
  ('d0000000-0001-0000-0000-000000000002', 'Topping', 'multi', false, 2),
  ('d0000000-0001-0000-0000-000000000003', 'Drizzle', 'single', false, 3);

-- CUSTOMIZATION OPTIONS
INSERT INTO customization_options (group_id, name, price, is_available, display_order) VALUES
  -- Base options
  ('d0000000-0001-0000-0000-000000000001', 'Regular (Vanilla)', 0, true, 1),
  ('d0000000-0001-0000-0000-000000000001', 'Choco (Chocolate)', 0, true, 2),
  -- Topping options
  ('d0000000-0001-0000-0000-000000000002', 'Whipped Cream', 30, true, 1),
  ('d0000000-0001-0000-0000-000000000002', 'Chocolate Chips', 40, true, 2),
  ('d0000000-0001-0000-0000-000000000002', 'Crushed Oreo', 40, true, 3),
  ('d0000000-0001-0000-0000-000000000002', 'Fresh Fruits', 50, true, 4),
  ('d0000000-0001-0000-0000-000000000002', 'Chopped Nuts', 35, true, 5),
  -- Drizzle options
  ('d0000000-0001-0000-0000-000000000003', 'Chocolate Sauce', 25, true, 1),
  ('d0000000-0001-0000-0000-000000000003', 'Caramel Sauce', 25, true, 2),
  ('d0000000-0001-0000-0000-000000000003', 'Maple Syrup', 20, true, 3);

-- END MIGRATION: 20260220141652_replace_menu_with_actual_data.sql

-- ===============================================
-- BEGIN MIGRATION: 20260222112046_add_chef_role_and_queue_position.sql
-- ===============================================

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

-- END MIGRATION: 20260222112046_add_chef_role_and_queue_position.sql

-- ===============================================
-- BEGIN MIGRATION: 20260223045907_add_queue_position_to_orders.sql
-- ===============================================

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

-- END MIGRATION: 20260223045907_add_queue_position_to_orders.sql

-- ===============================================
-- BEGIN MIGRATION: 20260223142623_update_handle_new_user_for_phone_auth.sql
-- ===============================================

/*
  # Update handle_new_user trigger for phone-based OTP auth

  1. Changes
    - Update `handle_new_user()` function to extract phone number from
      `auth.users.phone` field (used by Supabase Phone Auth / Twilio)
    - Falls back to `raw_user_meta_data->>'phone'` for backwards compatibility
    - Strips +91 country code prefix when storing phone number

  2. Notes
    - Supabase Phone Auth stores the full international number (e.g., +919876543210)
      in `auth.users.phone`, NOT in `raw_user_meta_data`
    - We strip the +91 prefix so profiles.phone stores just the 10-digit number
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  phone_val text;
BEGIN
  phone_val := COALESCE(
    REGEXP_REPLACE(NEW.phone, '^\+91', ''),
    NEW.raw_user_meta_data->>'phone',
    ''
  );

  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    phone_val,
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone
  WHERE public.profiles.phone = '' OR public.profiles.phone IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- END MIGRATION: 20260223142623_update_handle_new_user_for_phone_auth.sql

-- ===============================================
-- BEGIN MIGRATION: 20260314145000_update_menu_images_from_spreadsheet.sql
-- ===============================================

/*
  # Update menu item images from the provided Supreme Waffle spreadsheet

  1. Data Changes
    - Replace existing menu item image URLs with the Cloudinary URLs from `supreme waffle.xlsx`
    - Preserve current pricing, descriptions, and category assignments

  2. Notes
    - The workbook also contains `red velvet waffle`, `sweet dog waffle`, `burger`, and `burger 1+1`
      image rows, but those products do not exist in the current menu seed and the workbook does not
      include their category or price data. They are intentionally not inserted here.
*/

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773388546/classic_waffle_w70izl.png'
WHERE name IN ('Classic Belgian', 'Classic Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773388626/dark_fantasy_waffle_iajnh3.png'
WHERE name IN ('Dark Fantasy Belgian', 'Dark Fantasy Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773388756/white_fantasy_waffle_b8hdgd.png'
WHERE name IN ('White Fantasy Belgian', 'White Fantasy Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391183/milk_fantasy_waffle_umpyxo.png'
WHERE name IN ('Milk Fantasy Belgian', 'Milk Fantasy Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391044/dark_milk_hytgnq.png'
WHERE name IN ('Dark & Milk Belgian', 'Dark & Milk Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391053/dark_white_ggjjxz.png'
WHERE name IN ('Dark & White Belgian', 'Dark & White Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391074/triple_chocolate_hkkygm.png'
WHERE name IN ('Triple Chocolate Belgian', 'Triple Chocolate Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391268/crunchy_oreo_z5kehx.png'
WHERE name IN ('Crunchy Oreo Belgian', 'Crunchy Oreo Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391310/kitkat_waffle_xrfoan.png'
WHERE name IN ('KitKat Belgian', 'KitKat Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391357/snickers_waffle_bdd9zl.png'
WHERE name IN ('Snickers Belgian', 'Snickers Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391442/hot_dog_waffle_ts7f5c.png'
WHERE name = 'Hot Dog Waffle';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391485/french_fries_lqgnib.png'
WHERE name IN (
  'French Fries - Regular',
  'French Fries - Medium',
  'French Fries - Large',
  'Peri Peri Fries - Regular',
  'Peri Peri Fries - Medium',
  'Peri Peri Fries - Large'
);

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391666/fried_momos_ouefsr.png'
WHERE name IN ('Fried Momos - 4 pcs', 'Fried Momos - 6 pcs', 'Fried Momos - 8 pcs');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391675/kurkure_momos_yqhjto.png'
WHERE name IN ('Kurkure Momos - 4 pcs', 'Kurkure Momos - 6 pcs', 'Kurkure Momos - 8 pcs');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391702/small_platter_oulf5j.png'
WHERE name = 'Momos Platter - Regular';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391712/med_platter_vrgf3u.png'
WHERE name = 'Momos Platter - Medium';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391720/large_platter_g8y7he.png'
WHERE name = 'Momos Platter - Large';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391773/nuggets_cilfj0.png'
WHERE name = 'Chicken Nuggets';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391778/chicken_popcorn_bjufdx.png'
WHERE name = 'Chicken Popcorn';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392170/vanila_ouln1u.png'
WHERE name = 'Vanilla Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392170/vanila_ouln1u.png'
WHERE name = 'Vanilla Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392173/chocolate_xwvnae.png'
WHERE name = 'Chocolate Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392173/chocolate_xwvnae.png'
WHERE name = 'Chocolate Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392182/oreo_uc5lid.png'
WHERE name = 'Oreo Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392182/oreo_uc5lid.png'
WHERE name = 'Oreo Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'KitKat Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'KitKat Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'Dark Fantasy Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'Dark Fantasy Thick Shake';

-- END MIGRATION: 20260314145000_update_menu_images_from_spreadsheet.sql

-- ===============================================
-- BEGIN MIGRATION: 20260318120000_harden_rls_and_public_access.sql
-- ===============================================

/*
  # Harden RLS and remove public access leaks

  1. Adds helper functions for role checks
  2. Replaces permissive admin policies with role-aware versions
  3. Restricts orders and order_items to owners or staff
  4. Limits public reads to currently valid customer-facing records
*/

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN ('admin', 'chef');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() = 'admin';
$$;

DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

CREATE POLICY "Public can view categories"
  ON categories FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Admins can delete menu items" ON menu_items;

CREATE POLICY "Customers can view available menu items"
  ON menu_items FOR SELECT TO anon, authenticated
  USING (is_available = true OR public.is_staff());

CREATE POLICY "Admins can insert menu items"
  ON menu_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update menu items"
  ON menu_items FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete menu items"
  ON menu_items FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view customization groups" ON customization_groups;
DROP POLICY IF EXISTS "Admins can insert customization groups" ON customization_groups;
DROP POLICY IF EXISTS "Admins can update customization groups" ON customization_groups;
DROP POLICY IF EXISTS "Admins can delete customization groups" ON customization_groups;

CREATE POLICY "Public can view customization groups"
  ON customization_groups FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert customization groups"
  ON customization_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update customization groups"
  ON customization_groups FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete customization groups"
  ON customization_groups FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view customization options" ON customization_options;
DROP POLICY IF EXISTS "Admins can insert customization options" ON customization_options;
DROP POLICY IF EXISTS "Admins can update customization options" ON customization_options;
DROP POLICY IF EXISTS "Admins can delete customization options" ON customization_options;

CREATE POLICY "Customers can view available customization options"
  ON customization_options FOR SELECT TO anon, authenticated
  USING (is_available = true OR public.is_staff());

CREATE POLICY "Admins can insert customization options"
  ON customization_options FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update customization options"
  ON customization_options FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete customization options"
  ON customization_options FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view delivery zones" ON delivery_zones;
DROP POLICY IF EXISTS "Admins can insert delivery zones" ON delivery_zones;
DROP POLICY IF EXISTS "Admins can update delivery zones" ON delivery_zones;
DROP POLICY IF EXISTS "Admins can delete delivery zones" ON delivery_zones;

CREATE POLICY "Customers can view active delivery zones"
  ON delivery_zones FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_staff());

CREATE POLICY "Admins can insert delivery zones"
  ON delivery_zones FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update delivery zones"
  ON delivery_zones FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete delivery zones"
  ON delivery_zones FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view active offers" ON offers;
DROP POLICY IF EXISTS "Admins can manage offers" ON offers;
DROP POLICY IF EXISTS "Admins can update offers" ON offers;
DROP POLICY IF EXISTS "Admins can delete offers" ON offers;

CREATE POLICY "Customers can view valid active offers"
  ON offers FOR SELECT TO anon, authenticated
  USING (
    (
      is_active = true
      AND valid_from <= now()
      AND valid_until >= now()
    )
    OR public.is_staff()
  );

CREATE POLICY "Admins can insert offers"
  ON offers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update offers"
  ON offers FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete offers"
  ON offers FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Anyone can place orders" ON orders;
DROP POLICY IF EXISTS "Anyone can view orders by order_id" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Chefs can update orders" ON orders;

CREATE POLICY "Customers can place own orders"
  ON orders FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR auth.uid() = user_id
    OR public.is_staff()
  );

CREATE POLICY "Order owners and staff can view orders"
  ON orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff());

CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Anyone can insert order items" ON order_items;
DROP POLICY IF EXISTS "Anyone can view order items" ON order_items;
DROP POLICY IF EXISTS "Chefs can view all orders" ON order_items;

CREATE POLICY "Order owners can insert order items"
  ON order_items FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM orders
      WHERE orders.id = order_items.order_id
        AND (
          (auth.uid() IS NULL AND orders.user_id IS NULL)
          OR orders.user_id = auth.uid()
          OR public.is_staff()
        )
    )
  );

CREATE POLICY "Order owners and staff can view order items"
  ON order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM orders
      WHERE orders.id = order_items.order_id
        AND (orders.user_id = auth.uid() OR public.is_staff())
    )
  );

DROP POLICY IF EXISTS "Admins can view contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can update contact messages" ON contact_messages;

CREATE POLICY "Admins can view contact messages"
  ON contact_messages FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update contact messages"
  ON contact_messages FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- END MIGRATION: 20260318120000_harden_rls_and_public_access.sql

-- ===============================================
-- BEGIN MIGRATION: 20260318143000_grant_public_schema_privileges.sql
-- ===============================================

/*
  # Grant public schema privileges for Supabase client roles

  Running raw SQL migrations in a fresh project can leave tables/functions
  without the grants that PostgREST expects for anon/authenticated clients.
  This migration aligns grants for existing and future objects.
*/

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- END MIGRATION: 20260318143000_grant_public_schema_privileges.sql

-- ===============================================
-- BEGIN MIGRATION: 20260318150000_seed_homepage_offers.sql
-- ===============================================

/*
  # Seed homepage offers for carousel display

  1. Deactivates any previous active offers so the homepage shows a clean set
  2. Upserts four active offers with valid date windows
*/

UPDATE offers
SET is_active = false;

INSERT INTO offers (
  title,
  description,
  code,
  discount_type,
  discount_value,
  min_order,
  valid_from,
  valid_until,
  is_active
) VALUES
  (
    'Weekend Special',
    'Get flat discount on orders above Rs.499',
    'WEEKEND20',
    'percentage',
    20,
    499,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  ),
  (
    'Waffle Combo Deal',
    'Save more when you order two signature waffles together',
    'COMBO149',
    'flat',
    149,
    699,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  ),
  (
    'Shake Add-On Offer',
    'Add any milkshake with your waffle order and save instantly',
    'SHAKE99',
    'flat',
    99,
    399,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  ),
  (
    'Midnight Craving',
    'Late-night sweet craving? Grab a fresh discount before checkout',
    'NIGHT15',
    'percentage',
    15,
    299,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  )
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  min_order = EXCLUDED.min_order,
  valid_from = EXCLUDED.valid_from,
  valid_until = EXCLUDED.valid_until,
  is_active = EXCLUDED.is_active;

-- END MIGRATION: 20260318150000_seed_homepage_offers.sql

-- ===============================================
-- BEGIN MIGRATION: 20260319113000_add_pickup_option_to_orders.sql
-- ===============================================

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

-- END MIGRATION: 20260319113000_add_pickup_option_to_orders.sql

-- ===============================================
-- BEGIN MIGRATION: 20260321095006_add_missing_razorpay_and_pickup_columns.sql
-- ===============================================

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

-- END MIGRATION: 20260321095006_add_missing_razorpay_and_pickup_columns.sql

-- ===============================================
-- BEGIN MIGRATION: 20260321123000_add_razorpay_payment_fields_to_orders.sql
-- ===============================================

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

-- END MIGRATION: 20260321123000_add_razorpay_payment_fields_to_orders.sql

-- ===============================================
-- BEGIN MIGRATION: 20260321143000_extend_offers_for_rule_based_promotions.sql
-- ===============================================

ALTER TABLE offers
  ALTER COLUMN code DROP NOT NULL;

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_discount_type_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_discount_type_check
  CHECK (discount_type IN ('percentage', 'flat', 'free_addons'));

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offer_mode text NOT NULL DEFAULT 'coupon',
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'min_order',
  ADD COLUMN IF NOT EXISTS required_item_quantity integer;

UPDATE offers
SET
  offer_mode = COALESCE(offer_mode, 'coupon'),
  trigger_type = COALESCE(trigger_type, 'min_order')
WHERE offer_mode IS NULL OR trigger_type IS NULL;

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_offer_mode_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_offer_mode_check
  CHECK (offer_mode IN ('coupon', 'automatic'));

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_trigger_type_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_trigger_type_check
  CHECK (trigger_type IN ('min_order', 'item_quantity'));

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_required_item_quantity_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_required_item_quantity_check
  CHECK (required_item_quantity IS NULL OR required_item_quantity >= 1);

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_coupon_code_required_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_coupon_code_required_check
  CHECK (
    offer_mode = 'automatic'
    OR (code IS NOT NULL AND btrim(code) <> '')
  );

-- END MIGRATION: 20260321143000_extend_offers_for_rule_based_promotions.sql

-- ===============================================
-- BEGIN MIGRATION: 20260321153000_add_site_settings_and_closure_gate.sql
-- ===============================================

CREATE TABLE IF NOT EXISTS site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  site_is_open boolean NOT NULL DEFAULT true,
  closure_title text NOT NULL DEFAULT 'We are currently closed',
  closure_message text NOT NULL DEFAULT 'Ordering is temporarily unavailable right now.',
  reopening_text text NOT NULL DEFAULT 'We will open again soon.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can update site settings" ON site_settings;

CREATE POLICY "Public can view site settings"
  ON site_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert site settings"
  ON site_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update site settings"
  ON site_settings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.website_is_open()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT site_is_open FROM public.site_settings WHERE id = true),
    true
  );
$$;

DROP POLICY IF EXISTS "Customers can place own orders" ON orders;

CREATE POLICY "Customers can place own orders"
  ON orders FOR INSERT TO anon, authenticated
  WITH CHECK (
    (
      public.website_is_open()
      AND (
        (auth.uid() IS NULL AND user_id IS NULL)
        OR auth.uid() = user_id
      )
    )
    OR public.is_staff()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE site_settings;

-- END MIGRATION: 20260321153000_add_site_settings_and_closure_gate.sql

-- ===============================================
-- BEGIN MIGRATION: 20260324120000_add_takeaway_fee_to_orders.sql
-- ===============================================

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

-- END MIGRATION: 20260324120000_add_takeaway_fee_to_orders.sql

-- ===============================================
-- BEGIN MIGRATION: 20260330120000_add_display_fields_to_offers.sql
-- ===============================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS display_badge text,
  ADD COLUMN IF NOT EXISTS display_reward text,
  ADD COLUMN IF NOT EXISTS is_cart_eligible boolean NOT NULL DEFAULT true;

UPDATE offers
SET is_cart_eligible = true
WHERE is_cart_eligible IS NULL;

-- END MIGRATION: 20260330120000_add_display_fields_to_offers.sql

-- ===============================================
-- BEGIN MIGRATION: 20260330123000_add_background_image_to_offers.sql
-- ===============================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS background_image_url text;

-- END MIGRATION: 20260330123000_add_background_image_to_offers.sql
