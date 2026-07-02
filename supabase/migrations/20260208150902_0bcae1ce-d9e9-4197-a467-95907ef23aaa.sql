
CREATE OR REPLACE FUNCTION public.get_analytics_counts(
  p_start timestamptz,
  p_end timestamptz,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE (pageviews bigint, visitors bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    COUNT(*)::bigint as pageviews,
    COUNT(DISTINCT visitor_id)::bigint as visitors
  FROM public.analytics_events
  WHERE event_type IN ('pageview', 'page_view')
    AND (page_path NOT LIKE '/admin%' OR page_path IS NULL)
    AND created_at >= p_start
    AND created_at <= p_end
    AND (
      p_company_id IS NULL 
      OR company_id = p_company_id 
      OR company_id IS NULL
    );
$$;
