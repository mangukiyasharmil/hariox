-- Create remarketing_cycles table to track SMS campaigns for leads
CREATE TABLE public.remarketing_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '3 days'),
  sms_sent_count INTEGER NOT NULL DEFAULT 0,
  last_sms_sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Enable RLS
ALTER TABLE public.remarketing_cycles ENABLE ROW LEVEL SECURITY;

-- Policies for admin access
CREATE POLICY "Admins can manage remarketing cycles"
ON public.remarketing_cycles
FOR ALL
USING (public.is_admin(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_remarketing_cycles_updated_at
BEFORE UPDATE ON public.remarketing_cycles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_remarketing_cycles_status ON public.remarketing_cycles(status);
CREATE INDEX idx_remarketing_cycles_lead_id ON public.remarketing_cycles(lead_id);

-- Enable realtime for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.remarketing_cycles;