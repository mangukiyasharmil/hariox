
CREATE OR REPLACE FUNCTION public.get_sms_stats_by_company(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  company_id uuid,
  delivered_count bigint,
  delivered_segments bigint,
  otp_count bigint,
  remarketing_count bigint,
  other_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    l.company_id,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type = 'otp')::BIGINT as otp_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type IN ('remarketing', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as remarketing_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type NOT IN ('otp', 'remarketing', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as other_count
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
  GROUP BY l.company_id;
END;
$function$;
