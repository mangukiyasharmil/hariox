-- Create trigger to auto-calculate lead score after relevant actions
CREATE OR REPLACE FUNCTION public.trigger_recalculate_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate the lead score
  PERFORM calculate_lead_score(COALESCE(NEW.lead_id, OLD.lead_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on payments
DROP TRIGGER IF EXISTS recalc_score_on_payment ON payments;
CREATE TRIGGER recalc_score_on_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- Trigger on call_logs
DROP TRIGGER IF EXISTS recalc_score_on_call ON call_logs;
CREATE TRIGGER recalc_score_on_call
  AFTER INSERT ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- Trigger on documents
DROP TRIGGER IF EXISTS recalc_score_on_document ON documents;
CREATE TRIGGER recalc_score_on_document
  AFTER INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- Trigger on activity_logs
DROP TRIGGER IF EXISTS recalc_score_on_activity ON activity_logs;
CREATE TRIGGER recalc_score_on_activity
  AFTER INSERT ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();