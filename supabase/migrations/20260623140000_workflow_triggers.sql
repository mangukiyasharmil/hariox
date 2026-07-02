-- Migration: 20260623140000_workflow_triggers.sql
-- Description: Define BEFORE INSERT triggers to automatically populate company_id based on parent relations or authenticated user context.

-- 1. Create or replace the auto-setting company_id function
CREATE OR REPLACE FUNCTION public.auto_set_company_id()
RETURNS TRIGGER AS $$
DECLARE
  resolved_company_id UUID := NULL;
BEGIN
  -- If company_id is already set, don't overwrite it
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Try to resolve based on parent table relationships
  IF TG_TABLE_NAME = 'whatsapp_campaigns' OR TG_TABLE_NAME = 'whatsapp_templates' OR TG_TABLE_NAME = 'whatsapp_workflows' OR TG_TABLE_NAME = 'whatsapp_scheduled_messages' OR TG_TABLE_NAME = 'whatsapp_messages' THEN
    IF NEW.account_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.whatsapp_accounts WHERE id = NEW.account_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'whatsapp_workflow_actions' OR TG_TABLE_NAME = 'whatsapp_workflow_logs' THEN
    IF NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.whatsapp_workflows WHERE id = NEW.workflow_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_scheduled_actions' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
    IF resolved_company_id IS NULL AND NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.workflows WHERE id = NEW.workflow_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_logs' THEN
    IF NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.workflows WHERE id = NEW.workflow_id;
    END IF;
    IF resolved_company_id IS NULL AND NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'sms_logs' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'otp_codes' THEN
    IF NEW.user_id IS NOT NULL THEN
      resolved_company_id := public.get_user_company_id(NEW.user_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'remarketing_cycles' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  END IF;

  -- 2. Fallback: resolve from authenticated user
  IF resolved_company_id IS NULL AND auth.uid() IS NOT NULL THEN
    resolved_company_id := public.get_user_company_id(auth.uid());
  END IF;

  -- Apply resolved company_id
  IF resolved_company_id IS NOT NULL THEN
    NEW.company_id := resolved_company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create triggers for each table

-- A. whatsapp_campaigns
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_campaigns;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- B. whatsapp_templates
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_templates;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- C. whatsapp_workflows
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_workflows;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_workflows
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- D. whatsapp_workflow_actions
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_workflow_actions;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_workflow_actions
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- E. whatsapp_workflow_logs
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_workflow_logs;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_workflow_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- F. whatsapp_scheduled_messages
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_scheduled_messages;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- G. whatsapp_messages
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_messages;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- H. workflow_scheduled_actions
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.workflow_scheduled_actions;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.workflow_scheduled_actions
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- I. workflow_logs
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.workflow_logs;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.workflow_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- J. sms_logs
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.sms_logs;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.sms_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- K. otp_codes
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.otp_codes;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.otp_codes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- L. remarketing_cycles
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.remarketing_cycles;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.remarketing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- M. workflows (general)
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.workflows;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();
