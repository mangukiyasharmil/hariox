-- Add meta_business_id column to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts 
ADD COLUMN IF NOT EXISTS meta_business_id TEXT;

-- Add unique constraint for template sync (account_id + name)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_account_name_idx 
ON public.whatsapp_templates (account_id, name);

-- Add chatbot_enabled flag to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts 
ADD COLUMN IF NOT EXISTS chatbot_enabled BOOLEAN DEFAULT false;

-- Enable realtime for whatsapp_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;