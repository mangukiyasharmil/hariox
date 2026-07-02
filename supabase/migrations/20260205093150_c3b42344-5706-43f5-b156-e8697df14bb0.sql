-- Create a table to track lead assignment history
CREATE TABLE public.lead_assignment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID, -- Can be NULL (unassigned)
  assigned_by UUID, -- Can be NULL if system-assigned
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient lookups by lead
CREATE INDEX idx_lead_assignment_history_lead_id ON public.lead_assignment_history(lead_id);
CREATE INDEX idx_lead_assignment_history_assigned_to ON public.lead_assignment_history(assigned_to);
CREATE INDEX idx_lead_assignment_history_created_at ON public.lead_assignment_history(created_at);

-- Enable RLS
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - only staff can read (all staff members can view assignment history)
CREATE POLICY "Staff can view assignment history"
ON public.lead_assignment_history
FOR SELECT
USING (public.is_staff(auth.uid()));

-- Only system (triggers) inserts records, but also allow admins
CREATE POLICY "Admins can insert assignment history"
ON public.lead_assignment_history
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Create trigger function to log assignment changes
CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log when assigned_to actually changes (including to/from NULL)
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.lead_assignment_history (lead_id, assigned_to, reason)
    VALUES (NEW.id, NEW.assigned_to, NEW.transfer_reason);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on leads table
CREATE TRIGGER trg_log_lead_assignment_change
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_assignment_change();

-- Also log initial assignment on INSERT
CREATE OR REPLACE FUNCTION public.log_initial_lead_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.lead_assignment_history (lead_id, assigned_to, reason)
    VALUES (NEW.id, NEW.assigned_to, 'Initial assignment');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_log_initial_lead_assignment
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_initial_lead_assignment();