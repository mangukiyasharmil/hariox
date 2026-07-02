CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'telecaller', 'verification', 'login_team')
  )
$function$;

DROP POLICY IF EXISTS "Block client OTP inserts" ON public.otp_codes;
CREATE POLICY "Block client OTP inserts"
  ON public.otp_codes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block client OTP deletes" ON public.otp_codes;
CREATE POLICY "Block client OTP deletes"
  ON public.otp_codes
  FOR DELETE
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Block client OTP updates" ON public.otp_codes;
CREATE POLICY "Block client OTP updates"
  ON public.otp_codes
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Admin can update documents" ON storage.objects;
CREATE POLICY "Admin can update documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'::app_role));