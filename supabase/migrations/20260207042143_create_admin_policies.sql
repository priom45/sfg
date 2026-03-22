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
