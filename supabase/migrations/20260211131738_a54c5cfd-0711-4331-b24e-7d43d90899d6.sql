
-- Add error_details column to whatsapp_messages for tracking delivery failures
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS error_details text;

-- Fix the expired scontent.whatsapp.net URL in morning template
UPDATE public.whatsapp_templates 
SET header_url = 'https://oreyfqrqkdgbkmnnnlqh.supabase.co/storage/v1/object/public/public-assets/fundcera-logo.png'
WHERE name = 'morning' AND header_url LIKE '%scontent.whatsapp.net%';
