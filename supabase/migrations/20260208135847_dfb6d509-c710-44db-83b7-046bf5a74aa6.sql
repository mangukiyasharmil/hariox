
-- Add company_id to workflows table for multi-tenant isolation
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Backfill: set existing workflows to the first active company (fundcera/credit)
UPDATE public.workflows 
SET company_id = (SELECT id FROM public.companies WHERE slug = 'fundcera' AND is_active = true LIMIT 1)
WHERE company_id IS NULL;
