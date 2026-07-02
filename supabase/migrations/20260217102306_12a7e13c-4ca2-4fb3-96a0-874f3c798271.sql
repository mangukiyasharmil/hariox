-- Drop the old 2-param version that doesn't support company filtering
DROP FUNCTION IF EXISTS public.get_sms_stats(timestamp with time zone, timestamp with time zone);
