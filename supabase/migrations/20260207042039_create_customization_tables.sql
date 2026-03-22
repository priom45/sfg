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
