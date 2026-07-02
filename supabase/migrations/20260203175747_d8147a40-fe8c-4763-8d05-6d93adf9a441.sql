-- Create RPC function to get accurate SMS statistics without row limits
CREATE OR REPLACE FUNCTION get_sms_stats(start_date TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ)
RETURNS TABLE (
  total_count BIGINT,
  sent_count BIGINT,
  delivered_count BIGINT,
  failed_count BIGINT,
  pending_count BIGINT,
  submitted_count BIGINT,
  rejected_count BIGINT,
  total_cost NUMERIC,
  by_type JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
       FROM (SELECT sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs 
             WHERE created_at >= start_date
             GROUP BY sms_type) sub),
      '{}'::jsonb
    ) as by_type
  FROM sms_logs
  WHERE created_at >= start_date;
END;
$$;