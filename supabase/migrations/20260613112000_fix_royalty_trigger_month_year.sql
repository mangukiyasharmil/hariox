-- Migration: 20260613112000_fix_royalty_trigger_month_year.sql
-- Fix set_royalty_month_year function to handle default created_at being evaluated after before-insert trigger

CREATE OR REPLACE FUNCTION public.set_royalty_month_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.month_year := TO_CHAR(COALESCE(NEW.created_at, now()), 'YYYY-MM');
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (DATE_TRUNC('month', COALESCE(NEW.created_at, now())) + INTERVAL '1 month' + INTERVAL '7 days')::DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- Update any existing royalty transactions with NULL month_year or due_date
UPDATE public.royalty_transactions
SET month_year = TO_CHAR(created_at, 'YYYY-MM')
WHERE month_year IS NULL;

UPDATE public.royalty_transactions
SET due_date = (DATE_TRUNC('month', created_at) + INTERVAL '1 month' + INTERVAL '7 days')::DATE
WHERE due_date IS NULL;
