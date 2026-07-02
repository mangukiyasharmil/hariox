-- Add monthly_fee column to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 0;
