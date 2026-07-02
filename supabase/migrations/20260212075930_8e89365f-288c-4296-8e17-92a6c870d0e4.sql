
-- Create DND (Do Not Disturb) table for WhatsApp opt-outs
CREATE TABLE public.whatsapp_dnd (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'customer_stop',
  lead_id UUID REFERENCES public.leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_dnd ENABLE ROW LEVEL SECURITY;

-- Admin/staff can view DND list
CREATE POLICY "Authenticated users can view DND list"
  ON public.whatsapp_dnd FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()));

-- Admin can manage DND
CREATE POLICY "Admins can manage DND"
  ON public.whatsapp_dnd FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Index for fast lookups
CREATE INDEX idx_whatsapp_dnd_phone ON public.whatsapp_dnd(phone);
