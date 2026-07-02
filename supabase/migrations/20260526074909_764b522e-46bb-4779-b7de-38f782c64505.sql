
CREATE TEMP TABLE _lead_dup_map AS
WITH ranked AS (
  SELECT id, company_id, phone,
    ROW_NUMBER() OVER (PARTITION BY company_id, phone ORDER BY created_at DESC, id DESC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY company_id, phone ORDER BY created_at DESC, id DESC) AS keeper_id
  FROM public.leads
)
SELECT id AS dup_id, keeper_id FROM ranked WHERE rn > 1;

DELETE FROM public.lead_scores WHERE lead_id IN (SELECT dup_id FROM _lead_dup_map);
DELETE FROM public.remarketing_cycles WHERE lead_id IN (SELECT dup_id FROM _lead_dup_map);

UPDATE public.payments p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.documents p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.call_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.activity_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.bank_submissions p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.accounting_entries p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.gst_invoices p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_messages p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.sms_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.workflow_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_workflow_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.unified_messages p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.lead_assignment_history p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_scheduled_messages p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.workflow_scheduled_actions p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_dnd p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.royalty_transactions p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;

DELETE FROM public.leads WHERE id IN (SELECT dup_id FROM _lead_dup_map);

CREATE UNIQUE INDEX IF NOT EXISTS leads_company_phone_unique ON public.leads (company_id, phone);
