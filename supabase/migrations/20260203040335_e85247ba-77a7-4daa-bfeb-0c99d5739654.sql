-- Add application_id column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS application_id text;

-- Create function to generate application ID
CREATE OR REPLACE FUNCTION generate_application_id()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate application_id on insert
DROP TRIGGER IF EXISTS generate_lead_application_id ON leads;
CREATE TRIGGER generate_lead_application_id
  BEFORE INSERT ON leads
  FOR EACH ROW
  WHEN (NEW.application_id IS NULL)
  EXECUTE FUNCTION generate_application_id();

-- Generate application IDs for existing leads
DO $$
DECLARE
  lead_record RECORD;
  company_prefix text;
  sequence_num int;
  new_app_id text;
BEGIN
  FOR lead_record IN 
    SELECT l.id, l.company_id, c.slug 
    FROM leads l 
    LEFT JOIN companies c ON l.company_id = c.id 
    WHERE l.application_id IS NULL
    ORDER BY l.created_at
  LOOP
    -- Get prefix
    company_prefix := CASE 
      WHEN lead_record.slug = 'credit' THEN 'CF'
      WHEN lead_record.slug = 'capital' THEN 'LF'
      WHEN lead_record.slug = 'finance' THEN 'FF'
      ELSE 'APP'
    END;
    
    -- Get next sequence
    SELECT COALESCE(MAX(
      CASE 
        WHEN application_id ~ ('^' || company_prefix || '[0-9]+$') 
        THEN CAST(SUBSTRING(application_id FROM LENGTH(company_prefix) + 1) AS INTEGER)
        ELSE 10000 
      END
    ), 10000) + 1 INTO sequence_num
    FROM leads
    WHERE company_id = lead_record.company_id
    AND application_id IS NOT NULL;
    
    new_app_id := company_prefix || LPAD(sequence_num::text, 5, '0');
    
    UPDATE leads SET application_id = new_app_id WHERE id = lead_record.id;
  END LOOP;
END $$;