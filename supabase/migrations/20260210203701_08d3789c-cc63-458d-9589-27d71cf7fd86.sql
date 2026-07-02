
-- Fix infinite recursion in internal_chat_members SELECT policy
DROP POLICY IF EXISTS "Members can view chat members" ON public.internal_chat_members;

CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    chat_id IN (SELECT icm.chat_id FROM public.internal_chat_members icm WHERE icm.user_id = auth.uid())
  );

-- Fix INSERT policy to allow chat creators to add initial members
DROP POLICY IF EXISTS "Admins can manage members" ON public.internal_chat_members;

CREATE POLICY "Staff can add members"
  ON public.internal_chat_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
  );
