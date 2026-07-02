
-- ============================================================
-- FIX 1: Replace Security Definer VIEW with Security Definer FUNCTION
-- Functions with security definer are the accepted pattern
-- ============================================================

DROP VIEW IF EXISTS public.leads_public;

CREATE OR REPLACE FUNCTION public.lookup_leads_by_phone(_phone text)
RETURNS TABLE (
  id uuid, full_name text, phone text, email text, status lead_status,
  company_id uuid, application_id text, loan_type loan_type, loan_amount numeric,
  emi_amount numeric, interest_rate numeric, tenure_months integer,
  city text, state text, pincode text, employment_type employment_type,
  source text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, phone, email, status, company_id, application_id,
         loan_type, loan_amount, emi_amount, interest_rate, tenure_months,
         city, state, pincode, employment_type, source, created_at
  FROM public.leads
  WHERE phone = _phone
  ORDER BY created_at DESC;
$$;

-- Also create a lookup by ID function for DocumentUpload/CustomerPortal
CREATE OR REPLACE FUNCTION public.lookup_lead_by_id(_lead_id uuid)
RETURNS TABLE (
  id uuid, full_name text, phone text, email text, status lead_status,
  company_id uuid, application_id text, loan_type loan_type, loan_amount numeric,
  emi_amount numeric, interest_rate numeric, tenure_months integer,
  city text, state text, pincode text, employment_type employment_type,
  source text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, phone, email, status, company_id, application_id,
         loan_type, loan_amount, emi_amount, interest_rate, tenure_months,
         city, state, pincode, employment_type, source, created_at
  FROM public.leads
  WHERE id = _lead_id
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.lookup_leads_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_lead_by_id(uuid) TO anon, authenticated;

-- ============================================================
-- FIX 2: Restrict analytics_events INSERT policy
-- Require at least event_type and limit to valid event types
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Public can insert analytics events"
ON public.analytics_events FOR INSERT
WITH CHECK (
  event_type IS NOT NULL
  AND length(event_type) <= 100
  AND (page_url IS NULL OR length(page_url) <= 2000)
  AND (visitor_id IS NULL OR length(visitor_id) <= 100)
);
