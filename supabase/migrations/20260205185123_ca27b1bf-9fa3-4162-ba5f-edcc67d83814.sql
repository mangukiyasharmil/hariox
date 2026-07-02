
-- Add page_path column for analytics "Pages and Screens" reporting
ALTER TABLE public.analytics_events 
ADD COLUMN IF NOT EXISTS page_path TEXT;

-- Create index for faster page path queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON public.analytics_events(page_path);
