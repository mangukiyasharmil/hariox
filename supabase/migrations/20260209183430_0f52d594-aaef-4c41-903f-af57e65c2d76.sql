
DROP FUNCTION IF EXISTS public.get_sms_stats(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
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
  total_segments bigint,
  delivered_segments bigint,
  by_type jsonb,
  by_error jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE s.status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE s.status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE s.status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::BIGINT as rejected_count,
    -- Cost based on segments: >160 chars = 2 segments, else 1
    COALESCE(
      SUM(CASE WHEN s.status = 'delivered' THEN 
        (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END) * 0.11
      ELSE 0 END), 0
    )::NUMERIC as total_cost,
    -- Total segments (all SMS)
    COALESCE(SUM(CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END), 0)::BIGINT as total_segments,
    -- Delivered segments only
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COALESCE(
      (SELECT jsonb_object_agg(l.sms_type, cnt) 
       FROM (SELECT sl.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs sl
             WHERE sl.created_at >= start_date
               AND (end_date IS NULL OR sl.created_at <= end_date)
             GROUP BY sl.sms_type) l),
      '{}'::jsonb
    ) as by_type,
    COALESCE(
      (SELECT jsonb_object_agg(err_code, err_cnt)
       FROM (SELECT 
               CASE 
                 WHEN el.error_message LIKE 'Failed (Error: %)' 
                   THEN SUBSTRING(el.error_message FROM 'Failed \(Error: ([^)]+)\)')
                 WHEN el.error_message IS NOT NULL THEN el.error_message
                 ELSE 'unknown'
               END as err_code,
               COUNT(*)::BIGINT as err_cnt
             FROM sms_logs el
             WHERE el.status = 'failed'
               AND el.created_at >= start_date
               AND (end_date IS NULL OR el.created_at <= end_date)
             GROUP BY 1) errs),
      '{}'::jsonb
    ) as by_error
  FROM sms_logs s
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date);
END;
$function$;
