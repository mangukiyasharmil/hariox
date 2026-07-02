-- Add is_starred to whatsapp_messages for starring conversations
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- Add is_interested flag tracking - already exists on leads table
-- No additional schema needed for "mark as interested"
