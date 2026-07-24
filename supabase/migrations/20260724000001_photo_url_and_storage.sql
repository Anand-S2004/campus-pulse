-- Add photo_url column to posts so moments can include an optional image.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS photo_url text;

-- Ensure the self-delete policy exists (was added in a previous migration but
-- may not have been applied to the active project yet).
DROP POLICY IF EXISTS "posts self delete" ON public.posts;
CREATE POLICY "posts self delete"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket for post photos (public read, authenticated write).
-- ON CONFLICT is safe to run multiple times.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('post-photos', 'post-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload into their own folder (uid/filename).
DROP POLICY IF EXISTS "authenticated upload post photos" ON storage.objects;
CREATE POLICY "authenticated upload post photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Everyone (including unauthenticated) can read photos (they are public).
DROP POLICY IF EXISTS "public read post photos" ON storage.objects;
CREATE POLICY "public read post photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-photos');

-- Users can delete their own photos.
DROP POLICY IF EXISTS "users delete own post photos" ON storage.objects;
CREATE POLICY "users delete own post photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
