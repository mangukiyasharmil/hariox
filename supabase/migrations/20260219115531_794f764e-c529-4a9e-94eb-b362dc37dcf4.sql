-- Add media_url column to whatsapp_messages to store media URLs for images, audio, video, documents
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT DEFAULT NULL;