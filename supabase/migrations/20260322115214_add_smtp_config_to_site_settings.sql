/*
  # Add SMTP configuration columns to site_settings

  1. Modified Tables
    - `site_settings`
      - `smtp_host` (text) - SMTP server hostname
      - `smtp_port` (integer) - SMTP server port, default 587
      - `smtp_user` (text) - SMTP username / email
      - `smtp_pass` (text) - SMTP password (encrypted at rest by Supabase)
      - `smtp_from_email` (text) - Sender email address
      - `smtp_from_name` (text) - Sender display name

  2. Notes
    - These columns allow edge functions to read SMTP config directly from the database
    - Only admins can read/update these via existing RLS policies on site_settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'smtp_host'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN smtp_host text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'smtp_port'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN smtp_port integer DEFAULT 587 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'smtp_user'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN smtp_user text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'smtp_pass'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN smtp_pass text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'smtp_from_email'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN smtp_from_email text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'smtp_from_name'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN smtp_from_name text DEFAULT 'The Supreme Waffle' NOT NULL;
  END IF;
END $$;

UPDATE site_settings
SET
  smtp_host = 'smtp.hostinger.com',
  smtp_port = 587,
  smtp_user = 'noreply@thesupremewaffle.com',
  smtp_from_email = 'noreply@thesupremewaffle.com',
  smtp_from_name = 'The Supreme Waffle'
WHERE id = true
  AND smtp_host = '';
