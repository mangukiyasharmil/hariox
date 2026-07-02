-- Migration: 20260614150000_fix_royalty_billing_complete.sql
-- Fixes:
--   1. Add missing sms_charges, whatsapp_charges, other_charges, other_charges_description columns
--   2. Add royalty_type column to royalty_transactions (for view)
--   3. Fix GST: apply on full subtotal (monthly_fee + royalty + extra charges)
--   4. Update royalty_monthly_summary view to expose all new columns
--   5. Add trigger: when company pricing config changes → recalculate all invoices
--   6. Re-seed all invoices with corrected GST logic

-- ─── Step 1: Add missing charge columns to royalty_transactions ─────────────
ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS sms_charges               NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_charges          NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges             NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges_description TEXT;

ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS royalty_type TEXT NOT NULL DEFAULT 'per_lead';

-- ─── Step 2: Fix refresh_monthly_royalty_invoice function ───────────────────
-- Corrects GST: apply on full subtotal (monthly_fee + royalty_amount + extra charges)
-- Preserves sms_charges / whatsapp_charges / other_charges already stored
CREATE OR REPLACE FUNCTION public.refresh_monthly_royalty_invoice(p_company_id UUID, p_month_year TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_fee      NUMERIC;
  v_royalty_per_lead NUMERIC;
  v_royalty_type     TEXT;
  v_royalty_percentage NUMERIC;
  v_gst_rate         NUMERIC;

  v_lead_count       INTEGER;
  v_revenue_amount   NUMERIC;
  v_royalty_amount   NUMERIC;

  -- Preserve existing extra charges (don't overwrite manual entries)
  v_sms_charges      NUMERIC := 0;
  v_whatsapp_charges NUMERIC := 0;
  v_other_charges    NUMERIC := 0;
  v_other_desc       TEXT    := NULL;

  v_subtotal         NUMERIC;
  v_gst_amount       NUMERIC;
  v_total_amount     NUMERIC;
  v_invoice_number   TEXT;
  v_due_date         DATE;
  v_status           TEXT := 'pending';
BEGIN
  -- A. Fetch company pricing terms
  SELECT
    COALESCE(monthly_fee, 0),
    COALESCE(royalty_per_lead, 0),
    COALESCE(royalty_type, 'per_lead'),
    COALESCE(royalty_percentage, 0),
    COALESCE(gst_rate, 18.0)
  INTO
    v_monthly_fee, v_royalty_per_lead, v_royalty_type, v_royalty_percentage, v_gst_rate
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

  -- C. Sum completed payments in that month (use total_amount if available, else amount)
  SELECT COALESCE(SUM(COALESCE(total_amount, amount)), 0)::NUMERIC INTO v_revenue_amount
  FROM public.payments
  WHERE company_id = p_company_id
    AND status IN ('captured', 'completed', 'paid')
    AND TO_CHAR(created_at, 'YYYY-MM') = p_month_year;

  -- D. Calculate royalty based on pricing model
  IF v_royalty_type = 'percentage' THEN
    v_royalty_amount := v_revenue_amount * (v_royalty_percentage / 100.0);
  ELSE
    v_royalty_amount := v_lead_count * v_royalty_per_lead;
  END IF;

  -- E. Preserve existing status, invoice_number, and extra charges (don't reset manual edits)
  SELECT
    COALESCE(status, 'pending'),
    invoice_number,
    COALESCE(sms_charges, 0),
    COALESCE(whatsapp_charges, 0),
    COALESCE(other_charges, 0),
    other_charges_description
  INTO
    v_status, v_invoice_number, v_sms_charges, v_whatsapp_charges, v_other_charges, v_other_desc
  FROM public.royalty_transactions
  WHERE company_id = p_company_id AND month_year = p_month_year;

  IF v_invoice_number IS NULL THEN
    v_invoice_number := public.generate_royalty_invoice_number(p_company_id, p_month_year);
  END IF;

  -- F. Calculate GST on FULL subtotal (correct: monthly fee + royalty + all charges)
  v_subtotal    := v_monthly_fee + v_royalty_amount + v_sms_charges + v_whatsapp_charges + v_other_charges;
  v_gst_amount  := ROUND(v_subtotal * (v_gst_rate / 100.0), 2);
  v_total_amount := v_subtotal + v_gst_amount;

  -- G. Due date: 7th of next month
  v_due_date := (DATE_TRUNC('month', TO_DATE(p_month_year || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' + INTERVAL '6 days')::DATE;

  -- H. Upsert invoice row — always recalculate royalty/gst/total; preserve extra charges and status
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
    royalty_type,
    sms_charges,
    whatsapp_charges,
    other_charges,
    other_charges_description
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
    v_royalty_type,
    v_sms_charges,
    v_whatsapp_charges,
    v_other_charges,
    v_other_desc
  )
  ON CONFLICT (company_id, month_year) DO UPDATE SET
    royalty_amount             = EXCLUDED.royalty_amount,
    monthly_fee                = EXCLUDED.monthly_fee,
    gst_amount                 = EXCLUDED.gst_amount,
    total_amount               = EXCLUDED.total_amount,
    lead_count                 = EXCLUDED.lead_count,
    revenue_amount             = EXCLUDED.revenue_amount,
    due_date                   = EXCLUDED.due_date,
    royalty_type               = EXCLUDED.royalty_type,
    -- sms/whatsapp/other charges are NOT overwritten here so manual edits are preserved
    updated_at                 = now();
END;
$$;

-- ─── Step 3: Add trigger for company pricing config changes ──────────────────
-- When admin changes royalty_per_lead, royalty_percentage, royalty_type, gst_rate, monthly_fee
-- → recalculate ALL existing monthly invoices for that company
CREATE OR REPLACE FUNCTION public.trigger_refresh_all_company_invoices_on_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Only recompute if pricing-related fields changed
  IF (
    OLD.royalty_per_lead      IS DISTINCT FROM NEW.royalty_per_lead      OR
    OLD.royalty_type          IS DISTINCT FROM NEW.royalty_type          OR
    OLD.royalty_percentage    IS DISTINCT FROM NEW.royalty_percentage    OR
    OLD.gst_rate              IS DISTINCT FROM NEW.gst_rate              OR
    OLD.monthly_fee           IS DISTINCT FROM NEW.monthly_fee
  ) THEN
    -- Refresh every existing invoice for this company
    FOR r IN (
      SELECT DISTINCT month_year
      FROM public.royalty_transactions
      WHERE company_id = NEW.id
    ) LOOP
      PERFORM public.refresh_monthly_royalty_invoice(NEW.id, r.month_year);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_company_config_refresh_invoices ON public.companies;

CREATE TRIGGER trigger_company_config_refresh_invoices
  AFTER UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_all_company_invoices_on_config_change();

-- ─── Step 4: Update royalty_monthly_summary view ─────────────────────────────
-- Expose all new columns including sms/whatsapp/other charges and royalty_type
DROP VIEW IF EXISTS public.royalty_monthly_summary CASCADE;
CREATE OR REPLACE VIEW public.royalty_monthly_summary AS
SELECT
  rt.id,
  rt.company_id,
  c.name                                                                  AS company_name,
  rt.month_year,
  rt.lead_count                                                           AS transaction_count,
  rt.revenue_amount,
  rt.royalty_amount                                                       AS total_royalty,
  rt.monthly_fee,
  rt.sms_charges,
  rt.whatsapp_charges,
  rt.other_charges,
  rt.other_charges_description,
  rt.royalty_type,
  rt.gst_amount,
  rt.total_amount,
  CASE WHEN rt.status = 'collected' THEN rt.total_amount ELSE 0 END       AS collected,
  CASE WHEN rt.status = 'pending'   THEN rt.total_amount ELSE 0 END       AS pending,
  rt.due_date                                                             AS earliest_due_date,
  rt.updated_at                                                           AS last_transaction_at,
  rt.invoice_number,
  rt.status
FROM public.royalty_transactions rt
JOIN public.companies c ON c.id = rt.company_id;

-- ─── Step 5: Re-seed all invoices with corrected GST logic ───────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT company_id, month_year
    FROM public.royalty_transactions
    WHERE company_id IS NOT NULL AND month_year IS NOT NULL
  ) LOOP
    PERFORM public.refresh_monthly_royalty_invoice(r.company_id, r.month_year);
  END LOOP;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
