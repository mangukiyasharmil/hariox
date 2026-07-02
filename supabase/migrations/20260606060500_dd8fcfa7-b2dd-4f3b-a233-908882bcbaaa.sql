DROP POLICY IF EXISTS "Public can upload documents via link" ON public.documents;
CREATE POLICY "Public can upload documents via link"
ON public.documents
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = ANY (ARRAY['pending'::document_status, 'uploaded'::document_status])
  AND lead_id IS NOT NULL
  AND public.lead_exists(lead_id)
);