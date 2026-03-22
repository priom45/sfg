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
