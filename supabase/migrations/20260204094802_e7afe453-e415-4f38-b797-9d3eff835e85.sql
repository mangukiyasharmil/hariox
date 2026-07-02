-- Create WhatsApp automation workflows table
CREATE TABLE public.whatsapp_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'incoming_message', 'keyword', 'button_click', 'no_reply_timeout'
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create workflow actions table
CREATE TABLE public.whatsapp_workflow_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'send_message', 'send_template', 'ai_reply', 'assign_agent', 'add_tag', 'stop_automation', 'delay'
  action_config JSONB DEFAULT '{}',
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create workflow execution logs
CREATE TABLE public.whatsapp_workflow_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  workflow_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  actions_executed JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'stopped'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for workflows
CREATE POLICY "Staff can view workflows" ON public.whatsapp_workflows
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage workflows" ON public.whatsapp_workflows
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS policies for actions
CREATE POLICY "Staff can view workflow actions" ON public.whatsapp_workflow_actions
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage workflow actions" ON public.whatsapp_workflow_actions
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS policies for logs
CREATE POLICY "Staff can view workflow logs" ON public.whatsapp_workflow_logs
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage workflow logs" ON public.whatsapp_workflow_logs
  FOR ALL USING (public.is_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_whatsapp_workflows_account ON public.whatsapp_workflows(account_id);
CREATE INDEX idx_whatsapp_workflows_active ON public.whatsapp_workflows(is_active);
CREATE INDEX idx_whatsapp_workflow_actions_workflow ON public.whatsapp_workflow_actions(workflow_id);
CREATE INDEX idx_whatsapp_workflow_logs_workflow ON public.whatsapp_workflow_logs(workflow_id);
CREATE INDEX idx_whatsapp_workflow_logs_phone ON public.whatsapp_workflow_logs(phone_number);