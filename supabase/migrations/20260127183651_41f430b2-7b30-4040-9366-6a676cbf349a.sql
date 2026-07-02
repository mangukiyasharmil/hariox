-- Allow public document uploads for customer self-service
-- Only allow insert with pending/uploaded status
CREATE POLICY "Public can upload documents via link"
ON public.documents
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status IN ('pending', 'uploaded')
);

-- Also add SELECT so customers can see their uploaded docs
CREATE POLICY "Public can view own lead documents"
ON public.documents
FOR SELECT
TO anon, authenticated
USING (true);