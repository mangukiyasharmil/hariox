
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

  -- For website/OTP leads (unpaid), do NOT assign immediately
  -- They will be processed by the background job (process-pending-leads) 
  -- which respects weighted distribution settings
  IF (NEW.source LIKE 'website%' OR NEW.source LIKE '%otp%') AND NEW.status = 'unpaid' THEN
    RETURN NEW; -- Leave unassigned for weighted assignment
  END IF;

  -- For non-website leads (like API leads, exit popup), assign immediately to telecaller
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
