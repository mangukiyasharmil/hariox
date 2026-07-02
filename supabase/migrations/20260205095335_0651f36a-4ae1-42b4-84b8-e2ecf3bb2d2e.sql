-- Create table to track scheduled WhatsApp messages (for delay workflows)
CREATE TABLE IF NOT EXISTS public.whatsapp_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  message TEXT,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sequence_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, cancelled
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_pending ON public.whatsapp_scheduled_messages(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_lead ON public.whatsapp_scheduled_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_workflow ON public.whatsapp_scheduled_messages(workflow_id);

-- Enable RLS
ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Policy for staff access
CREATE POLICY "Staff can view scheduled messages"
  ON public.whatsapp_scheduled_messages
  FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage scheduled messages"
  ON public.whatsapp_scheduled_messages
  FOR ALL
  USING (public.is_staff(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_scheduled_updated_at
  BEFORE UPDATE ON public.whatsapp_scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_scheduled_messages;