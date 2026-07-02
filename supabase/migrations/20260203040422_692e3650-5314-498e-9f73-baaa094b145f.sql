-- Fix the generate_application_id function with correct slugs
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
  -- Get company prefix based on slug (Credit=fundcera, Capital=capital, Finance=finance)
  SELECT 
    CASE 
      WHEN slug = 'fundcera' THEN 'CF'
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
      ELSE 10000 
    END
  ), 10000) + 1 INTO sequence_num
  FROM leads
  WHERE company_id = NEW.company_id;
  
  -- Generate application ID (e.g., CF10001, LF10001, FF10001)
  new_app_id := company_prefix || sequence_num::text;
  
  NEW.application_id := new_app_id;
  
  RETURN NEW;
END;
$$;

-- Regenerate application IDs for existing leads using DO block
DO $$
DECLARE
  rec RECORD;
  row_num int;
  prefix text;
BEGIN
  -- Credit Fundcera (fundcera slug)
  row_num := 10000;
  FOR rec IN 
    SELECT id FROM leads 
    WHERE company_id = '0a817e57-9c31-4aba-b709-3647958b917e' 
    ORDER BY created_at
  LOOP
    row_num := row_num + 1;
    UPDATE leads SET application_id = 'CF' || row_num::text WHERE id = rec.id;
  END LOOP;
  
  -- Capital Fundcera
  row_num := 10000;
  FOR rec IN 
    SELECT id FROM leads 
    WHERE company_id = 'bbe9fc5c-0caf-458e-aada-fa33143c4ff4' 
    ORDER BY created_at
  LOOP
    row_num := row_num + 1;
    UPDATE leads SET application_id = 'LF' || row_num::text WHERE id = rec.id;
  END LOOP;
  
  -- Finance Fundcera
  row_num := 10000;
  FOR rec IN 
    SELECT id FROM leads 
    WHERE company_id = 'e00c26fa-d874-4977-9fc6-bdf6e6b66344' 
    ORDER BY created_at
  LOOP
    row_num := row_num + 1;
    UPDATE leads SET application_id = 'FF' || row_num::text WHERE id = rec.id;
  END LOOP;
END $$;