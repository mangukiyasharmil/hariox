-- Create WhatsApp accounts table
CREATE TABLE public.whatsapp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT,
  connection_type TEXT NOT NULL DEFAULT 'qr' CHECK (connection_type IN ('qr', 'meta_api')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  session_data JSONB,
  meta_phone_id TEXT,
  meta_access_token TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp templates table
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp auto-responses table
CREATE TABLE public.whatsapp_auto_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  trigger_keyword TEXT NOT NULL,
  response_message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp messages table for chat inbox
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'template')),
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  campaign_id UUID REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster message lookups
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_account ON public.whatsapp_messages(account_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_accounts
CREATE POLICY "Admin can manage WhatsApp accounts"
  ON public.whatsapp_accounts FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view WhatsApp accounts"
  ON public.whatsapp_accounts FOR SELECT
  USING (is_staff(auth.uid()));

-- RLS Policies for whatsapp_templates
CREATE POLICY "Admin can manage WhatsApp templates"
  ON public.whatsapp_templates FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view WhatsApp templates"
  ON public.whatsapp_templates FOR SELECT
  USING (is_staff(auth.uid()));

-- RLS Policies for whatsapp_auto_responses
CREATE POLICY "Admin can manage auto responses"
  ON public.whatsapp_auto_responses FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view auto responses"
  ON public.whatsapp_auto_responses FOR SELECT
  USING (is_staff(auth.uid()));

-- RLS Policies for whatsapp_messages
CREATE POLICY "Admin can manage messages"
  ON public.whatsapp_messages FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view and send messages"
  ON public.whatsapp_messages FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff can insert messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (is_staff(auth.uid()));

-- Update trigger for accounts
CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for templates
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add account_id to campaigns table
ALTER TABLE public.whatsapp_campaigns 
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL;