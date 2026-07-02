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

interface Workflow {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  actions: { nodes: WorkflowNode[] };
  is_active: boolean;
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
  city: string | null;
}

interface ExecutionLog {
  actions: string[];
  errors: string[];
}

// deno-lint-ignore no-explicit-any
type SupabaseAny = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { trigger_type, lead_id, from_status, to_status, company_id, button_text, message_type } = body;

    if (!trigger_type || !lead_id) {
      return new Response(
        JSON.stringify({ success: false, error: "trigger_type and lead_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[execute-workflow] Trigger: ${trigger_type}, Lead: ${lead_id}, From: ${from_status}, To: ${to_status}, Company: ${company_id || "all"}`);

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      return new Response(
        JSON.stringify({ success: false, error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadCompanyId = lead.company_id || company_id;

    // Find matching active workflows - filter strictly by company_id for isolation
    let workflowQuery = supabase
      .from("workflows")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_type", trigger_type);

    if (leadCompanyId) {
      workflowQuery = workflowQuery.eq("company_id", leadCompanyId);
    } else {
      workflowQuery = workflowQuery.is("company_id", null);
    }

    const { data: workflows, error: wfError } = await workflowQuery;

    if (wfError) {
      console.error("Error fetching workflows:", wfError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch workflows" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!workflows || workflows.length === 0) {
      console.log(`[execute-workflow] No active workflows for trigger: ${trigger_type}`);
      return new Response(
        JSON.stringify({ success: true, message: "No matching workflows", executed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let executedCount = 0;

    for (const wf of workflows) {
      const workflow = wf as unknown as Workflow;
      const triggerConfig = workflow.trigger_config || {};
      const executionLog: ExecutionLog = { actions: [], errors: [] };
      let logStatus = "completed";

      // Check trigger conditions (for status_changed)
      if (trigger_type === "status_changed") {
        const requiredFromStatus = triggerConfig.from_status as string;
        const requiredToStatus = triggerConfig.to_status as string;

        if (requiredFromStatus && requiredFromStatus !== from_status) {
          console.log(`[execute-workflow] Skipping ${workflow.name}: from_status mismatch`);
          continue;
        }
        if (requiredToStatus && requiredToStatus !== to_status) {
          console.log(`[execute-workflow] Skipping ${workflow.name}: to_status mismatch`);
          continue;
        }
      }

      // Check trigger conditions (for whatsapp_button_click)
      if (trigger_type === "whatsapp_button_click") {
        const requiredButtonText = (triggerConfig.button_text as string)?.toLowerCase().trim();
        const receivedButtonText = (button_text as string)?.toLowerCase().trim();
        
        if (requiredButtonText && receivedButtonText && requiredButtonText !== receivedButtonText) {
          console.log(`[execute-workflow] Skipping ${workflow.name}: button_text mismatch ("${requiredButtonText}" vs "${receivedButtonText}")`);
          continue;
        }
      }

      // Check trigger conditions (for whatsapp_message_received with keyword)
      if (trigger_type === "whatsapp_message_received") {
        const keyword = (triggerConfig.keyword as string)?.toLowerCase().trim();
        if (keyword) {
          const keywords = keyword.split(",").map(k => k.trim());
          const messageContent = (button_text as string)?.toLowerCase() || "";
          const matches = keywords.some(k => messageContent.includes(k));
          if (!matches) {
            console.log(`[execute-workflow] Skipping ${workflow.name}: keyword mismatch`);
            continue;
          }
        }
      }

      console.log(`[execute-workflow] Executing workflow: ${workflow.name}`);

      const nodes = workflow.actions?.nodes || [];
      const triggerNode = nodes.find((n) => n.type === "trigger");
      
      if (!triggerNode) {
        console.log(`[execute-workflow] No trigger node in workflow: ${workflow.name}`);
        executionLog.errors.push("No trigger node found");
        logStatus = "failed";
        continue;
      }

      try {
        // Execute action nodes starting from trigger's children
        const childIds = triggerNode.children || [];
        for (const childId of childIds) {
          await executeNode(supabase, nodes, childId, lead as Lead, executionLog, workflow.id, workflow.name, trigger_type);
        }
        executedCount++;
      } catch (error) {
        console.error(`[execute-workflow] Error in workflow ${workflow.name}:`, error);
        executionLog.errors.push(String(error));
        logStatus = "failed";
      }

      const executionTime = Date.now() - startTime;

      // Log workflow execution to workflow_logs table
      await supabase.from("workflow_logs").insert({
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        lead_id: lead.id,
        lead_name: lead.full_name,
        trigger_type,
        status: logStatus,
        actions_executed: executionLog.actions,
        error_message: executionLog.errors.length > 0 ? executionLog.errors.join("; ") : null,
        execution_time_ms: executionTime,
        company_id: leadCompanyId,
      });

      // Also log to activity_logs for backward compatibility
      await supabase.from("activity_logs").insert({
        lead_id,
        action: "workflow_executed",
        details: {
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          trigger_type,
          from_status,
          to_status,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, executed: executedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[execute-workflow] Error:", error);
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
  log: ExecutionLog,
  workflowId?: string,
  workflowName?: string,
  triggerType?: string
): Promise<void> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  console.log(`[execute-workflow] Executing node: ${node.label} (${node.type})`);

  switch (node.type) {
    case "action":
      await executeAction(supabase, node, lead, log, triggerType);
      break;

    case "condition":
      // Check if condition has actual config — if not, treat as pass-through
      // Special case: "if_lead" with no condition_field = check if lead is still unpaid (hasn't paid yet)
      const hasConditionConfig = node.config.actionId && node.config.actionId !== "if_lead";
      let condResult: boolean;
      if (hasConditionConfig) {
        condResult = evaluateCondition(node, lead);
      } else if (node.config.actionId === "if_lead") {
        // "if_lead" with no field config = check if lead is still unpaid
        // This is the "Has the lead NOT paid yet?" gate for unpaid lead workflows
        const paidStatuses = ["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"];
        condResult = !paidStatuses.includes(lead.status);
        console.log(`[execute-workflow] if_lead check: lead.status=${lead.status}, isStillUnpaid=${condResult}`);
      } else {
        condResult = true; // plain pass-through
      }
      log.actions.push(`Condition: ${node.label} = ${condResult ? "Yes" : "No"}`);
      
      // Determine next node: try yesChild/noChild based on result
      let condNextId = condResult ? node.yesChild : node.noChild;
      
      // Fallback: if the expected branch is missing, try the other branch
      if (!condNextId) {
        condNextId = condResult ? node.noChild : node.yesChild;
      }
      
      if (condNextId) {
        await executeNode(supabase, nodes, condNextId, lead, log, workflowId, workflowName, triggerType);
      } else if (node.children && node.children.length > 0) {
        for (const childId of node.children) {
          await executeNode(supabase, nodes, childId, lead, log, workflowId, workflowName, triggerType);
        }
      }
      return;

    case "delay":
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
        
        log.actions.push(`Delay: ${node.label} — scheduled for ${scheduledAt.toISOString()}`);
        console.log(`[execute-workflow] Scheduled continuation at ${scheduledAt.toISOString()}`);
      }
      return;
  }

  // Execute children
  if (node.children) {
    for (const childId of node.children) {
      await executeNode(supabase, nodes, childId, lead, log, workflowId, workflowName, triggerType);
    }
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

async function executeAction(
  supabase: SupabaseAny,
  node: WorkflowNode,
  lead: Lead,
  log: ExecutionLog,
  triggerType?: string
): Promise<void> {
  const actionId = node.config.actionId as string;
  const config = node.config;

  // Payment triggers should never be deduped — customer must always receive success message
  const isPaymentTrigger = triggerType === "payment_received" || 
    (triggerType === "status_changed" && (node.config as Record<string,unknown>).to_status === "paid");

  switch (actionId) {
    case "send_sms":
      await sendSMS(supabase, config, lead, log);
      break;

    case "start_remarketing":
      await startRemarketingCycle(supabase, config, lead, log);
      break;

    case "stop_remarketing":
      await stopRemarketingCycle(supabase, lead, log);
      break;

    case "send_whatsapp":
      await sendWhatsApp(supabase, config, lead, log, isPaymentTrigger);
      break;

    case "start_whatsapp_remarketing":
      await startWhatsAppRemarketingCycle(supabase, config, lead, log);
      break;

    case "update_status":
      const newStatus = config.new_status as string;
      if (newStatus) {
        await supabase
          .from("leads")
          .update({ status: newStatus })
          .eq("id", lead.id);
        log.actions.push(`Updated status to: ${newStatus}`);
        console.log(`[execute-workflow] Updated lead status to: ${newStatus}`);
      }
      break;

    case "assign_to_staff":
      await assignToStaff(supabase, config, lead, log);
      break;

    case "add_note":
      const noteText = config.note_text as string;
      if (noteText) {
        await supabase.from("activity_logs").insert({
          lead_id: lead.id,
          action: "workflow_note_added",
          details: { note: noteText },
        });
        log.actions.push(`Added note: ${noteText.substring(0, 50)}...`);
      }
      break;

    case "stop_automation":
      // Stop all pending scheduled actions for this lead
      await supabase
        .from("workflow_scheduled_actions")
        .update({ status: "cancelled" })
        .eq("lead_id", lead.id)
        .eq("status", "pending");
      
      // Stop remarketing cycles
      await supabase
        .from("remarketing_cycles")
        .update({ status: "stopped" })
        .eq("lead_id", lead.id)
        .eq("status", "active");

      log.actions.push("Stopped all automations for lead");
      console.log(`[execute-workflow] Stopped all automations for lead: ${lead.id}`);
      break;

    default:
      log.actions.push(`Unknown action: ${actionId}`);
      console.log(`[execute-workflow] Unknown action: ${actionId}`);
  }
}

async function sendSMS(
  supabase: SupabaseAny,
  config: Record<string, unknown>,
  lead: Lead,
  log: ExecutionLog
): Promise<void> {
  const smsType = config.sms_type as string;
  
  if (!smsType) {
    log.errors.push("No SMS type configured");
    console.log("[execute-workflow] No SMS type configured");
    return;
  }

  const phone = lead.phone?.replace(/\D/g, "").slice(-10);
  if (!phone) {
    log.errors.push("Invalid phone number for SMS");
    console.log("[execute-workflow] Invalid phone number");
    return;
  }

  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`;
    console.log(`[execute-workflow] Calling send-sms: type=${smsType}, phone=${phone}, leadId=${lead.id}`);
    
    const response = await fetch(url, {
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
        variables: {
          var: lead.loan_amount,
          name: lead.full_name,
        },
      }),
    });

    const responseText = await response.text();
    
    // Guard against HTML error pages from edge function boot failures
    if (responseText.startsWith("<") || !response.ok) {
      log.errors.push(`SMS call failed (HTTP ${response.status}): non-JSON response`);
      console.error(`[execute-workflow] SMS call returned non-JSON (HTTP ${response.status}):`, responseText.substring(0, 200));
      return;
    }

    const result = JSON.parse(responseText);
    if (result.success === false) {
      log.errors.push(`SMS failed: ${result.error || "unknown"}`);
      console.error(`[execute-workflow] SMS failed:`, result);
    } else {
      log.actions.push(`SMS sent: ${smsType} to ${phone}`);
      console.log(`[execute-workflow] SMS sent:`, result);
    }
  } catch (error) {
    log.errors.push(`SMS failed: ${String(error)}`);
    console.error("[execute-workflow] SMS error:", error);
  }
}

async function sendWhatsApp(
  supabase: SupabaseAny,
  config: Record<string, unknown>,
  lead: Lead,
  log: ExecutionLog,
  bypassDedup = false
): Promise<void> {
  let message = (config.message as string) || "";
  const templateId = config.template_id as string;
  
  // Replace variables (both named and positional)
  message = message
    .replace(/\{\{name\}\}/gi, lead.full_name || "Customer")
    .replace(/\{\{1\}\}/g, lead.full_name || "Customer")
    .replace(/\{\{phone\}\}/gi, lead.phone || "")
    .replace(/\{\{loan_amount\}\}/gi, String(lead.loan_amount || ""))
    .replace(/\{\{2\}\}/g, String(lead.loan_amount || "50000"))
    .replace(/\{\{amount\}\}/gi, String(lead.loan_amount || ""))
    .replace(/\{\{status\}\}/gi, lead.status || "")
    .replace(/\{\{3\}\}/g, lead.loan_type || "personal_loan")
    .replace(/\{\{4\}\}/g, lead.city || "");

  const phone = lead.phone?.replace(/\D/g, "").slice(-10);
  if (!phone || (!message && !templateId)) {
    log.errors.push("Missing phone or message for WhatsApp");
    console.log("[execute-workflow] Missing phone or message for WhatsApp");
    return;
  }

  // DEDUP: Skip for payment success triggers — customer MUST always receive payment confirmation
  if (!bypassDedup) {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentMsg } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("phone_number", `91${phone}`)
      .eq("message_source", "workflow")
      .eq("direction", "outgoing")
      .gte("created_at", tenMinAgo)
      .limit(1)
      .maybeSingle();

    if (!recentMsg) {
      const { data: recentMsg2 } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("phone_number", phone)
        .eq("message_source", "workflow")
        .eq("direction", "outgoing")
        .gte("created_at", tenMinAgo)
        .limit(1)
        .maybeSingle();

      if (recentMsg2) {
        log.actions.push(`Skipped duplicate WhatsApp to ${phone} (sent <10min ago)`);
        console.log(`[execute-workflow] DEDUP: Skipping WhatsApp to ${phone}, already sent recently`);
        return;
      }
    } else {
      log.actions.push(`Skipped duplicate WhatsApp to ${phone} (sent <10min ago)`);
      console.log(`[execute-workflow] DEDUP: Skipping WhatsApp to ${phone}, already sent recently`);
      return;
    }
  } else {
    console.log(`[execute-workflow] DEDUP bypassed for payment trigger, sending to ${phone}`);
  }

  try {
    // If a template is configured, fetch template details first to get the correct account
    let templateName: string | undefined;
    let templateLanguage: string | undefined;
    let templateParams: string[] | undefined;
    let templateAccountId: string | undefined;

    if (templateId && templateId !== "custom") {
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("name, language, variables, account_id, content")
        .eq("id", templateId)
        .maybeSingle();

      if (template) {
        templateName = template.name;
        templateLanguage = template.language || "en";
        templateAccountId = template.account_id;
        // Determine variable count robustly:
        // `variables` may be an integer, an array (["{{1}}",...]), or null.
        // Fall back to counting distinct {{N}} placeholders in the body.
        let varCount = 0;
        const v = template.variables as unknown;
        if (typeof v === "number") {
          varCount = v;
        } else if (Array.isArray(v)) {
          varCount = v.length;
        }
        if (varCount === 0 && template.content) {
          const matches = String(template.content).match(/\{\{(\d+)\}\}/g) || [];
          const unique = new Set(matches);
          varCount = unique.size;
        }
        if (varCount > 0) {
          templateParams = [];
          templateParams.push(lead.full_name || "Customer");
          if (varCount >= 2) templateParams.push(String(lead.loan_amount || "50000"));
          if (varCount >= 3) templateParams.push(lead.loan_type?.replace(/_/g, " ") || "personal loan");
          if (varCount >= 4) templateParams.push(lead.city || "India");
        }
        console.log(`[execute-workflow] Template ${templateName} varCount=${varCount} params=${JSON.stringify(templateParams)}`);
      } else {
        log.errors.push(`WhatsApp template not found: ${templateId}`);
        console.error(`[execute-workflow] Template ${templateId} not found in DB`);
        return;
      }
    } else if (templateId === "custom" && message) {
      // "custom" template_id means user typed a message in workflow builder.
      // Plain text is blocked by Meta outside the 24h window (error 131047).
      // Find a matching remarketing template for this company's account to use instead.
      console.log(`[execute-workflow] template_id=custom, will send as plain text (workflow source bypasses 24h in our code, but Meta may still block)`);
    }

    // Get the correct WhatsApp account — PRIORITY: lead's company account first, then template's account, fallback to first connected
    // This ensures messages are always sent from the correct brand's number
    let account = null;

    // 1. Lead's company account takes highest priority for brand isolation
    if (lead.company_id) {
      const { data: companyAccount } = await supabase
        .from("whatsapp_accounts")
        .select("id, meta_phone_id, connection_type")
        .eq("company_id", lead.company_id)
        .eq("status", "connected")
        .eq("connection_type", "meta_api")
        .limit(1)
        .maybeSingle();
      account = companyAccount;
      if (account) {
        console.log(`[execute-workflow] Using lead's company WA account: ${account.id}`);
      }
    }

    // 2. Fallback to template's account (if lead has no company_id)
    if (!account && templateAccountId) {
      const { data: tplAccount } = await supabase
        .from("whatsapp_accounts")
        .select("id, meta_phone_id, connection_type")
        .eq("id", templateAccountId)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      account = tplAccount;
    }

    // 3. Final fallback: any connected account (should rarely happen)
    if (!account) {
      const { data: fallbackAccount } = await supabase
        .from("whatsapp_accounts")
        .select("id, meta_phone_id, connection_type")
        .eq("status", "connected")
        .eq("connection_type", "meta_api")
        .limit(1)
        .maybeSingle();
      account = fallbackAccount;
    }

    if (!account) {
      log.errors.push("No connected WhatsApp account found");
      console.log("[execute-workflow] No connected WhatsApp account");
      return;
    }

    // Call send-whatsapp edge function to actually send via Meta API
    const sendPayload: Record<string, unknown> = {
      account_id: account.id,
      phone_number: phone,
      lead_id: lead.id,
      contact_name: lead.full_name,
      message_source: "workflow",
    };

    if (templateName) {
      sendPayload.template_name = templateName;
      sendPayload.template_language = templateLanguage;
      sendPayload.template_params = templateParams;
    } else {
      sendPayload.message = message;
    }

    console.log(`[execute-workflow] Calling send-whatsapp:`, JSON.stringify(sendPayload));

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify(sendPayload),
      }
    );

    const responseText = await response.text();
    
    // Guard against HTML error pages from edge function boot failures
    if (responseText.startsWith("<") || !response.ok) {
      log.errors.push(`WhatsApp call failed (HTTP ${response.status}): non-JSON response`);
      console.error(`[execute-workflow] WhatsApp call returned non-JSON (HTTP ${response.status}):`, responseText.substring(0, 200));
      return;
    }

    const result = JSON.parse(responseText);

    if (result.success) {
      log.actions.push(`WhatsApp sent to ${phone} (wamid: ${result.wamid || "n/a"})`);
      console.log(`[execute-workflow] WhatsApp sent to ${phone}:`, result);
    } else {
      log.errors.push(`WhatsApp send failed: ${result.error}`);
      console.error(`[execute-workflow] WhatsApp send failed for ${phone}:`, result.error);
    }
  } catch (error) {
    log.errors.push(`WhatsApp error: ${String(error)}`);
    console.error("[execute-workflow] WhatsApp error:", error);
  }
}

async function assignToStaff(
  supabase: SupabaseAny,
  config: Record<string, unknown>,
  lead: Lead,
  log: ExecutionLog
): Promise<void> {
  const assignmentType = config.assignment_type as string;
  let assigneeId: string | null = null;

  if (assignmentType === "specific") {
    assigneeId = config.telecaller_id as string;
  } else {
    // Round robin or least active - get telecallers
    const { data: telecallers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "telecaller");

    if (telecallers && telecallers.length > 0) {
      const userIds = telecallers.map((t) => t.user_id);

      if (assignmentType === "least_leads") {
        // Find telecaller with fewest active leads
        const counts = await Promise.all(
          userIds.map(async (uid) => {
            const { count } = await supabase
              .from("leads")
              .select("*", { count: "exact", head: true })
              .eq("assigned_to", uid)
              .in("status", ["unpaid", "paid", "verification"]);
            return { user_id: uid, count: count || 0 };
          })
        );
        const min = Math.min(...counts.map((c) => c.count));
        assigneeId = counts.find((c) => c.count === min)?.user_id || null;
      } else {
        // Round robin - pick random for simplicity
        assigneeId = userIds[Math.floor(Math.random() * userIds.length)];
      }
    }
  }

  if (assigneeId) {
    await supabase
      .from("leads")
      .update({ assigned_to: assigneeId })
      .eq("id", lead.id);
    log.actions.push(`Assigned to staff: ${assigneeId.substring(0, 8)}...`);
    console.log(`[execute-workflow] Assigned lead to: ${assigneeId}`);
  } else {
    log.errors.push("No staff available for assignment");
  }
}

function evaluateCondition(node: WorkflowNode, lead: Lead): boolean {
  const field = node.config.condition_field as string;
  const expectedValue = node.config.condition_value as string;

  switch (field) {
    case "status":
      return lead.status === expectedValue;
    case "loan_type":
      return lead.loan_type === expectedValue;
    case "is_assigned":
      return expectedValue === "true" ? !!lead.assigned_to : !lead.assigned_to;
    default:
      return false;
  }
}

async function startRemarketingCycle(
  supabase: SupabaseAny,
  config: Record<string, unknown>,
  lead: Lead,
  log: ExecutionLog
): Promise<void> {
  // Check if new remarketing cycles are disabled globally
  const { data: rmSetting } = await supabase.from("system_settings").select("value").eq("key", "remarketing_sms_new_cycles_enabled").maybeSingle();
  if (rmSetting?.value === "false") {
    log.actions.push(`Remarketing new cycles disabled globally, skipping`);
    console.log(`[execute-workflow] Remarketing new cycles disabled, skipping for lead ${lead.id}`);
    return;
  }

  // Check if ANY cycle already exists for this lead (active or otherwise)
  const { data: existing } = await supabase
    .from("remarketing_cycles")
    .select("id, status")
    .eq("lead_id", lead.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") {
      log.actions.push(`Remarketing already active for lead`);
      console.log(`[execute-workflow] Remarketing cycle already active for lead ${lead.id}`);
      return;
    }
    // If stopped/completed, update it to restart
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 3);
    await supabase
      .from("remarketing_cycles")
      .update({
        status: "active",
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        sms_sent_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    log.actions.push(`Restarted 3-day remarketing cycle`);
    console.log(`[execute-workflow] Restarted remarketing cycle for lead ${lead.id}`);
    return;
  }

  // Create new 3-day remarketing cycle
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 3);

  const { error } = await supabase
    .from("remarketing_cycles")
    .insert({
      lead_id: lead.id,
      company_id: lead.company_id || null,
      status: "active",
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      sms_sent_count: 0,
    });

  if (error) {
    log.errors.push(`Failed to start remarketing: ${error.message}`);
    console.error("[execute-workflow] Error starting remarketing:", error);
    return;
  }

  log.actions.push(`Started 3-day remarketing cycle`);
  console.log(`[execute-workflow] Started remarketing cycle for lead ${lead.id}`);
}

async function stopRemarketingCycle(
  supabase: SupabaseAny,
  lead: Lead,
  log: ExecutionLog
): Promise<void> {
  const { data, error } = await supabase
    .from("remarketing_cycles")
    .update({ status: "stopped" })
    .eq("lead_id", lead.id)
    .eq("status", "active");

  if (error) {
    log.errors.push(`Failed to stop remarketing: ${error.message}`);
    console.error("[execute-workflow] Error stopping remarketing:", error);
    return;
  }

  log.actions.push(`Stopped remarketing cycle`);
  console.log(`[execute-workflow] Stopped remarketing cycle for lead ${lead.id}`);
}

async function startWhatsAppRemarketingCycle(
  supabase: SupabaseAny,
  config: Record<string, unknown>,
  lead: Lead,
  log: ExecutionLog
): Promise<void> {
  const workflowId = config.workflow_id as string;
  const accountId = config.account_id as string;
  const steps = config.steps as Array<{
    delay_minutes: number;
    delay_label: string;
    action_type: string;
    action_config: Record<string, unknown>;
  }>;

  if (!steps || steps.length === 0) {
    log.errors.push("No steps configured for WhatsApp remarketing");
    return;
  }

  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/start-whatsapp-remarketing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          lead_id: lead.id,
          workflow_id: workflowId,
          account_id: accountId,
          steps,
        }),
      }
    );

    const result = await response.json();
    
    if (result.success) {
      log.actions.push(`Started WhatsApp remarketing: ${result.scheduled} messages scheduled`);
      console.log(`[execute-workflow] WhatsApp remarketing started for lead ${lead.id}`);
    } else {
      log.errors.push(`WhatsApp remarketing failed: ${result.error}`);
    }
  } catch (error) {
    log.errors.push(`WhatsApp remarketing error: ${String(error)}`);
    console.error("[execute-workflow] WhatsApp remarketing error:", error);
  }
}
