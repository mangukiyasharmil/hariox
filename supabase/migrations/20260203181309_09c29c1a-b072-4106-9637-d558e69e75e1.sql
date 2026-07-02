-- Update get_sms_stats function to support end_date parameter for accurate date range filtering
CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  total_count bigint, 
  sent_count bigint, 
  delivered_count bigint, 
  failed_count bigint, 
  pending_count bigint, 
  submitted_count bigint, 
  rejected_count bigint, 
  total_cost numeric, 
  by_type jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_count,
    COALESCE(SUM(COALESCE(cost_credits, 0)), 0)::NUMERIC as total_cost,
    COALESCE(
      (SELECT jsonb_object_agg(sms_type, cnt) 
       FROM (SELECT l.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs l
             WHERE l.created_at >= start_date
               AND (end_date IS NULL OR l.created_at <= end_date)
             GROUP BY l.sms_type) sub),
      '{}'::jsonb
    ) as by_type
  FROM sms_logs s
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date);
END;
$function$;