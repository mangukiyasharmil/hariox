
-- Drop ALL existing policies on internal_chat_members to start fresh
DROP POLICY IF EXISTS "Members can view chat members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Staff can add members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.internal_chat_members;

-- Create a security definer function to check chat membership (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_chat_member(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_chat_members
    WHERE user_id = _user_id AND chat_id = _chat_id
  )
$$;

-- SELECT: staff can see members of chats they belong to
CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (public.is_chat_member(auth.uid(), chat_id));

-- INSERT: any staff can add members
CREATE POLICY "Staff can add members"
  ON public.internal_chat_members FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- DELETE: admins can remove members
CREATE POLICY "Admins can remove members"
  ON public.internal_chat_members FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
