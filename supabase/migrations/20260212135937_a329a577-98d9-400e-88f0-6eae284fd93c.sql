
-- 1. Create a restricted public view for system_settings (only client-safe keys)
CREATE VIEW public.public_system_settings
WITH (security_invoker = on) AS
SELECT key, value 
FROM public.system_settings
WHERE key IN (
  'consulting_fee',
  'gst_percentage', 
  'min_interest_rate',
  'max_interest_rate',
  'min_tenure_months',
  'max_tenure_months',
  'meta_pixel_id'
);

-- Allow anonymous and authenticated to read public settings
GRANT SELECT ON public.public_system_settings TO anon, authenticated;

-- 2. Remove the overly permissive policy on system_settings
DROP POLICY IF EXISTS "Anyone can read settings" ON public.system_settings;

-- 3. Create a new restricted policy - only staff can read all settings
CREATE POLICY "Staff can read all settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- 4. Create policy for anon to read only through the view
-- (The view with security_invoker will use the caller's permissions,
--  so we need a policy that allows reading the specific public keys)
CREATE POLICY "Public can read safe settings"
ON public.system_settings
FOR SELECT
TO anon
USING (key IN (
  'consulting_fee',
  'gst_percentage', 
  'min_interest_rate',
  'max_interest_rate',
  'min_tenure_months',
  'max_tenure_months',
  'meta_pixel_id'
));
