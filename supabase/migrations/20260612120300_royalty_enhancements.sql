-- Migration: 20260612120300_royalty_enhancements.sql
-- Enhance royalty tracking with invoice numbers, due dates, monthly grouping, and bulk collection

-- Enhance royalty_transactions table
ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS royalty_type    TEXT NOT NULL DEFAULT 'per_lead',
  ADD COLUMN IF NOT EXISTS invoice_number  TEXT,
  ADD COLUMN IF NOT EXISTS due_date        DATE,
  ADD COLUMN IF NOT EXISTS month_year      TEXT; -- e.g. '2026-06' for grouping

-- Auto-set month_year (and optionally due_date) on insert
CREATE OR REPLACE FUNCTION public.set_royalty_month_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.month_year := TO_CHAR(NEW.created_at, 'YYYY-MM');
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (DATE_TRUNC('month', NEW.created_at) + INTERVAL '1 month' + INTERVAL '7 days')::DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger first if it exists, then recreate to keep idempotent
DROP TRIGGER IF EXISTS trigger_royalty_month_year ON public.royalty_transactions;

CREATE TRIGGER trigger_royalty_month_year
  BEFORE INSERT ON public.royalty_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_royalty_month_year();

-- Monthly summary view
CREATE OR REPLACE VIEW public.royalty_monthly_summary AS
SELECT 
  rt.company_id,
  c.name                                                                          AS company_name,
  rt.month_year,
  COUNT(*)                                                                        AS transaction_count,
  SUM(rt.royalty_amount)                                                          AS total_royalty,
  SUM(CASE WHEN rt.status = 'collected' THEN rt.royalty_amount ELSE 0 END)       AS collected,
  SUM(CASE WHEN rt.status = 'pending'   THEN rt.royalty_amount ELSE 0 END)       AS pending,
  MIN(rt.due_date)                                                                AS earliest_due_date,
  MAX(rt.created_at)                                                              AS last_transaction_at
FROM public.royalty_transactions rt
JOIN public.companies c ON c.id = rt.company_id
GROUP BY rt.company_id, c.name, rt.month_year;

-- Sequence for sequential invoice numbers
CREATE SEQUENCE IF NOT EXISTS royalty_invoice_seq START 1000;

-- Generate a formatted invoice number: ROY-YYYYMM-NNNN
CREATE OR REPLACE FUNCTION public.generate_royalty_invoice_number(p_company_id UUID, p_month_year TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num TEXT;
BEGIN
  v_num := 'ROY-' || REPLACE(p_month_year, '-', '') || '-' || LPAD(NEXTVAL('royalty_invoice_seq')::TEXT, 4, '0');
  RETURN v_num;
END;
$$;

-- Bulk-collect all pending royalties for a company+month and stamp them with one invoice number
CREATE OR REPLACE FUNCTION public.collect_royalties_bulk(p_company_id UUID, p_month_year TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice TEXT;
  v_count   INTEGER;
BEGIN
  v_invoice := public.generate_royalty_invoice_number(p_company_id, p_month_year);

  UPDATE public.royalty_transactions
  SET status         = 'collected',
      collected_at   = now(),
      invoice_number = v_invoice
  WHERE company_id = p_company_id
    AND month_year  = p_month_year
    AND status      = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
