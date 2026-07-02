-- Fix the generate_application_id function with proper search_path
CREATE OR REPLACE FUNCTION generate_application_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_prefix text;
  sequence_num int;
  new_app_id text;
BEGIN
  -- Get company prefix based on slug
  SELECT 
    CASE 
      WHEN slug = 'credit' THEN 'CF'
      WHEN slug = 'capital' THEN 'LF'
      WHEN slug = 'finance' THEN 'FF'
      ELSE 'APP'
    END INTO company_prefix
  FROM companies 
  WHERE id = NEW.company_id;
  
  -- If no company found, use default prefix
  IF company_prefix IS NULL THEN
    company_prefix := 'APP';
  END IF;
  
  -- Get next sequence number for this company
  SELECT COALESCE(MAX(
    CASE 
      WHEN application_id ~ ('^' || company_prefix || '[0-9]+$') 
      THEN CAST(SUBSTRING(application_id FROM LENGTH(company_prefix) + 1) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1 INTO sequence_num
  FROM leads
  WHERE company_id = NEW.company_id;
  
  -- Generate application ID (e.g., CF10001, LF10001, FF10001)
  new_app_id := company_prefix || LPAD((10000 + sequence_num)::text, 5, '0');
  
  NEW.application_id := new_app_id;
  
  RETURN NEW;
END;
$$;