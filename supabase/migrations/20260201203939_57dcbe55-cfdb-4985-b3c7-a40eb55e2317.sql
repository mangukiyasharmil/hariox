-- Create workflow_logs table to track automation executions
CREATE TABLE public.workflow_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  workflow_name TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  actions_executed JSONB DEFAULT '[]',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view workflow logs" 
ON public.workflow_logs 
FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Admin can delete logs
CREATE POLICY "Admins can delete workflow logs"
ON public.workflow_logs
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_workflow_logs_workflow_id ON public.workflow_logs(workflow_id);
CREATE INDEX idx_workflow_logs_created_at ON public.workflow_logs(created_at DESC);