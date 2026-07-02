-- Migration: 20260614133000_monthly_royalty_billing.sql
-- Restructure royalty transactions from per-lead events to monthly aggregated invoices with GST and revenue-share percentage options.

-- 1. Clean up old transaction-level rows
TRUNCATE public.royalty_transactions CASCADE;

-- 2. Add new columns to companies table for pricing models
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS royalty_type        TEXT NOT NULL DEFAULT 'per_lead',
  ADD COLUMN IF NOT EXISTS royalty_percentage  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_rate            NUMERIC NOT NULL DEFAULT 18.0;

-- 3. Modify royalty_transactions to support monthly invoices
ALTER TABLE public.royalty_transactions
  ALTER COLUMN lead_id DROP NOT NULL,
  ALTER COLUMN payment_id DROP NOT NULL;

ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS monthly_fee     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount      NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_amount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure unique constraint on company_id and month_year
ALTER TABLE public.royalty_transactions
  DROP CONSTRAINT IF EXISTS unique_company_month_invoice;

ALTER TABLE public.royalty_transactions
  ADD CONSTRAINT unique_company_month_invoice UNIQUE (company_id, month_year);

-- 4. Drop old triggers and functions
DROP TRIGGER IF EXISTS trigger_auto_royalty_on_paid ON public.leads;
DROP FUNCTION IF EXISTS public.auto_create_royalty_on_payment();
DROP TRIGGER IF EXISTS trigger_royalty_month_year ON public.royalty_transactions;
DROP FUNCTION IF EXISTS public.set_royalty_month_year();

