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
