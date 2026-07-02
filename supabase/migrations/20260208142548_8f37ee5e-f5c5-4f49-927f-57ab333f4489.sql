
DROP VIEW IF EXISTS public.leads_public;

CREATE VIEW public.leads_public
WITH (security_invoker = false) AS
SELECT 
  id, full_name, phone, email, status, company_id, application_id, 
  loan_type, loan_amount, emi_amount, interest_rate, tenure_months,
  city, state, pincode, employment_type, source, created_at
FROM public.leads;

GRANT SELECT ON public.leads_public TO anon;
GRANT SELECT ON public.leads_public TO authenticated;
