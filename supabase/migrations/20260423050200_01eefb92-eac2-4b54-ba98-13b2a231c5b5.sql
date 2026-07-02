-- 1. Drop the dangerous public SELECT policy
DROP POLICY IF EXISTS "Public can view own lead documents" ON public.documents;

-- 2. Create a SECURITY DEFINER function that returns ONLY document types
-- (no file_url, no remarks, no PII) for a given lead_id.
-- This lets the public upload page show "already uploaded" checkmarks
-- without exposing file URLs to the world.
CREATE OR REPLACE FUNCTION public.get_uploaded_document_types(_lead_id uuid)
RETURNS TABLE(document_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT document_type
  FROM public.documents
  WHERE lead_id = _lead_id;
$$;

-- 3. Allow anon + authenticated to call the safe function
GRANT EXECUTE ON FUNCTION public.get_uploaded_document_types(uuid) TO anon, authenticated;