-- Add columns to whatsapp_messages for API tracking
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS sent_at timestamptz,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS read_at timestamptz,
ADD COLUMN IF NOT EXISTS message_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS cost_credits numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS wamid text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);

-- Add Meta API credentials to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts
ADD COLUMN IF NOT EXISTS meta_business_id text,
ADD COLUMN IF NOT EXISTS webhook_verify_token text;

-- Create whatsapp_api_logs for tracking API usage
CREATE TABLE IF NOT EXISTS public.whatsapp_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  action text NOT NULL,
  request_data jsonb,
  response_data jsonb,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_api_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_api_logs
CREATE POLICY "Staff can view api logs" ON public.whatsapp_api_logs
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert api logs" ON public.whatsapp_api_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));