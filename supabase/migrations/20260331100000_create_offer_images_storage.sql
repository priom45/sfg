INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'offer-images',
  'offer-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public can view offer images'
  ) THEN
    CREATE POLICY "Public can view offer images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'offer-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can upload offer images'
  ) THEN
    CREATE POLICY "Admins can upload offer images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'offer-images' AND public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can update offer images'
  ) THEN
    CREATE POLICY "Admins can update offer images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'offer-images' AND public.is_admin())
      WITH CHECK (bucket_id = 'offer-images' AND public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can delete offer images'
  ) THEN
    CREATE POLICY "Admins can delete offer images"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'offer-images' AND public.is_admin());
  END IF;
END $$;
