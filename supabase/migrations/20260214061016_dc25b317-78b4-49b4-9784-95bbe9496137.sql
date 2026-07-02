
-- Add needs_agent flag to whatsapp_messages for inbox agent identification
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS needs_agent boolean DEFAULT false;

-- Create index for quick filtering of agent-needed messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_needs_agent ON public.whatsapp_messages (needs_agent) WHERE needs_agent = true;
