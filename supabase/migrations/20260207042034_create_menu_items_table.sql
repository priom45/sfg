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
