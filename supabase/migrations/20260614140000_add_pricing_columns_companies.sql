-- Safe migration: add royalty pricing & GST columns to companies table
-- Uses IF NOT EXISTS so it is safe to run multiple times

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS royalty_type        TEXT    NOT NULL DEFAULT 'per_lead',
  ADD COLUMN IF NOT EXISTS royalty_percentage  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_rate            NUMERIC NOT NULL DEFAULT 18.0;

-- Add monthly invoice columns to royalty_transactions (safe, idempotent)
ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS monthly_fee     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount      NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_amount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- Make lead_id nullable (safe: only drops NOT NULL if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'royalty_transactions'
      AND column_name = 'lead_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.royalty_transactions ALTER COLUMN lead_id DROP NOT NULL;
  END IF;
END $$;

-- Add unique constraint on (company_id, month_year) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'royalty_transactions'
      AND constraint_name = 'unique_company_month_invoice'
  ) THEN
    ALTER TABLE public.royalty_transactions
      ADD CONSTRAINT unique_company_month_invoice UNIQUE (company_id, month_year);
  END IF;
END $$;

-- Reload PostgREST schema cache so new columns are immediately visible
NOTIFY pgrst, 'reload schema';
