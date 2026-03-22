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
