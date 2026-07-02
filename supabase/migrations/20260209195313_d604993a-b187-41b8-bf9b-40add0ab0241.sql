ALTER TABLE public.whatsapp_campaigns 
ADD COLUMN IF NOT EXISTS target_date_from timestamptz,
ADD COLUMN IF NOT EXISTS target_date_to timestamptz;