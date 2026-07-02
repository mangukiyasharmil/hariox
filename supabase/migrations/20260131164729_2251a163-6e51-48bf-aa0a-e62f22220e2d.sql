-- Update the auto_assign_lead_to_telecaller trigger to NOT assign immediately for website leads
-- Website leads stay unassigned until the background job processes them after 2 minutes
CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_telecaller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if already assigned
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- For website leads (unpaid), do NOT assign immediately
  -- They will be processed by the background job after 2 minutes
  IF NEW.source = 'website' AND NEW.status = 'unpaid' THEN
    RETURN NEW; -- Leave unassigned
  END IF;

  -- For non-website leads (like API leads), assign immediately to telecaller
  IF NEW.status = 'unpaid' THEN
    SELECT ur.user_id INTO NEW.assigned_to
    FROM user_roles ur
    WHERE ur.role = 'telecaller'
    ORDER BY (
      SELECT COUNT(*) FROM leads l 
      WHERE l.assigned_to = ur.user_id 
        AND l.status = 'unpaid'
    ) ASC, ur.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update the auto_assign_lead_by_stage trigger for status changes
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
    
    -- LOST or REJECTED: Unassign the lead
    IF NEW.status = 'lost' OR NEW.status = 'rejected' THEN
      NEW.assigned_to := NULL;
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