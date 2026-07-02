-- Add google_analytics_id column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS google_analytics_id text;

-- Update Finance Fundcera with the GA ID
UPDATE public.companies 
SET google_analytics_id = 'G-5255WHW6WW'
WHERE slug = 'finance';