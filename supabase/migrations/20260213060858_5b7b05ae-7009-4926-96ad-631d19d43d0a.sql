
-- Update the stage-based auto-assign trigger to handle the new flow:
-- If a lead transitions from 'unpaid' to 'paid' and has NO telecaller assignment,
-- it means they paid within 2 minutes (direct payment) — assign straight to verification.
-- The process-pending-leads function already handles the "not paid in 2 min → telecaller" path.

CREATE OR REPLACE FUNCTION public.auto_assign_lead_by_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_verification_user_id UUID;
  v_login_user_id UUID;
BEGIN
  -- Only act on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- PAID: Assign to verification team
  IF NEW.status = 'paid' THEN
    SELECT ur.user_id INTO v_verification_user_id
    FROM user_roles ur
    WHERE ur.role = 'verification'
    LIMIT 1;

    IF v_verification_user_id IS NOT NULL THEN
      NEW.assigned_to := v_verification_user_id;
      
      -- Log the assignment
      INSERT INTO lead_assignment_history (lead_id, assigned_to, assigned_by, reason)
      VALUES (NEW.id, v_verification_user_id, NULL, 
        CASE 
          WHEN OLD.assigned_to IS NULL THEN 'Direct payment (paid within 2 min) → verification'
          ELSE 'Paid → auto-assigned to verification'
        END
      );
    END IF;
  END IF;

  -- VERIFIED / PROCESSING: Assign to login team
  IF NEW.status IN ('verified', 'processing') AND OLD.status NOT IN ('verified', 'processing') THEN
    SELECT ur.user_id INTO v_login_user_id
    FROM user_roles ur
    WHERE ur.role = 'login_team'
    LIMIT 1;

    IF v_login_user_id IS NOT NULL THEN
      NEW.assigned_to := v_login_user_id;
      
      INSERT INTO lead_assignment_history (lead_id, assigned_to, assigned_by, reason)
      VALUES (NEW.id, v_login_user_id, NULL, 'Verified → auto-assigned to login team');
    END IF;
  END IF;

  -- LOST / REJECTED: Keep current assignment (don't clear)
  -- This ensures telecallers can still see these leads in their "Lost" tab

  RETURN NEW;
END;
$function$;

-- Ensure the trigger fires on UPDATE
DROP TRIGGER IF EXISTS trigger_auto_assign_lead_by_stage ON leads;
CREATE TRIGGER trigger_auto_assign_lead_by_stage
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_lead_by_stage();
