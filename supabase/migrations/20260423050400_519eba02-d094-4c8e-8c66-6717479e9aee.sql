-- =========================================================
-- 1. REALTIME: Restrict postgres_changes subscriptions
-- =========================================================
-- Enable RLS on realtime.messages (idempotent)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior policy with the same name
DROP POLICY IF EXISTS "Staff can subscribe to realtime channels" ON realtime.messages;

-- Only authenticated staff users can read realtime broadcast/changes messages
CREATE POLICY "Staff can subscribe to realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- =========================================================
-- 2. STORAGE: Tighten documents bucket upload policy
-- =========================================================
-- Helper: validate that a folder name is a real lead UUID
CREATE OR REPLACE FUNCTION public.lead_exists(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads WHERE id = _lead_id);
$$;

GRANT EXECUTE ON FUNCTION public.lead_exists(uuid) TO anon, authenticated;

-- Replace weak upload policy with one that verifies the lead exists
DROP POLICY IF EXISTS "Restricted document uploads" ON storage.objects;

CREATE POLICY "Restricted document uploads"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) = 36  -- UUID length
  AND name ~ '\.(pdf|jpg|jpeg|png|PDF|JPG|JPEG|PNG)$'
  AND public.lead_exists(((storage.foldername(name))[1])::uuid)
);