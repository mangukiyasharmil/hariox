-- Add retry tracking columns to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS retry_eligible boolean NOT NULL DEFAULT true;

-- Index for finding retryable failed messages efficiently
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_retry 
ON public.whatsapp_messages (status, retry_count, retry_eligible) 
WHERE status = 'failed' AND retry_count < 2 AND retry_eligible = true;