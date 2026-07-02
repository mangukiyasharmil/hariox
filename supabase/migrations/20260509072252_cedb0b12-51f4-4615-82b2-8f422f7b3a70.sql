-- 1. OTP codes: remove staff read & drop plaintext column
DROP POLICY IF EXISTS "Staff can view OTP codes" ON public.otp_codes;
ALTER TABLE public.otp_codes DROP COLUMN IF EXISTS code;

-- 2. WhatsApp / Meta / Integrations: remove broad staff SELECT (admin ALL policy already exists)
DROP POLICY IF EXISTS "Staff can view WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Staff can view meta pages" ON public.meta_pages;
DROP POLICY IF EXISTS "Staff can view integrations" ON public.company_integrations;

-- 3. public-assets storage bucket: restrict mutations to staff
DROP POLICY IF EXISTS "Authenticated users can upload public assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update public assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete public assets" ON storage.objects;

CREATE POLICY "Staff can upload public assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update public assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'public-assets' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete public assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));

-- 4. staff_notifications: target user must be a staff member
DROP POLICY IF EXISTS "Staff can create notifications" ON public.staff_notifications;
CREATE POLICY "Staff can create notifications"
ON public.staff_notifications FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND public.is_staff(user_id));

-- 5. Remove remarketing_cycles from realtime publication (no staff SELECT policy exists; admin-only)
ALTER PUBLICATION supabase_realtime DROP TABLE public.remarketing_cycles;