-- Add meta_variables_count to track how many params each template expects from Meta
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS meta_variables_count integer DEFAULT 0;

-- Update existing "morning" template which expects 1 param (name)
UPDATE public.whatsapp_templates SET meta_variables_count = 1 WHERE name = 'morning';