-- 5. Create core PL/pgSQL function to refresh/calculate a monthly invoice
CREATE OR REPLACE FUNCTION public.refresh_monthly_royalty_invoice(p_company_id UUID, p_month_year TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_fee NUMERIC;
  v_setup_fee NUMERIC;
  v_royalty_per_lead NUMERIC;
  v_royalty_type TEXT;
  v_royalty_percentage NUMERIC;
  v_gst_rate NUMERIC;
  
  v_lead_count INTEGER;
  v_revenue_amount NUMERIC;
  v_royalty_amount NUMERIC;
  v_gst_amount NUMERIC;
  v_total_amount NUMERIC;
  v_invoice_number TEXT;
  v_due_date DATE;
  v_status TEXT := 'pending';
BEGIN
  -- A. Fetch company pricing terms
  SELECT 
    COALESCE(monthly_fee, 0), 
    COALESCE(setup_fee, 0), 
    COALESCE(royalty_per_lead, 0), 
    COALESCE(royalty_type, 'per_lead'), 
    COALESCE(royalty_percentage, 0), 
    COALESCE(gst_rate, 18.0)
  INTO 
    v_monthly_fee, v_setup_fee, v_royalty_per_lead, v_royalty_type, v_royalty_percentage, v_gst_rate
  FROM public.companies
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- B. Count paid leads in that month
  SELECT COUNT(*)::INTEGER INTO v_lead_count
  FROM public.leads
  WHERE company_id = p_company_id
    AND status = 'paid'
    AND TO_CHAR(updated_at, 'YYYY-MM') = p_month_year;
     
  -- C. Sum completed payments in that month
  SELECT COALESCE(SUM(amount), 0)::NUMERIC INTO v_revenue_amount
  FROM public.payments
  WHERE company_id = p_company_id
    AND status IN ('captured', 'completed', 'paid')
    AND TO_CHAR(created_at, 'YYYY-MM') = p_month_year;
     
  -- D. Calculate royalty amount based on pricing model
  IF v_royalty_type = 'percentage' THEN
    v_royalty_amount := v_revenue_amount * (v_royalty_percentage / 100.0);
  ELSE
    v_royalty_amount := v_lead_count * v_royalty_per_lead;
  END IF;
  
  -- E. Calculate GST of 18% (or company set gst_rate) on the royalty amount
  v_gst_amount := v_royalty_amount * (v_gst_rate / 100.0);
  
  -- F. Calculate invoice total
  v_total_amount := v_monthly_fee + v_royalty_amount + v_gst_amount;
  
  -- G. Keep existing status and invoice number if already present
  SELECT status, invoice_number INTO v_status, v_invoice_number
  FROM public.royalty_transactions
  WHERE company_id = p_company_id AND month_year = p_month_year;
  
  IF v_invoice_number IS NULL THEN
    v_invoice_number := public.generate_royalty_invoice_number(p_company_id, p_month_year);
  END IF;
  
  IF v_status IS NULL THEN
    v_status := 'pending';
  END IF;
  
  -- Calculate due date: 7th of next month
  v_due_date := (DATE_TRUNC('month', TO_DATE(p_month_year || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' + INTERVAL '6 days')::DATE;
  
  -- H. Upsert invoice row
  INSERT INTO public.royalty_transactions (
    company_id,
    month_year,
    royalty_amount,
    monthly_fee,
    gst_amount,
    total_amount,
    lead_count,
    revenue_amount,
    invoice_number,
    due_date,
    status,
    royalty_type
  )
  VALUES (
    p_company_id,
    p_month_year,
    v_royalty_amount,
    v_monthly_fee,
    v_gst_amount,
    v_total_amount,
    v_lead_count,
    v_revenue_amount,
    v_invoice_number,
    v_due_date,
    v_status,
    v_royalty_type
  )
  ON CONFLICT (company_id, month_year) DO UPDATE SET
    royalty_amount = EXCLUDED.royalty_amount,
    monthly_fee = EXCLUDED.monthly_fee,
    gst_amount = EXCLUDED.gst_amount,
    total_amount = EXCLUDED.total_amount,
    lead_count = EXCLUDED.lead_count,
    revenue_amount = EXCLUDED.revenue_amount,
    due_date = EXCLUDED.due_date,
    royalty_type = EXCLUDED.royalty_type,
    updated_at = now();
END;
$$;

-- 6. Trigger for leads updates
CREATE OR REPLACE FUNCTION public.trigger_refresh_monthly_royalty_on_lead_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    PERFORM public.refresh_monthly_royalty_invoice(NEW.company_id, TO_CHAR(NEW.updated_at, 'YYYY-MM'));
  END IF;
  IF OLD.company_id IS NOT NULL AND OLD.company_id != NEW.company_id THEN
    PERFORM public.refresh_monthly_royalty_invoice(OLD.company_id, TO_CHAR(OLD.updated_at, 'YYYY-MM'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_lead_refresh_monthly_royalty
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_monthly_royalty_on_lead_change();

-- 7. Trigger for payments updates/inserts
CREATE OR REPLACE FUNCTION public.trigger_refresh_monthly_royalty_on_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    PERFORM public.refresh_monthly_royalty_invoice(NEW.company_id, TO_CHAR(NEW.created_at, 'YYYY-MM'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_payment_refresh_monthly_royalty
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_monthly_royalty_on_payment_change();

-- 8. Re-define royalty_monthly_summary view to serve from new invoice structure
CREATE OR REPLACE VIEW public.royalty_monthly_summary AS
SELECT 
  rt.id                                                                  AS id,
  rt.company_id,
  c.name                                                                 AS company_name,
  rt.month_year,
  rt.lead_count                                                          AS transaction_count,
  rt.revenue_amount                                                      AS revenue_amount,
  rt.royalty_amount                                                      AS total_royalty,
  rt.monthly_fee                                                         AS monthly_fee,
  rt.gst_amount                                                          AS gst_amount,
  rt.total_amount                                                        AS total_amount,
  CASE WHEN rt.status = 'collected' THEN rt.total_amount ELSE 0 END      AS collected,
  CASE WHEN rt.status = 'pending'   THEN rt.total_amount ELSE 0 END      AS pending,
  rt.due_date                                                            AS earliest_due_date,
  rt.updated_at                                                          AS last_transaction_at,
  rt.invoice_number                                                      AS invoice_number,
  rt.status                                                              AS status
FROM public.royalty_transactions rt
JOIN public.companies c ON c.id = rt.company_id;

-- 9. Auto-calculate and seed invoices based on all existing leads and payments in the DB
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT company_id, TO_CHAR(updated_at, 'YYYY-MM') AS month_year
    FROM public.leads
    WHERE company_id IS NOT NULL
    UNION
    SELECT DISTINCT company_id, TO_CHAR(created_at, 'YYYY-MM') AS month_year
    FROM public.payments
    WHERE company_id IS NOT NULL
  ) LOOP
    PERFORM public.refresh_monthly_royalty_invoice(r.company_id, r.month_year);
  END LOOP;
END $$;
