-- Migration: 20260612120000_franchise_sms_company.sql
-- Add company_id to sms_logs for per-franchise SMS tracking

ALTER TABLE public.sms_logs 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_company_id ON public.sms_logs(company_id);
