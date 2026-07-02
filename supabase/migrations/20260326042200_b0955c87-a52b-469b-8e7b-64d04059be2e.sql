
CREATE OR REPLACE FUNCTION public.get_agency_company_stats()
 RETURNS TABLE(company_id uuid, total_leads bigint, paid_leads bigint, total_revenue numeric, pending_royalty numeric, collected_royalty numeric)
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
    FROM leads WHERE leads.company_id = c.id
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC AS total_revenue
    FROM payments WHERE payments.company_id = c.id AND payments.status IN ('captured', 'completed', 'paid')
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT 
      COALESCE(SUM(royalty_amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC AS pending_royalty,
      COALESCE(SUM(royalty_amount) FILTER (WHERE status = 'collected'), 0)::NUMERIC AS collected_royalty
    FROM royalty_transactions WHERE royalty_transactions.company_id = c.id
  ) r ON true
  WHERE c.is_active = true
  ORDER BY l.total_leads DESC;
$$;
