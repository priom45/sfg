/*
  # Create customization group targets

  1. New table
    - `customization_group_targets`
    - Assigns a customization group to either a category or a specific menu item

  2. Security
    - Public read access
    - Admin CRUD access

  3. Backfill
    - Attach existing add-on groups to the sweet waffle and shake categories
*/

CREATE TABLE IF NOT EXISTS customization_group_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customization_group_targets_single_target_check CHECK (
    (category_id IS NOT NULL AND menu_item_id IS NULL)
    OR (category_id IS NULL AND menu_item_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS customization_group_targets_group_category_idx
  ON customization_group_targets(group_id, category_id)
  WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customization_group_targets_group_item_idx
  ON customization_group_targets(group_id, menu_item_id)
  WHERE menu_item_id IS NOT NULL;

ALTER TABLE customization_group_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view customization group targets" ON customization_group_targets;
DROP POLICY IF EXISTS "Admins can insert customization group targets" ON customization_group_targets;
DROP POLICY IF EXISTS "Admins can update customization group targets" ON customization_group_targets;
DROP POLICY IF EXISTS "Admins can delete customization group targets" ON customization_group_targets;

CREATE POLICY "Public can view customization group targets"
  ON customization_group_targets FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert customization group targets"
  ON customization_group_targets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update customization group targets"
  ON customization_group_targets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete customization group targets"
  ON customization_group_targets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

INSERT INTO customization_group_targets (group_id, category_id)
VALUES
  ('d0000000-0001-0000-0000-000000000001', 'c0000000-0001-0000-0000-000000000001'),
  ('d0000000-0001-0000-0000-000000000002', 'c0000000-0001-0000-0000-000000000001'),
  ('d0000000-0001-0000-0000-000000000003', 'c0000000-0001-0000-0000-000000000001'),
  ('d0000000-0001-0000-0000-000000000001', 'c0000000-0001-0000-0000-000000000002'),
  ('d0000000-0001-0000-0000-000000000002', 'c0000000-0001-0000-0000-000000000002'),
  ('d0000000-0001-0000-0000-000000000003', 'c0000000-0001-0000-0000-000000000002'),
  ('d0000000-0001-0000-0000-000000000001', 'c0000000-0001-0000-0000-000000000004'),
  ('d0000000-0001-0000-0000-000000000002', 'c0000000-0001-0000-0000-000000000004'),
  ('d0000000-0001-0000-0000-000000000003', 'c0000000-0001-0000-0000-000000000004'),
  ('d0000000-0001-0000-0000-000000000001', 'c0000000-0001-0000-0000-000000000005'),
  ('d0000000-0001-0000-0000-000000000002', 'c0000000-0001-0000-0000-000000000005'),
  ('d0000000-0001-0000-0000-000000000003', 'c0000000-0001-0000-0000-000000000005'),
  ('d0000000-0001-0000-0000-000000000001', 'c0000000-0001-0000-0000-000000000006'),
  ('d0000000-0001-0000-0000-000000000002', 'c0000000-0001-0000-0000-000000000006'),
  ('d0000000-0001-0000-0000-000000000003', 'c0000000-0001-0000-0000-000000000006')
ON CONFLICT DO NOTHING;
