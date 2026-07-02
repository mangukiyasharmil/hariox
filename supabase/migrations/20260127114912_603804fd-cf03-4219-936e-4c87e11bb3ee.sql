-- Tighten public insert policy for leads (avoid permissive WITH CHECK (true))
DROP POLICY IF EXISTS "Public can submit loan applications" ON public.leads;

CREATE POLICY "Public can submit loan applications"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'unpaid'::public.lead_status
  AND (source IS NULL OR source = 'website')
  AND full_name IS NOT NULL AND length(btrim(full_name)) BETWEEN 2 AND 100
  AND city IS NOT NULL AND length(btrim(city)) BETWEEN 2 AND 100
  AND email IS NOT NULL AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND phone IS NOT NULL AND phone ~ '^[6-9][0-9]{9}$'
  AND loan_amount IS NOT NULL AND loan_amount > 0
  AND monthly_income IS NOT NULL AND monthly_income > 0
);

-- Payments: remove public insert policy; allow only staff inserts from admin panel
DROP POLICY IF EXISTS "Public can create payments" ON public.payments;

CREATE POLICY "Staff can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  is_staff(auth.uid())
  AND collected_by = auth.uid()
  AND payment_date IS NOT NULL
  AND payment_source IN ('telecaller'::public.payment_source, 'manual'::public.payment_source)
);

-- Documents: remove public insert policy (can be reintroduced later for customer uploads)
DROP POLICY IF EXISTS "Anyone can insert documents" ON public.documents;

CREATE POLICY "Staff can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  is_staff(auth.uid())
  AND status IN ('pending'::public.document_status, 'uploaded'::public.document_status)
);
