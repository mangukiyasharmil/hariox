ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS header_type TEXT DEFAULT NULL;
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS header_url TEXT DEFAULT NULL;