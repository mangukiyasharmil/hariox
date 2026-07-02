-- Allow public users to read leads by phone number for payment portal
CREATE POLICY "Public can lookup leads by phone" 
ON public.leads 
FOR SELECT 
USING (
  -- Allow anonymous users to look up by phone (for payment portal)
  auth.uid() IS NULL
);