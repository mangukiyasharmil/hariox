-- Migration: 20260614160000_add_company_gst_number_and_rpc_stats_by_month.sql
-- 1. Add gst_number column to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

-- 2. Create get_agency_company_stats_by_month RPC function
CREATE OR REPLACE FUNCTION public.get_agency_company_stats_by_month(p_month_year text)
 RETURNS TABLE(
   company_id uuid, 
   total_leads bigint, 
   paid_leads bigint, 
   total_revenue numeric, 
   pending_royalty numeric, 
   collected_royalty numeric
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    c.id AS company_id,
    COALESCE(l.total_leads, 0) AS total_leads,
    COALESCE(l.paid_leads, 0) AS paid_leads,
    COALESCE(p.total_revenue, 0) AS total_revenue,
    COALESCE(r.pending_royalty, 0) AS pending_royalty,
    COALESCE(r.collected_royalty, 0) AS collected_royalty
  FROM companies c
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::BIGINT AS total_leads,
      COUNT(*) FILTER (WHERE status IN ('paid','verification','documents_pending','documents_uploaded','verified','processing','approved','disbursed'))::BIGINT AS paid_leads
    FROM leads 
    WHERE leads.company_id = c.id 
      AND (p_month_year = 'all' OR TO_CHAR(leads.created_at, 'YYYY-MM') = p_month_year)
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC AS total_revenue
    FROM payments 
    WHERE payments.company_id = c.id 
      AND payments.status IN ('captured', 'completed', 'paid')
      AND (p_month_year = 'all' OR TO_CHAR(payments.created_at, 'YYYY-MM') = p_month_year)
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT 
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC AS pending_royalty,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'collected'), 0)::NUMERIC AS collected_royalty
    FROM royalty_monthly_summary 
    WHERE royalty_monthly_summary.company_id = c.id
      AND (p_month_year = 'all' OR royalty_monthly_summary.month_year = p_month_year)
  ) r ON true
  WHERE c.is_active = true
  ORDER BY l.total_leads DESC;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
