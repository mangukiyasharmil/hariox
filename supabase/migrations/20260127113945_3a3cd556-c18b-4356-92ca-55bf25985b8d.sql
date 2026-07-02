-- Drop existing insert policy and create one that allows anonymous users
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;

-- Create policy that allows anyone (including anonymous) to insert leads
CREATE POLICY "Public can submit loan applications"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also fix payments table - anonymous users need to be able to see payment status
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;

CREATE POLICY "Public can create payments"
ON public.payments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);