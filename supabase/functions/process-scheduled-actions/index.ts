import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "delay";
  category?: string;
  label: string;
  config: Record<string, unknown>;
  children?: string[];
  yesChild?: string;
  noChild?: string;
}

interface Lead {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  loan_amount: number;
  loan_type: string;
  status: string;
  assigned_to: string | null;
  company_id: string | null;
}

// deno-lint-ignore no-explicit-any
type SupabaseAny = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch pending scheduled actions that are due
    const { data: pendingActions, error: fetchError } = await supabase
      .from("workflow_scheduled_actions")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("[process-scheduled] Error fetching:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingActions || pendingActions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-scheduled] Processing ${pendingActions.length} scheduled actions`);
    let processedCount = 0;

    for (const action of pendingActions) {
      try {
        // Mark as processing to prevent double-execution
        await supabase
          .from("workflow_scheduled_actions")
          .update({ status: "processing" })
          .eq("id", action.id)
          .eq("status", "pending");

        // Get lead data
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", action.lead_id)
          .single();

        if (leadError || !lead) {
          console.error(`[process-scheduled] Lead not found: ${action.lead_id}`);
          await supabase
            .from("workflow_scheduled_actions")
            .update({ status: "failed", error_message: "Lead not found", executed_at: new Date().toISOString() })
            .eq("id", action.id);
          continue;
        }

        // Execute the node and its descendants
        const nodes = (action.remaining_nodes || []) as WorkflowNode[];
        const log = { actions: [] as string[], errors: [] as string[] };

        await executeNode(supabase, nodes, action.node_id, lead as Lead, log, action.workflow_id, action.workflow_name);

        // Mark as executed
        await supabase
          .from("workflow_scheduled_actions")
          .update({
            status: log.errors.length > 0 ? "failed" : "executed",
            executed_at: new Date().toISOString(),
            error_message: log.errors.length > 0 ? log.errors.join("; ") : null,
          })
          .eq("id", action.id);

        // Log to workflow_logs
        await supabase.from("workflow_logs").insert({
          workflow_id: action.workflow_id,
          workflow_name: action.workflow_name || "Scheduled Action",
          lead_id: action.lead_id,
          lead_name: lead.full_name,
          trigger_type: "scheduled_continuation",
          status: log.errors.length > 0 ? "failed" : "completed",
          actions_executed: log.actions,
          error_message: log.errors.length > 0 ? log.errors.join("; ") : null,
          execution_time_ms: 0,
          company_id: lead.company_id,
        });

        processedCount++;
        console.log(`[process-scheduled] Executed action ${action.id} for lead ${lead.full_name}`);
      } catch (error) {
        console.error(`[process-scheduled] Error processing action ${action.id}:`, error);
        await supabase
          .from("workflow_scheduled_actions")
          .update({ status: "failed", error_message: String(error), executed_at: new Date().toISOString() })
          .eq("id", action.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-scheduled] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeNode(
  supabase: SupabaseAny,
  nodes: WorkflowNode[],
  nodeId: string,
  lead: Lead,
  log: { actions: string[]; errors: string[] },
  workflowId?: string,
  workflowName?: string
): Promise<void> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  console.log(`[process-scheduled] Executing node: ${node.label} (${node.type})`);

  switch (node.type) {
    case "action":
      await executeAction(supabase, node, lead, log);
      break;

    case "condition": {
      const result = evaluateCondition(node, lead);
      log.actions.push(`Condition: ${node.label} = ${result ? "Yes" : "No"}`);
      // Try the matching branch first, then fallback to the other branch
      let nextNodeId = result ? node.yesChild : node.noChild;
      if (!nextNodeId) {
        nextNodeId = result ? node.noChild : node.yesChild;
      }
      if (nextNodeId) {
        await executeNode(supabase, nodes, nextNodeId, lead, log, workflowId, workflowName);
      } else if (node.children && node.children.length > 0) {
        for (const childId of node.children) {
          await executeNode(supabase, nodes, childId, lead, log, workflowId, workflowName);
        }
      }
      return;
    }

    case "delay": {
      // Another delay — schedule again
      const delayMs = calculateDelayMs(node);
      const scheduledAt = new Date(Date.now() + delayMs);
      const childIds = node.children || [];
      if (childIds.length > 0) {
        await supabase.from("workflow_scheduled_actions").insert({
          workflow_id: workflowId || "unknown",
          workflow_name: workflowName,
          lead_id: lead.id,
          node_id: childIds[0],
          remaining_nodes: nodes,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
          company_id: lead.company_id,
        });
        log.actions.push(`Delay: ${node.label} — re-scheduled for ${scheduledAt.toISOString()}`);
      }
      return;
    }
  }

  // Execute children
  if (node.children) {
    for (const childId of node.children) {
      await executeNode(supabase, nodes, childId, lead, log, workflowId, workflowName);
    }
  }
}

async function executeAction(
  supabase: SupabaseAny,
  node: WorkflowNode,
  lead: Lead,
  log: { actions: string[]; errors: string[] }
): Promise<void> {
  const actionId = node.config.actionId as string;
  const config = node.config;

  switch (actionId) {
    case "send_sms": {
      const smsType = config.sms_type as string;
      const phone = lead.phone?.replace(/\D/g, "").slice(-10);
      if (!phone || !smsType) {
        log.errors.push("Missing phone or SMS type");
        return;
      }
      try {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            },
            body: JSON.stringify({
              phone,
              type: smsType,
              leadId: lead.id,
              variables: { var: lead.loan_amount, name: lead.full_name },
            }),
          }
        );
        
        const responseText = await response.text();
        if (!response.ok) {
          log.errors.push(`SMS failed (HTTP ${response.status}): ${responseText.substring(0, 150)}`);
          return;
        }

        const result = JSON.parse(responseText);
        if (result.success === false) {
          log.errors.push(`SMS failed: ${result.error || "unknown"}`);
        } else {
          log.actions.push(`SMS sent: ${smsType} to ${phone}`);
        }
      } catch (error) {
        log.errors.push(`SMS failed: ${String(error)}`);
      }
      break;
    }

    case "send_whatsapp": {
      const templateId = config.template_id as string;
      let message = (config.message as string) || "";
      message = message
        .replace(/\{\{name\}\}/g, lead.full_name || "")
        .replace(/\{\{phone\}\}/g, lead.phone || "")
        .replace(/\{\{loan_amount\}\}/g, String(lead.loan_amount || ""))
        .replace(/\{\{status\}\}/g, lead.status || "");

      const phone = lead.phone?.replace(/\D/g, "").slice(-10);
      if (!phone) {
        log.errors.push("Missing phone for WhatsApp");
        return;
      }

      // Get the correct WhatsApp account — PRIORITY: lead's company account first, fallback to first connected
      let accountId = null;

      if (lead.company_id) {
        const { data: companyAccount } = await supabase
          .from("whatsapp_accounts")
          .select("id")
          .eq("company_id", lead.company_id)
          .eq("status", "connected")
          .eq("connection_type", "meta_api")
          .limit(1)
          .maybeSingle();
        if (companyAccount) accountId = companyAccount.id;
      }

      if (!accountId) {
        const { data: fallbackAccount } = await supabase
          .from("whatsapp_accounts")
          .select("id")
          .eq("connection_type", "meta_api")
          .eq("status", "connected")
          .limit(1)
          .maybeSingle();
        if (fallbackAccount) accountId = fallbackAccount.id;
      }

      if (!accountId) {
        log.errors.push("No WhatsApp API account connected");
        return;
      }

      // If template selected, send as template
      if (templateId && templateId !== "custom") {
        const { data: template } = await supabase
          .from("whatsapp_templates")
          .select("name, language, variables")
          .eq("id", templateId)
          .maybeSingle();

        if (template) {
          try {
            const response = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
                },
                body: JSON.stringify({
                  account_id: accountId,
                  phone_number: phone,
                  template_name: template.name,
                  template_language: template.language || "en",
                  contact_name: lead.full_name,
                  lead_id: lead.id,
                  message: message,
                  message_source: "workflow",
                }),
              }
            );
            await response.json();
            log.actions.push(`WhatsApp template "${template.name}" sent to ${phone}`);
          } catch (error) {
            log.errors.push(`WhatsApp send failed: ${String(error)}`);
          }
        }
      } else if (message) {
        // Send as text (within 24h window)
        try {
          const response = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
              },
              body: JSON.stringify({
                account_id: accountId,
                phone_number: phone,
                message,
                contact_name: lead.full_name,
                lead_id: lead.id,
                message_source: "workflow",
              }),
            }
          );
          await response.json();
          log.actions.push(`WhatsApp text sent to ${phone}`);
        } catch (error) {
          log.errors.push(`WhatsApp send failed: ${String(error)}`);
        }
      }
      break;
    }

    case "update_status": {
      const newStatus = config.new_status as string;
      if (newStatus) {
        await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
        log.actions.push(`Updated status to: ${newStatus}`);
      }
      break;
    }

    case "assign_to_staff": {
      const assignmentType = config.assignment_type as string;
      let assigneeId: string | null = null;

      if (assignmentType === "specific") {
        assigneeId = config.telecaller_id as string;
      } else {
        const { data: telecallers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "telecaller");

        if (telecallers && telecallers.length > 0) {
          assigneeId = telecallers[Math.floor(Math.random() * telecallers.length)].user_id;
        }
      }

      if (assigneeId) {
        await supabase.from("leads").update({ assigned_to: assigneeId }).eq("id", lead.id);
        log.actions.push(`Assigned to staff: ${assigneeId.substring(0, 8)}...`);
      }
      break;
    }

    case "notify_staff": {
      if (lead.assigned_to) {
        await supabase.from("staff_notifications").insert({
          user_id: lead.assigned_to,
          type: "workflow",
          title: (config.notification_title as string) || "Workflow Notification",
          message: (config.notification_message as string) || `Action needed for ${lead.full_name}`,
          link: "/admin/dashboard",
          metadata: { lead_id: lead.id },
        });
        log.actions.push("Staff notified");
      }
      break;
    }

    default:
      log.actions.push(`Unknown action: ${actionId}`);
  }
}

