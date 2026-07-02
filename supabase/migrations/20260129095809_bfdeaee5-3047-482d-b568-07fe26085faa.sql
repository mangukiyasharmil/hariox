-- Add 'marketing' as new payment source type
ALTER TYPE public.payment_source ADD VALUE IF NOT EXISTS 'marketing';

-- Comment for clarity
COMMENT ON TYPE public.payment_source IS 'Payment source: direct=main website, marketing=campaign links, telecaller=staff collected, manual=offline';
