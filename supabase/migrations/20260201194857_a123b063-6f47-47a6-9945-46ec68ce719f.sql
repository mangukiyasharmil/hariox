-- Drop and recreate the public lead submission policy to allow early phone-based lead capture
DROP POLICY IF EXISTS "Public can submit loan applications" ON public.leads;

-- Create updated policy that allows website-otp sources and minimal phone-only leads
CREATE POLICY "Public can submit loan applications"
ON public.leads
FOR INSERT
WITH CHECK (
  -- Must be unpaid status
  status = 'unpaid' 
  -- Allow various website sources including OTP-verified leads
  AND (source IS NULL OR source LIKE 'website%' OR source LIKE 'whatsapp%')
  -- Phone is always required and validated
  AND phone IS NOT NULL 
  AND phone ~ '^[6-9][0-9]{9}$'
  -- Full name must exist (can be placeholder for phone-only leads)
  AND full_name IS NOT NULL 
  AND length(trim(full_name)) >= 2
  -- Email must exist (can be placeholder for phone-only leads)  
  AND email IS NOT NULL
  -- Loan amount must be positive
  AND loan_amount IS NOT NULL 
  AND loan_amount > 0
  -- Monthly income must be positive
  AND monthly_income IS NOT NULL 
  AND monthly_income > 0
  -- City is required (can be placeholder)
  AND city IS NOT NULL
  -- Optional fields validation
  AND (pincode IS NULL OR pincode::text ~ '^[1-9][0-9]{5}$')
  AND (state IS NULL OR length(trim(state::text)) <= 50)
);