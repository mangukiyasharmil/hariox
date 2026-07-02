
-- Fix: Allow users to always see their own membership + members of chats they belong to
DROP POLICY IF EXISTS "Members can view chat members" ON public.internal_chat_members;

CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_chat_member(auth.uid(), chat_id)
  );
