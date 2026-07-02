-- Update get_sms_stats to correctly coalesce direct company_id column from sms_logs
CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_company_id uuid DEFAULT NULL
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
    COALESCE(
      SUM(CASE WHEN s.status = 'delivered' THEN 
        (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END) * 0.11
      ELSE 0 END), 0
    )::NUMERIC as total_cost,
    COALESCE(SUM(CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END), 0)::BIGINT as total_segments,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COALESCE(
      (SELECT jsonb_object_agg(l.sms_type, cnt) 
       FROM (SELECT sl.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs sl
             LEFT JOIN leads ld ON sl.lead_id = ld.id
             LEFT JOIN leads ld2 ON sl.lead_id IS NULL AND ld2.phone = RIGHT(sl.phone, 10)
             WHERE sl.created_at >= start_date
               AND (end_date IS NULL OR sl.created_at <= end_date)
               AND (p_company_id IS NULL OR COALESCE(sl.company_id, ld.company_id, ld2.company_id) = p_company_id)
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
             LEFT JOIN leads eld ON el.lead_id = eld.id
             LEFT JOIN leads eld2 ON el.lead_id IS NULL AND eld2.phone = RIGHT(el.phone, 10)
             WHERE el.status = 'failed'
               AND el.created_at >= start_date
               AND (end_date IS NULL OR el.created_at <= end_date)
               AND (p_company_id IS NULL OR COALESCE(el.company_id, eld.company_id, eld2.company_id) = p_company_id)
             GROUP BY 1) errs),
      '{}'::jsonb
    ) as by_error
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  LEFT JOIN leads s_lead ON s.lead_id IS NULL AND s_lead.phone = RIGHT(s.phone, 10)
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
    AND (p_company_id IS NULL OR COALESCE(s.company_id, l.company_id, s_lead.company_id) = p_company_id);
END;
$function$;


-- Update get_sms_stats_by_company to also include direct company_id column from sms_logs
CREATE OR REPLACE FUNCTION public.get_sms_stats_by_company(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  company_id uuid, 
  total_sent_count bigint, 
  delivered_count bigint, 
  failed_count bigint, 
  pending_count bigint, 
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
    COALESCE(s.company_id, l.company_id, s_lead.company_id) as company_id,
    COUNT(*)::BIGINT as total_sent_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE s.status IN ('pending', 'submitted', 'sent'))::BIGINT as pending_count,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type = 'otp')::BIGINT as otp_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type IN ('remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as remarketing_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type NOT IN ('otp', 'remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as other_count
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  LEFT JOIN leads s_lead ON s.lead_id IS NULL AND s_lead.phone = RIGHT(s.phone, 10)
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
  GROUP BY COALESCE(s.company_id, l.company_id, s_lead.company_id);
END;
$function$;
