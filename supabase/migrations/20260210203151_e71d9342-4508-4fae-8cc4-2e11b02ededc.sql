
-- Internal Chats (1:1 and group)
CREATE TABLE public.internal_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, -- null for 1:1, set for groups
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat members
CREATE TABLE public.internal_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Messages
CREATE TABLE public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, image, file
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read receipts
CREATE TABLE public.internal_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.internal_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.internal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see chats they're members of
CREATE POLICY "Users can view their chats"
  ON public.internal_chats FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_chat_members WHERE chat_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "Staff can create chats"
  ON public.internal_chats FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Admins can update chats"
  ON public.internal_chats FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.internal_chat_members WHERE chat_id = id AND user_id = auth.uid() AND role = 'admin')
  );

-- Members policies
CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_chat_members cm WHERE cm.chat_id = internal_chat_members.chat_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage members"
  ON public.internal_chat_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.internal_chat_members cm WHERE cm.chat_id = internal_chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

CREATE POLICY "Admins can remove members"
  ON public.internal_chat_members FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.internal_chat_members cm WHERE cm.chat_id = internal_chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

-- Messages policies
CREATE POLICY "Members can view messages"
  ON public.internal_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_chat_members WHERE chat_id = internal_messages.chat_id AND user_id = auth.uid()
  ));

CREATE POLICY "Members can send messages"
  ON public.internal_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.internal_chat_members WHERE chat_id = internal_messages.chat_id AND user_id = auth.uid())
  );

-- Read receipts policies
CREATE POLICY "Members can view reads"
  ON public.internal_message_reads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_messages m
    JOIN public.internal_chat_members cm ON cm.chat_id = m.chat_id
    WHERE m.id = internal_message_reads.message_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Users can mark as read"
  ON public.internal_message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_message_reads;

-- Trigger for updated_at
CREATE TRIGGER update_internal_chats_updated_at
  BEFORE UPDATE ON public.internal_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
