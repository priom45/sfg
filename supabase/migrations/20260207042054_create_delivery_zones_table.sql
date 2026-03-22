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
