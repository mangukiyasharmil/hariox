-- Create tables for unified messaging (WhatsApp, FB Messenger, Instagram)

-- Platform type enum
DO $$ BEGIN
  CREATE TYPE message_platform AS ENUM ('whatsapp', 'facebook', 'instagram');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Meta Pages table (for FB and Instagram)
CREATE TABLE IF NOT EXISTS public.meta_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform message_platform NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT,
  instagram_account_id TEXT,
  is_active BOOLEAN DEFAULT true,
  webhook_subscribed BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, page_id)
);

-- Unified messages table to store all platform messages
CREATE TABLE IF NOT EXISTS public.unified_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform message_platform NOT NULL,
  account_id UUID, -- Reference to whatsapp_accounts for WhatsApp
  page_id UUID REFERENCES public.meta_pages(id), -- Reference to meta_pages for FB/IG
  external_id TEXT, -- Platform-specific message ID (wamid, mid, etc.)
  sender_id TEXT NOT NULL, -- Platform-specific sender ID
  sender_name TEXT,
  sender_profile_pic TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, video, audio, etc.
  attachment_url TEXT,
  direction TEXT NOT NULL DEFAULT 'incoming', -- incoming or outgoing
  status TEXT DEFAULT 'received', -- sent, delivered, read, failed
  lead_id UUID REFERENCES public.leads(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_messages_platform ON public.unified_messages(platform);
CREATE INDEX IF NOT EXISTS idx_unified_messages_sender ON public.unified_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_created ON public.unified_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_messages_lead ON public.unified_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_platform ON public.meta_pages(platform);

-- Enable RLS
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meta_pages
CREATE POLICY "Staff can view meta pages"
ON public.meta_pages FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage meta pages"
ON public.meta_pages FOR ALL
USING (public.is_admin(auth.uid()));

-- RLS Policies for unified_messages
CREATE POLICY "Staff can view unified messages"
ON public.unified_messages FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert unified messages"
ON public.unified_messages FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update unified messages"
ON public.unified_messages FOR UPDATE
USING (public.is_staff(auth.uid()));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_messages;

-- Update trigger
CREATE TRIGGER update_meta_pages_updated_at
  BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();