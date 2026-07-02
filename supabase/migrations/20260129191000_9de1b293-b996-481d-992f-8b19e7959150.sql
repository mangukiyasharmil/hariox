-- Create table to store OTP codes with rate limiting
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(10) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_otp_codes_phone_expires ON public.otp_codes(phone, expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous insert (for sending OTP)
CREATE POLICY "Anyone can request OTP" ON public.otp_codes
  FOR INSERT WITH CHECK (true);

-- Policy: Allow anonymous select for verification
CREATE POLICY "Anyone can verify OTP" ON public.otp_codes
  FOR SELECT USING (true);

-- Policy: Allow anonymous update for marking verified
CREATE POLICY "Anyone can mark OTP verified" ON public.otp_codes
  FOR UPDATE USING (true);

-- Cleanup function to delete expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < now() - interval '1 hour';
END;
$$;