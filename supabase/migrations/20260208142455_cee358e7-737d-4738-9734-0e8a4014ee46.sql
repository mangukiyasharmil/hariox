
-- ============================================================
-- FIX 1: Leads table - Remove overly permissive public SELECT
-- Replace with a restricted view for public phone lookups
-- ============================================================

-- Drop the dangerous public SELECT policy
DROP POLICY IF EXISTS "Public can lookup leads by phone" ON public.leads;

-- Create a restricted view with ONLY the fields needed for public flows
-- (Returning Customer lookup, Telecaller Payment Portal)
CREATE OR REPLACE VIEW public.leads_public
WITH (security_invoker = false) AS
SELECT id, full_name, phone, status, company_id, application_id, created_at
FROM public.leads;

-- Grant anonymous access to the view (not the full table)
GRANT SELECT ON public.leads_public TO anon;

-- ============================================================
-- FIX 2: OTP codes - Remove all public access policies
-- Edge functions use SERVICE_ROLE_KEY so they bypass RLS
-- ============================================================

DROP POLICY IF EXISTS "Anyone can verify OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can request OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can mark OTP verified" ON public.otp_codes;

-- Only allow service role (edge functions) to access OTP codes
-- Staff can view for debugging
CREATE POLICY "Staff can view OTP codes"
ON public.otp_codes FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- ============================================================
-- FIX 3: Storage - Restrict anonymous document uploads
-- Require path to match UUID/filename pattern (leadId folder)
-- ============================================================

DROP POLICY IF EXISTS "Anyone can upload documents" ON storage.objects;

-- Restrict uploads: path must start with a UUID-like folder name
-- and only allow specific file types
CREATE POLICY "Restricted document uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) >= 30
  AND name ~ '\.(pdf|jpg|jpeg|png|PDF|JPG|JPEG|PNG)$'
);
