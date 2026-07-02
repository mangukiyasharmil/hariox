
-- Add a hashed_code column to store SHA-256 hashed OTP codes
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS hashed_code text;

-- Drop all existing public/anon policies on otp_codes to lock it down
DROP POLICY IF EXISTS "Staff can view OTP codes for debugging" ON public.otp_codes;
DROP POLICY IF EXISTS "Public can insert OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Public can update OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can insert OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can update OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Service role manages OTP codes" ON public.otp_codes;

-- Only authenticated staff (admin) can SELECT for debugging
CREATE POLICY "Only admins can view OTP codes"
ON public.otp_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No public INSERT/UPDATE/DELETE - all managed by edge functions via service role
-- RLS is enabled but no anon policies exist = anon cannot touch this table
