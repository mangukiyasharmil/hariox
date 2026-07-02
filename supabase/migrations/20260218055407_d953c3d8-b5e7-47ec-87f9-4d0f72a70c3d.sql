-- Allow admins to INSERT new system settings
CREATE POLICY "Admin can insert settings"
ON public.system_settings
FOR INSERT
WITH CHECK (is_admin(auth.uid()));