function evaluateCondition(node: WorkflowNode, lead: Lead): boolean {
  const actionId = node.config.actionId as string;
  const field = node.config.condition_field as string;
  const expectedValue = node.config.condition_value as string;

  // "if_lead" with no condition_field = check if lead is still unpaid (hasn't paid yet)
  if (actionId === "if_lead" && !field) {
    const paidStatuses = ["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"];
    const isStillUnpaid = !paidStatuses.includes(lead.status);
    console.log(`[process-scheduled] if_lead check: lead.status=${lead.status}, isStillUnpaid=${isStillUnpaid}`);
    return isStillUnpaid;
  }

  switch (field) {
    case "status": return lead.status === expectedValue;
    case "loan_type": return lead.loan_type === expectedValue;
    case "is_assigned": return expectedValue === "true" ? !!lead.assigned_to : !lead.assigned_to;
    default: return false;
  }
}

function calculateDelayMs(node: WorkflowNode): number {
  const value = (node.config.delay_value as number) || 1;
  const unit = (node.config.delay_unit as string) || "minutes";
  switch (unit) {
    case "minutes": return value * 60 * 1000;
    case "hours": return value * 60 * 60 * 1000;
    case "days": return value * 24 * 60 * 60 * 1000;
    default: return value * 60 * 1000;
  }
}
