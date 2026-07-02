-- Fix broken RLS policy for internal_chats SELECT
DROP POLICY IF EXISTS "Users can view their chats" ON public.internal_chats;
CREATE POLICY "Users can view their chats" ON public.internal_chats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM internal_chat_members
    WHERE internal_chat_members.chat_id = internal_chats.id
    AND internal_chat_members.user_id = auth.uid()
  ));

-- Fix broken RLS policy for internal_chats UPDATE
DROP POLICY IF EXISTS "Admins can update chats" ON public.internal_chats;
CREATE POLICY "Admins can update chats" ON public.internal_chats
  FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid()) 
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM internal_chat_members
      WHERE internal_chat_members.chat_id = internal_chats.id
      AND internal_chat_members.user_id = auth.uid()
      AND internal_chat_members.role = 'admin'
    )
  );