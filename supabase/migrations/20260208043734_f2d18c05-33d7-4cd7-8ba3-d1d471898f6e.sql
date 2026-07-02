-- Fix: Retain assignment on lost/rejected instead of clearing it
CREATE OR REPLACE FUNCTION public.auto_assign_lead_by_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_role app_role;
  target_user_id uuid;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- LOST or REJECTED: Keep the current assignment (do NOT clear it)
    IF NEW.status = 'lost' OR NEW.status = 'rejected' THEN
      RETURN NEW;
    END IF;
    
    -- PAID: Assign to verification team
    IF NEW.status = 'paid' THEN
      target_role := 'verification';
    -- VERIFICATION stages: Keep with verification team
    ELSIF NEW.status = 'verification' OR NEW.status = 'documents_pending' OR NEW.status = 'documents_uploaded' THEN
      target_role := 'verification';
    -- VERIFIED or PROCESSING: Assign to login team (sent to bank)
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
$function$;