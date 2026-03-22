/*
  # Secure SMTP password and create public-safe view

  1. Changes
    - Create `site_settings_public` view that excludes `smtp_pass` column
    - Drop the existing overly-permissive public SELECT policy on `site_settings`
    - Replace with a new SELECT policy restricted to admin users only
    - Grant SELECT on the new view to `anon` and `authenticated` roles
    - Create an RPC `save_smtp_settings` for admins to upsert SMTP config including password

  2. Security
    - SMTP password is no longer readable by public or authenticated users via `site_settings`
    - Only edge functions using service role can read `smtp_pass` from the table directly
    - Admin users save SMTP settings through a secure RPC function
    - Public/authenticated users read site settings through the safe view

  3. Important Notes
    - Frontend code must be updated to query `site_settings_public` view instead of `site_settings` table
    - The admin panel save SMTP flow must call the `save_smtp_settings` RPC
*/

-- Create a public-safe view excluding smtp_pass
CREATE OR REPLACE VIEW site_settings_public AS
SELECT
  id,
  site_is_open,
  closure_title,
  closure_message,
  reopening_text,
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_from_email,
  smtp_from_name,
  created_at,
  updated_at
FROM site_settings;

-- Grant access to the view
GRANT SELECT ON site_settings_public TO anon, authenticated;

-- Drop the dangerous public SELECT policy
DROP POLICY IF EXISTS "Public can view site settings" ON site_settings;

-- Create a restrictive SELECT policy - only admins can read the full table (including password)
CREATE POLICY "Only admins can read site_settings"
  ON site_settings
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Create an RPC function for admins to save SMTP settings
CREATE OR REPLACE FUNCTION save_smtp_settings(
  p_smtp_host text,
  p_smtp_port integer,
  p_smtp_user text,
  p_smtp_pass text DEFAULT NULL,
  p_smtp_from_email text DEFAULT '',
  p_smtp_from_name text DEFAULT 'The Supreme Waffle'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_smtp_pass IS NOT NULL AND p_smtp_pass <> '' THEN
    UPDATE site_settings SET
      smtp_host = p_smtp_host,
      smtp_port = p_smtp_port,
      smtp_user = p_smtp_user,
      smtp_pass = p_smtp_pass,
      smtp_from_email = COALESCE(NULLIF(p_smtp_from_email, ''), p_smtp_user),
      smtp_from_name = COALESCE(NULLIF(p_smtp_from_name, ''), 'The Supreme Waffle'),
      updated_at = now()
    WHERE id = true;
  ELSE
    UPDATE site_settings SET
      smtp_host = p_smtp_host,
      smtp_port = p_smtp_port,
      smtp_user = p_smtp_user,
      smtp_from_email = COALESCE(NULLIF(p_smtp_from_email, ''), p_smtp_user),
      smtp_from_name = COALESCE(NULLIF(p_smtp_from_name, ''), 'The Supreme Waffle'),
      updated_at = now()
    WHERE id = true;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO site_settings (
      id, smtp_host, smtp_port, smtp_user, smtp_pass,
      smtp_from_email, smtp_from_name, updated_at
    ) VALUES (
      true, p_smtp_host, p_smtp_port, p_smtp_user,
      COALESCE(p_smtp_pass, ''),
      COALESCE(NULLIF(p_smtp_from_email, ''), p_smtp_user),
      COALESCE(NULLIF(p_smtp_from_name, ''), 'The Supreme Waffle'),
      now()
    );
  END IF;

  SELECT json_build_object('success', true) INTO result;
  RETURN result;
END;
$$;
