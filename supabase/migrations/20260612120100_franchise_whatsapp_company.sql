-- Migration: 20260612120100_franchise_whatsapp_company.sql
-- Link whatsapp_accounts to companies for per-franchise WABA

ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_company_id ON public.whatsapp_accounts(company_id);

-- Helper: get default WhatsApp account for a company
CREATE OR REPLACE FUNCTION public.get_company_whatsapp_account(p_company_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.whatsapp_accounts 
  WHERE company_id = p_company_id 
  ORDER BY created_at ASC
  LIMIT 1;
$$;
