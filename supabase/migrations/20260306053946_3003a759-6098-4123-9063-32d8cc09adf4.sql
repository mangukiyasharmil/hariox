
-- Allow staff members to manage blog posts (not just admins)
CREATE POLICY "Staff can manage blog posts"
ON public.blog_posts
FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));
