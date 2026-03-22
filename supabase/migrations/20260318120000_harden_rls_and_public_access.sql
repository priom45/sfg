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
