
-- Table to store scheduled workflow actions (for delays/drip sequences)
CREATE TABLE public.workflow_scheduled_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  workflow_name TEXT,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  remaining_nodes JSONB NOT NULL DEFAULT '[]',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient polling
CREATE INDEX idx_scheduled_actions_pending ON public.workflow_scheduled_actions(status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX idx_scheduled_actions_lead ON public.workflow_scheduled_actions(lead_id);

-- Enable RLS
ALTER TABLE public.workflow_scheduled_actions ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Staff can view scheduled actions"
  ON public.workflow_scheduled_actions FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage scheduled actions"
  ON public.workflow_scheduled_actions FOR ALL
  USING (public.is_staff(auth.uid()));

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_scheduled_actions;
