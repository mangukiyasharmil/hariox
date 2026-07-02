-- Add company_id to accounting_entries for multi-tenant expense tracking
ALTER TABLE public.accounting_entries 
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create index for faster company-based queries
CREATE INDEX idx_accounting_entries_company_id ON public.accounting_entries(company_id);

-- Update RLS policy to include company check
DROP POLICY IF EXISTS "Staff can view accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Staff can manage accounting entries" ON public.accounting_entries;

CREATE POLICY "Staff can view accounting entries"
ON public.accounting_entries FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can manage accounting entries"  
ON public.accounting_entries FOR ALL
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));