
-- Add Meta-specific fields to whatsapp_templates
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS category text DEFAULT 'UTILITY';
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS meta_status text DEFAULT 'LOCAL';
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS meta_template_id text;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
