-- Migration: 20260623130000_complete_franchise_isolation.sql
-- Description: Implement strict brand/franchise isolation by adding company_id columns, backfilling them, and defining strict RLS policies.

-- 1. Helper function to get company_id for any user
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_users WHERE user_id = _user_id LIMIT 1;
$$;

-- 2. Add company_id columns to tables
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_campaigns ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_workflows ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_workflow_actions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_workflow_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_scheduled_messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_scheduled_actions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 3. Backfill company_id columns
UPDATE public.whatsapp_templates t 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE t.account_id = a.id AND t.company_id IS NULL;

UPDATE public.whatsapp_campaigns c 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE c.account_id = a.id AND c.company_id IS NULL;

UPDATE public.whatsapp_workflows w 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE w.account_id = a.id AND w.company_id IS NULL;

UPDATE public.whatsapp_workflow_actions a 
SET company_id = w.company_id 
FROM public.whatsapp_workflows w 
WHERE a.workflow_id = w.id AND a.company_id IS NULL;

UPDATE public.whatsapp_workflow_logs l 
SET company_id = w.company_id 
FROM public.whatsapp_workflows w 
WHERE l.workflow_id = w.id AND l.company_id IS NULL;

UPDATE public.whatsapp_scheduled_messages m 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE m.account_id = a.id AND m.company_id IS NULL;

UPDATE public.workflow_scheduled_actions a 
SET company_id = l.company_id 
FROM public.leads l 
WHERE a.lead_id = l.id AND a.company_id IS NULL;

UPDATE public.workflow_logs l 
SET company_id = w.company_id 
FROM public.workflows w 
WHERE l.workflow_id = w.id AND l.company_id IS NULL;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_codes_company_id ON public.otp_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_company_id ON public.whatsapp_campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_company_id ON public.whatsapp_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_company_id ON public.whatsapp_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_actions_company_id ON public.whatsapp_workflow_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_logs_company_id ON public.whatsapp_workflow_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_company_id ON public.whatsapp_scheduled_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_scheduled_actions_company_id ON public.workflow_scheduled_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_company_id ON public.workflow_logs(company_id);

-- 5. Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_scheduled_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- 6. Define strict, isolated RLS policies

-- A. whatsapp_accounts
DROP POLICY IF EXISTS "Admin can manage WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Staff can view WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Admin can manage WhatsApp accounts" ON public.whatsapp_accounts FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view WhatsApp accounts" ON public.whatsapp_accounts FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- B. whatsapp_templates
DROP POLICY IF EXISTS "Admin can manage WhatsApp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Staff can view WhatsApp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "Admin can manage WhatsApp templates" ON public.whatsapp_templates FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view WhatsApp templates" ON public.whatsapp_templates FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- C. whatsapp_campaigns
DROP POLICY IF EXISTS "Admin can manage WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Admin can manage WhatsApp campaigns" ON public.whatsapp_campaigns FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- D. whatsapp_messages
DROP POLICY IF EXISTS "Admin can manage messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Staff can view and send messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Staff can insert messages" ON public.whatsapp_messages;
CREATE POLICY "Admin can manage messages" ON public.whatsapp_messages FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view and send messages" ON public.whatsapp_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = public.get_user_company_id(auth.uid())
  )
);
CREATE POLICY "Staff can insert messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = public.get_user_company_id(auth.uid())
  )
);

-- E. workflows (General Automations)
DROP POLICY IF EXISTS "Admin can manage workflows" ON public.workflows;
DROP POLICY IF EXISTS "Staff can view workflows" ON public.workflows;
DROP POLICY IF EXISTS "Franchise owner can manage workflows" ON public.workflows;
CREATE POLICY "Admin can manage workflows" ON public.workflows FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view workflows" ON public.workflows FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage workflows" ON public.workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- F. whatsapp_workflows
DROP POLICY IF EXISTS "Admin can manage whatsapp workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Staff can view whatsapp workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Admins can manage workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Staff can view workflows" ON public.whatsapp_workflows;
CREATE POLICY "Admin can manage whatsapp workflows" ON public.whatsapp_workflows FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp workflows" ON public.whatsapp_workflows FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- G. whatsapp_workflow_actions
DROP POLICY IF EXISTS "Admin can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Admins can manage workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Staff can view workflow actions" ON public.whatsapp_workflow_actions;
CREATE POLICY "Admin can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- H. whatsapp_workflow_logs & workflow_logs
DROP POLICY IF EXISTS "Admin can manage whatsapp workflow logs" ON public.whatsapp_workflow_logs;
DROP POLICY IF EXISTS "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs;
DROP POLICY IF EXISTS "Admins can manage workflow logs" ON public.whatsapp_workflow_logs;
DROP POLICY IF EXISTS "Staff can view workflow logs" ON public.whatsapp_workflow_logs;
CREATE POLICY "Admin can manage whatsapp workflow logs" ON public.whatsapp_workflow_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage general workflow logs" ON public.workflow_logs;
DROP POLICY IF EXISTS "Staff can view general workflow logs" ON public.workflow_logs;
CREATE POLICY "Admin can manage general workflow logs" ON public.workflow_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view general workflow logs" ON public.workflow_logs FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- I. whatsapp_scheduled_messages
DROP POLICY IF EXISTS "Admin can manage whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can view scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can manage scheduled messages" ON public.whatsapp_scheduled_messages;
CREATE POLICY "Admin can manage whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR DELETE USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- J. workflow_scheduled_actions
DROP POLICY IF EXISTS "Admin can manage workflow scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can view scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can manage scheduled actions" ON public.workflow_scheduled_actions;
CREATE POLICY "Admin can manage workflow scheduled actions" ON public.workflow_scheduled_actions FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions FOR DELETE USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- K. sms_logs
DROP POLICY IF EXISTS "Admin can manage sms logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Staff can view sms logs" ON public.sms_logs;
CREATE POLICY "Admin can manage sms logs" ON public.sms_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view sms logs" ON public.sms_logs FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- L. otp_codes
DROP POLICY IF EXISTS "Staff can view company OTP logs" ON public.otp_codes;
CREATE POLICY "Staff can view company OTP logs" ON public.otp_codes FOR SELECT USING (
  public.is_admin(auth.uid()) OR company_id = public.get_user_company_id(auth.uid())
);

-- M. remarketing_cycles
DROP POLICY IF EXISTS "Admin can manage remarketing cycles" ON public.remarketing_cycles;
DROP POLICY IF EXISTS "Staff can view remarketing cycles" ON public.remarketing_cycles;
DROP POLICY IF EXISTS "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles;
CREATE POLICY "Admin can manage remarketing cycles" ON public.remarketing_cycles FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view remarketing cycles" ON public.remarketing_cycles FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- N. company_integrations
DROP POLICY IF EXISTS "Admin manages company integrations" ON public.company_integrations;
DROP POLICY IF EXISTS "Staff can view company integrations" ON public.company_integrations;
DROP POLICY IF EXISTS "Franchise owner can manage company integrations" ON public.company_integrations;
CREATE POLICY "Admin manages company integrations" ON public.company_integrations FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view company integrations" ON public.company_integrations FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage company integrations" ON public.company_integrations FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

