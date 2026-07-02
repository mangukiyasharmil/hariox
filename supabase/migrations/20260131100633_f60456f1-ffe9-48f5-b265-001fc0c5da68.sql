-- Create function to auto-assign leads to telecaller with fewest unpaid assignments
CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_telecaller()
RETURNS TRIGGER AS $$
DECLARE
  selected_telecaller_id UUID;
  company_telecaller_ids UUID[];
  all_telecaller_ids UUID[];
  min_count INTEGER;
BEGIN
  -- Skip if already assigned
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- First, try to find telecallers linked to the lead's company
  IF NEW.company_id IS NOT NULL THEN
    SELECT ARRAY_AGG(cu.user_id) INTO company_telecaller_ids
    FROM company_users cu
    JOIN user_roles ur ON ur.user_id = cu.user_id
    WHERE cu.company_id = NEW.company_id
      AND ur.role = 'telecaller';
  END IF;

  -- Use company telecallers if found, otherwise fallback to all telecallers
  IF company_telecaller_ids IS NOT NULL AND array_length(company_telecaller_ids, 1) > 0 THEN
    all_telecaller_ids := company_telecaller_ids;
  ELSE
    SELECT ARRAY_AGG(user_id) INTO all_telecaller_ids
    FROM user_roles
    WHERE role = 'telecaller';
  END IF;

  -- If no telecallers available, return without assignment
  IF all_telecaller_ids IS NULL OR array_length(all_telecaller_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Find telecaller with fewest unpaid leads (round-robin)
  SELECT ur.user_id INTO selected_telecaller_id
  FROM user_roles ur
  WHERE ur.role = 'telecaller'
    AND ur.user_id = ANY(all_telecaller_ids)
  ORDER BY (
    SELECT COUNT(*) FROM leads l 
    WHERE l.assigned_to = ur.user_id 
      AND l.status = 'unpaid'
  ) ASC, ur.created_at ASC
  LIMIT 1;

  -- Assign the lead
  IF selected_telecaller_id IS NOT NULL THEN
    NEW.assigned_to := selected_telecaller_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-assign on insert
DROP TRIGGER IF EXISTS trigger_auto_assign_lead ON public.leads;
CREATE TRIGGER trigger_auto_assign_lead
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_lead_to_telecaller();