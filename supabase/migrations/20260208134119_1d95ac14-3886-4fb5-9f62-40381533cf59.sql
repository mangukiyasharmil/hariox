
-- Performance indexes for leads table
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_company_status ON public.leads (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads (assigned_to);

-- Performance indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON public.payments (lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_status ON public.payments (company_id, status, created_at DESC);

-- Performance indexes for activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_id ON public.activity_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- Performance index for call_logs
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.call_logs (lead_id);

-- Performance index for analytics created_at
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events (created_at DESC);
