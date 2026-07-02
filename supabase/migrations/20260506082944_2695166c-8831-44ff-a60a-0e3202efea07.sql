-- Restrict realtime channel subscriptions to staff users only
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read realtime messages" ON realtime.messages;
CREATE POLICY "Staff can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can broadcast realtime" ON realtime.messages;
CREATE POLICY "Staff can broadcast realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- Restrict listing of the public-assets bucket (still allow direct file reads via getPublicUrl)
-- The existing "Public read access for public-assets" policy permits SELECT on storage.objects which lets clients enumerate files.
-- Replace it so only staff can list, while object reads through public URL/CDN still work (CDN bypasses RLS for public buckets).
DROP POLICY IF EXISTS "Public assets are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for public-assets" ON storage.objects;

CREATE POLICY "Staff can list public-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));