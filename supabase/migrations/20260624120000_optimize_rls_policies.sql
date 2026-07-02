-- Migration: 20260624120000_optimize_rls_policies.sql
-- Description: Optimize RLS policies to use inline subqueries for user company lookup, preventing statement timeouts.

-- A. whatsapp_accounts
DROP POLICY IF EXISTS "Staff can view WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Staff can view WhatsApp accounts" ON public.whatsapp_accounts FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- B. whatsapp_templates
DROP POLICY IF EXISTS "Staff can view WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "Staff can view WhatsApp templates" ON public.whatsapp_templates FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- C. whatsapp_campaigns
DROP POLICY IF EXISTS "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- D. whatsapp_messages
DROP POLICY IF EXISTS "Staff can view and send messages" ON public.whatsapp_messages;
CREATE POLICY "Staff can view and send messages" ON public.whatsapp_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
  )
);

DROP POLICY IF EXISTS "Staff can insert messages" ON public.whatsapp_messages;
CREATE POLICY "Staff can insert messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
  )
);

-- E. workflows (General Automations)
DROP POLICY IF EXISTS "Staff can view workflows" ON public.workflows;
CREATE POLICY "Staff can view workflows" ON public.workflows FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage workflows" ON public.workflows;
CREATE POLICY "Franchise owner can manage workflows" ON public.workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- F. whatsapp_workflows
DROP POLICY IF EXISTS "Staff can view whatsapp workflows" ON public.whatsapp_workflows;
CREATE POLICY "Staff can view whatsapp workflows" ON public.whatsapp_workflows FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows;
CREATE POLICY "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- G. whatsapp_workflow_actions
DROP POLICY IF EXISTS "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions;
CREATE POLICY "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions;
CREATE POLICY "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- H. whatsapp_workflow_logs & workflow_logs
DROP POLICY IF EXISTS "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs;
CREATE POLICY "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Staff can view general workflow logs" ON public.workflow_logs;
CREATE POLICY "Staff can view general workflow logs" ON public.workflow_logs FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- I. whatsapp_scheduled_messages
DROP POLICY IF EXISTS "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
CREATE POLICY "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
CREATE POLICY "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR DELETE USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- J. workflow_scheduled_actions
DROP POLICY IF EXISTS "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions;
CREATE POLICY "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions;
CREATE POLICY "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions FOR DELETE USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- K. sms_logs
DROP POLICY IF EXISTS "Staff can view sms logs" ON public.sms_logs;
CREATE POLICY "Staff can view sms logs" ON public.sms_logs FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- L. otp_codes
DROP POLICY IF EXISTS "Staff can view company OTP logs" ON public.otp_codes;
CREATE POLICY "Staff can view company OTP logs" ON public.otp_codes FOR SELECT USING (
  public.is_admin(auth.uid()) OR company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- M. remarketing_cycles
DROP POLICY IF EXISTS "Staff can view remarketing cycles" ON public.remarketing_cycles;
CREATE POLICY "Staff can view remarketing cycles" ON public.remarketing_cycles FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles;
CREATE POLICY "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- N. company_integrations
DROP POLICY IF EXISTS "Staff can view company integrations" ON public.company_integrations;
CREATE POLICY "Staff can view company integrations" ON public.company_integrations FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage company integrations" ON public.company_integrations;
CREATE POLICY "Franchise owner can manage company integrations" ON public.company_integrations FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);
