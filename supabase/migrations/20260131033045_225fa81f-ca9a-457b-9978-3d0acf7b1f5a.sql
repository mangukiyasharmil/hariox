-- Create SMS logs table for tracking all SMS sent
CREATE TABLE public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id),
  phone VARCHAR(15) NOT NULL,
  sms_type VARCHAR(50) NOT NULL, -- 'otp', 'status', 'marketing', 'reminder'
  template_id VARCHAR(50),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  provider VARCHAR(50) DEFAULT 'greensms',
  provider_response JSONB,
  cost_credits DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Staff can view SMS logs
CREATE POLICY "Staff can view SMS logs"
  ON public.sms_logs FOR SELECT
  USING (is_staff(auth.uid()));

-- Staff can insert SMS logs
CREATE POLICY "Staff can insert SMS logs"
  ON public.sms_logs FOR INSERT
  WITH CHECK (true);

-- Admin can manage SMS logs
CREATE POLICY "Admin can manage SMS logs"
  ON public.sms_logs FOR ALL
  USING (is_admin(auth.uid()));

-- Create index for better performance
CREATE INDEX idx_sms_logs_phone ON public.sms_logs(phone);
CREATE INDEX idx_sms_logs_created_at ON public.sms_logs(created_at);
CREATE INDEX idx_sms_logs_sms_type ON public.sms_logs(sms_type);
CREATE INDEX idx_sms_logs_status ON public.sms_logs(status);