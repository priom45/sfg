/*
  # Update handle_new_user trigger for phone-based OTP auth

  1. Changes
    - Update `handle_new_user()` function to extract phone number from
      `auth.users.phone` field (used by Supabase Phone Auth / Twilio)
    - Falls back to `raw_user_meta_data->>'phone'` for backwards compatibility
    - Strips +91 country code prefix when storing phone number

  2. Notes
    - Supabase Phone Auth stores the full international number (e.g., +919876543210)
      in `auth.users.phone`, NOT in `raw_user_meta_data`
    - We strip the +91 prefix so profiles.phone stores just the 10-digit number
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  phone_val text;
BEGIN
  phone_val := COALESCE(
    REGEXP_REPLACE(NEW.phone, '^\+91', ''),
    NEW.raw_user_meta_data->>'phone',
    ''
  );

  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    phone_val,
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone
  WHERE public.profiles.phone = '' OR public.profiles.phone IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
