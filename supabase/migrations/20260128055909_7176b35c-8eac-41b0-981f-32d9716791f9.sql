-- 1. Add 'marriage' to loan_type enum
ALTER TYPE public.loan_type ADD VALUE 'marriage';

-- 2. Add pincode and state columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS pincode VARCHAR(6),
ADD COLUMN IF NOT EXISTS state VARCHAR(50);

-- 3. Add GST tracking columns to accounting_entries
ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS gst_included BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0;

-- 4. Update RLS policy for leads to include new fields in insert check
DROP POLICY IF EXISTS "Public can submit loan applications" ON public.leads;

CREATE POLICY "Public can submit loan applications" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  (status = 'unpaid'::lead_status) 
  AND ((source IS NULL) OR (source = 'website'::text)) 
  AND (full_name IS NOT NULL) 
  AND ((length(btrim(full_name)) >= 2) AND (length(btrim(full_name)) <= 100)) 
  AND (city IS NOT NULL) 
  AND ((length(btrim(city)) >= 2) AND (length(btrim(city)) <= 100)) 
  AND (email IS NOT NULL) 
  AND (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) 
  AND (phone IS NOT NULL) 
  AND (phone ~ '^[6-9][0-9]{9}$'::text) 
  AND (loan_amount IS NOT NULL) 
  AND (loan_amount > (0)::numeric) 
  AND (monthly_income IS NOT NULL) 
  AND (monthly_income > (0)::numeric)
  AND ((pincode IS NULL) OR (pincode ~ '^[1-9][0-9]{5}$'::text))
  AND ((state IS NULL) OR (length(btrim(state)) <= 50))
);