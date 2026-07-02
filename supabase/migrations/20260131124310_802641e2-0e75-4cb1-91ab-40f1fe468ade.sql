-- Create function to auto-assign leads based on stage/status changes
CREATE OR REPLACE FUNCTION public.auto_assign_lead_by_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role app_role;
  target_user_id uuid;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Determine target role based on new status
    IF NEW.status = 'verification' OR NEW.status = 'documents_pending' OR NEW.status = 'documents_uploaded' THEN
      target_role := 'verification';
    ELSIF NEW.status = 'verified' OR NEW.status = 'processing' THEN
      target_role := 'login_team';
    ELSE
      -- No reassignment needed for other statuses
      RETURN NEW;
    END IF;
    
    -- Find a user with the target role (round-robin based on least assignments)
    SELECT ur.user_id INTO target_user_id
    FROM user_roles ur
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) as assignment_count
      FROM leads
      WHERE status = NEW.status
      AND assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) counts ON ur.user_id = counts.assigned_to
    WHERE ur.role = target_role
    ORDER BY COALESCE(counts.assignment_count, 0) ASC, RANDOM()
    LIMIT 1;
    
    -- Update the assigned_to field if a target user was found
    IF target_user_id IS NOT NULL THEN
      NEW.assigned_to := target_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stage-based assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_lead_by_stage ON leads;
CREATE TRIGGER trigger_auto_assign_lead_by_stage
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_lead_by_stage();

-- Add display_order column to blog_posts for reordering
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;