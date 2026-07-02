-- Add invoice_prefix to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV';

-- Add company_id to gst_invoices if not exists
ALTER TABLE public.gst_invoices 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Update company prefixes
UPDATE public.companies SET invoice_prefix = 'CF' WHERE slug = 'fundcera';
UPDATE public.companies SET invoice_prefix = 'LF' WHERE slug = 'capital';
UPDATE public.companies SET invoice_prefix = 'FF' WHERE slug = 'finance';

-- Drop existing function and recreate with company support
DROP FUNCTION IF EXISTS generate_invoice_number();

-- Create new function that generates company-specific invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(p_company_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_year text;
  v_next_num integer;
  v_invoice_number text;
BEGIN
  -- Get current financial year (April to March)
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || 
              SUBSTRING(((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text) FROM 3 FOR 2);
  ELSE
    v_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::text || '-' || 
              SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE)::text) FROM 3 FOR 2);
  END IF;

  -- Get company prefix or default
  IF p_company_id IS NOT NULL THEN
    SELECT COALESCE(invoice_prefix, 'INV') INTO v_prefix 
    FROM companies WHERE id = p_company_id;
  END IF;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'INV';
  END IF;

  -- Get next sequence number for this company and year
  SELECT COALESCE(MAX(
    CAST(
      NULLIF(REGEXP_REPLACE(
        SUBSTRING(invoice_number FROM '[0-9]+$'), 
        '[^0-9]', '', 'g'
      ), '') AS integer
    )
  ), 0) + 1 INTO v_next_num
  FROM gst_invoices
  WHERE invoice_number LIKE v_prefix || '/' || v_year || '/%'
    AND (company_id = p_company_id OR (p_company_id IS NULL AND company_id IS NULL));

  -- Format: PREFIX/YYYY-YY/NNNN
  v_invoice_number := v_prefix || '/' || v_year || '/' || LPAD(v_next_num::text, 4, '0');

  RETURN v_invoice_number;
END;
$$;