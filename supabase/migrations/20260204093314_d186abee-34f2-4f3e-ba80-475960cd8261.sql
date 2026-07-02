-- Add bank_application_id column to bank_submissions table
ALTER TABLE public.bank_submissions 
ADD COLUMN IF NOT EXISTS bank_application_id text;