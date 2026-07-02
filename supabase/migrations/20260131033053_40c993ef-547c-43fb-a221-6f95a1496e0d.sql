-- Drop the overly permissive policy and create proper one
DROP POLICY "Staff can insert SMS logs" ON public.sms_logs;

-- Staff can insert SMS logs with proper check
CREATE POLICY "Staff can insert SMS logs"
  ON public.sms_logs FOR INSERT
  WITH CHECK (is_staff(auth.uid()));