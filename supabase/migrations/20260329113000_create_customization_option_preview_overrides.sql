/*
  # Create customization option preview overrides

  1. New table
    - `customization_option_preview_overrides`
    - Stores category-specific preview images for shared add-on options

  2. Security
    - Public read access
    - Admin CRUD access
*/

CREATE TABLE IF NOT EXISTS customization_option_preview_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
  option_name text NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  preview_image_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customization_option_preview_overrides_group_option_category_idx
  ON customization_option_preview_overrides(group_id, option_name, category_id);

ALTER TABLE customization_option_preview_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view customization option preview overrides" ON customization_option_preview_overrides;
DROP POLICY IF EXISTS "Admins can insert customization option preview overrides" ON customization_option_preview_overrides;
DROP POLICY IF EXISTS "Admins can update customization option preview overrides" ON customization_option_preview_overrides;
DROP POLICY IF EXISTS "Admins can delete customization option preview overrides" ON customization_option_preview_overrides;

CREATE POLICY "Public can view customization option preview overrides"
  ON customization_option_preview_overrides FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert customization option preview overrides"
  ON customization_option_preview_overrides FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update customization option preview overrides"
  ON customization_option_preview_overrides FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete customization option preview overrides"
  ON customization_option_preview_overrides FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
