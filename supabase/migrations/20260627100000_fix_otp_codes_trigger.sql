-- Migration: 20260627100000_fix_otp_codes_trigger.sql
-- Description: Fix public.auto_set_company_id() trigger function to remove references to non-existent user_id column on public.otp_codes.

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
