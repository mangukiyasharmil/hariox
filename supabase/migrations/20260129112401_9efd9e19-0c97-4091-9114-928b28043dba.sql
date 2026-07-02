-- Allow admins to update any profile
CREATE POLICY "Admin can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()));

-- Allow admins to view all profiles (already exists but ensure it's there)
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
ON public.profiles
FOR SELECT
USING (is_staff(auth.uid()));