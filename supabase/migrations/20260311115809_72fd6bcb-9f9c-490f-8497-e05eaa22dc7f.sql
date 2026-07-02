
-- Add SaaS columns to companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS setup_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_fee_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS royalty_per_lead NUMERIC DEFAULT 0;

-- Company integrations table (BYOK credentials per service)
CREATE TABLE public.company_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL, -- 'whatsapp', 'sms', 'google_analytics', 'meta_pixel', 'meta_ads'
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, service_type)
);

-- Royalty transactions table
CREATE TABLE public.royalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  royalty_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'collected', 'waived'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage integrations
CREATE POLICY "Admin can manage integrations" ON public.company_integrations
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view integrations" ON public.company_integrations
  FOR SELECT USING (is_staff(auth.uid()));

-- RLS: Only admins can manage royalties
CREATE POLICY "Admin can manage royalties" ON public.royalty_transactions
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view royalties" ON public.royalty_transactions
  FOR SELECT USING (is_staff(auth.uid()));

-- Public domain lookup function (for resolving domain → company)
CREATE OR REPLACE FUNCTION public.lookup_company_by_domain(_domain TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, logo_url TEXT, primary_color TEXT, secondary_color TEXT, 
              phone TEXT, email TEXT, whatsapp_number TEXT, website_url TEXT, meta_pixel_id TEXT, 
              google_analytics_id TEXT, custom_domain TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.secondary_color,
         c.phone, c.email, c.whatsapp_number, c.website_url, c.meta_pixel_id,
         c.google_analytics_id, c.custom_domain
  FROM public.companies c
  WHERE c.is_active = true
    AND (c.custom_domain = _domain OR c.website_url LIKE '%' || _domain || '%')
  LIMIT 1;
$$;

-- Trigger function to auto-create royalty on paid leads
CREATE OR REPLACE FUNCTION public.auto_create_royalty_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_royalty NUMERIC;
  v_company_id UUID;
BEGIN
  -- Only trigger on status change to paid-related statuses
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_company_id := NEW.company_id;
    
    IF v_company_id IS NOT NULL THEN
      SELECT royalty_per_lead INTO v_royalty 
      FROM companies WHERE id = v_company_id;
      
      IF v_royalty IS NOT NULL AND v_royalty > 0 THEN
        -- Check if royalty already exists for this lead
        IF NOT EXISTS (SELECT 1 FROM royalty_transactions WHERE lead_id = NEW.id) THEN
          INSERT INTO royalty_transactions (company_id, lead_id, royalty_amount, status)
          VALUES (v_company_id, NEW.id, v_royalty, 'pending');
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to leads table
CREATE TRIGGER trigger_auto_royalty_on_paid
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_royalty_on_payment();
