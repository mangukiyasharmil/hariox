import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GREENSMS_USERNAME = "HarioxSMS";
const GREENSMS_SENDER = "FUNCER";
const DLT_ENTITY_ID = "1701174159361029653";

const REMARKETING_TEMPLATES: Record<string, { templateId: string; message: string }> = {
  hariox: {
    templateId: "1707177133076035580",
    message: "Your Rs.{#var#} Pre-Approved Loan Confirmed. Get money in your bank A/C in 10 mins. Complete process now: https://credit.hariox.com/pay/marketing HARIOX",
  },
  credit: {
    templateId: "1707177133076035580",
    message: "Your Rs.{#var#} Pre-Approved Loan Confirmed. Get money in your bank A/C in 10 mins. Complete process now: https://credit.hariox.com/pay/marketing HARIOX",
  },
  finance: {
    templateId: "1707177133085983455",
    message: "Your Rs.{#var#} Pre-Approved Loan Confirmed. Get money in your bank A/C in 10 mins. Complete process now: https://finance.hariox.com/pay/marketing HARIOX",
  },
  "hariox": {
    templateId: "1707178153009447504",
    message: "Congrats! Your {#var#} Loan has been Pre-Approved! Get money directly in your bank a/c. Get Offer Now https://finance.fundkredit.com/apply Finance Fundkredit",
  },
  capital: {
    templateId: "1707177133093784308",
    message: "Your Rs.{#var#} Pre-Approved Loan Confirmed. Get money in your bank A/C in 10 mins. Complete process now: https://capital.hariox.com/pay/marketing HARIOX",
  },
};

const SMS_SCHEDULE: Record<number, { day: number; hour: number }> = {
  1: { day: 0, hour: 10 },
  2: { day: 0, hour: 20.5 },
  3: { day: 1, hour: 11 },
  4: { day: 1, hour: 19 },
  5: { day: 2, hour: 12 },
  6: { day: 3, hour: 20 },
  7: { day: 4, hour: 11 },
  8: { day: 5, hour: 20.5 },
  9: { day: 6, hour: 12 },
  10: { day: 7, hour: 19 },
};

const isBlockedTime = (hour: number): boolean => hour >= 21 || hour < 10;

const formatPhone = (p: string) => {
  const cleaned = (p || "").replace(/\D/g, "");
  return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
};

const getISTInfo = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const hour = istTime.getUTCHours();
  const minute = istTime.getUTCMinutes();
  return { hour, minute, hourDecimal: hour + minute / 60 };
};

const shouldSendNextSMS = (
  cycleStartDate: Date,
  currentSMSCount: number,
  lastSmsSentAt: string | null
): { shouldSend: boolean; smsNumber: number } => {
  const { hour, hourDecimal } = getISTInfo();
  if (isBlockedTime(hour)) return { shouldSend: false, smsNumber: 0 };

  const nextSMSNumber = currentSMSCount + 1;
  if (nextSMSNumber > 10) return { shouldSend: false, smsNumber: 0 };

  const schedule = SMS_SCHEDULE[nextSMSNumber];
  if (!schedule) return { shouldSend: false, smsNumber: 0 };

  // Cooldown: at least 2 hours between SMS
  if (lastSmsSentAt) {
    const hoursSinceLastSMS = (Date.now() - new Date(lastSmsSentAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSMS < 2) return { shouldSend: false, smsNumber: 0 };
  }

  const daysSinceCycleStart = (Date.now() - new Date(cycleStartDate).getTime()) / (24 * 60 * 60 * 1000);

  // Not yet reached the scheduled day
  if (daysSinceCycleStart < schedule.day) return { shouldSend: false, smsNumber: 0 };

  // On the scheduled day: check time window
  if (Math.floor(daysSinceCycleStart) === schedule.day) {
    const windowMinutes = nextSMSNumber === 1 ? 120 : 30;
    const hourDiff = hourDecimal - schedule.hour;
    if (hourDiff >= 0 && hourDiff <= windowMinutes / 60) {
      return { shouldSend: true, smsNumber: nextSMSNumber };
    }
    // Still on the correct day but outside window — don't send yet, might hit later
    return { shouldSend: false, smsNumber: 0 };
  }

  // PAST the scheduled day — this is OVERDUE, send catch-up immediately
  // (as long as we're in allowed hours, which we already checked)
  return { shouldSend: true, smsNumber: nextSMSNumber };
};

// Resolve per-franchise SMS credentials from company_integrations
const resolveSmsCredentials = async (
  supabase: any,
  companyId: string | null,
  defaultApiKey: string,
  defaultSender: string,
  defaultEntityId: string
): Promise<{ apiKey: string; username: string; sender: string; entityId: string; templateIds: Record<string, string> | null }> => {
  if (!companyId) {
    return { apiKey: defaultApiKey, username: GREENSMS_USERNAME, sender: defaultSender, entityId: defaultEntityId, templateIds: null };
  }

  try {
    const { data: integration } = await supabase
      .from('company_integrations')
      .select('config')
      .eq('company_id', companyId)
      .eq('service_type', 'sms')
      .eq('is_active', true)
      .maybeSingle();

    if (integration?.config) {
      const cfg = integration.config as Record<string, any>;
      return {
        apiKey: cfg.api_key || defaultApiKey,
        username: cfg.username || cfg.provider || GREENSMS_USERNAME,
        sender: cfg.sender_id || defaultSender,
        entityId: cfg.dlt_entity_id || defaultEntityId,
        templateIds: cfg.dlt_template_ids || null,
      };
    }
  } catch (e) {
    console.warn('Failed to resolve franchise SMS config, using defaults:', e);
  }

  return { apiKey: defaultApiKey, username: GREENSMS_USERNAME, sender: defaultSender, entityId: defaultEntityId, templateIds: null };
};

// Send SMS via GreenSMS API using dynamically resolved credentials
const sendSmsGreen = async (args: {
  apiKey: string;
  username: string;
  sender: string;
  entityId: string;
  phone: string;
  message: string;
  templateId: string;
  variables?: string[];
}) => {
  const params = new URLSearchParams({
    username: args.username, apikey: args.apiKey, apirequest: "Text",
    sender: args.sender, mobile: args.phone, message: args.message,
    route: "TRANS", senderid: args.sender, number: args.phone, msg: args.message,
  });
  if (args.variables?.length) {
    args.variables.forEach((v, idx) => params.set(`var${idx + 1}`, v));
    params.set("var", args.variables[0]);
    params.set("val", args.variables[0]);
  }
  params.set("entityid", args.entityId);
  params.set("entityId", args.entityId);
  params.set("entity_id", args.entityId);
  params.set("dlt_entity_id", args.entityId);
  params.set("templateid", args.templateId);
  params.set("templateId", args.templateId);
  params.set("template_id", args.templateId);
  params.set("tempid", args.templateId);
  params.set("dlt_template_id", args.templateId);

  const res = await fetch(`https://login.greensms.in/sms-panel/api/http/index.php?${params.toString()}`);
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, json };
};

// Process a single cycle
const processCycle = async (
  cycle: { id: string; lead_id: string; company_id: string | null; sms_sent_count: number; start_date: string; last_sms_sent_at: string | null },
  supabase: ReturnType<typeof createClient>,
  defaultApiKey: string,
  companySlugs: Map<string, string>
): Promise<"sent" | "stopped" | "completed" | "skipped" | "error"> => {
  try {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, phone, full_name, loan_amount, status, company_id")
      .eq("id", cycle.lead_id)
      .single();

    if (!lead) return "skipped";

    const companySlug = cycle.company_id ? (companySlugs.get(cycle.company_id) || "hariox") : "hariox";
    const effectiveCompanyId = cycle.company_id || lead.company_id || null;

    if (lead.status === "paid") {
      await supabase.from("remarketing_cycles").update({ status: "stopped" }).eq("id", cycle.id);
      return "stopped";
    }

    if (cycle.sms_sent_count >= 10) {
      await supabase.from("remarketing_cycles").update({ status: "completed" }).eq("id", cycle.id);
      return "completed";
    }

    const { shouldSend, smsNumber } = shouldSendNextSMS(new Date(cycle.start_date), cycle.sms_sent_count, cycle.last_sms_sent_at);
    if (!shouldSend) return "skipped";

    // Resolve per-franchise credentials dynamically (Sender, API key, DLT parameters)
    const credentials = await resolveSmsCredentials(
      supabase,
      effectiveCompanyId,
      defaultApiKey,
      GREENSMS_SENDER,
      DLT_ENTITY_ID
    );

    const template = REMARKETING_TEMPLATES[companySlug] || REMARKETING_TEMPLATES.hariox;
    let templateId = template.templateId;

    // Apply custom template override if configured for this franchise
    if (credentials.templateIds) {
      if (credentials.templateIds["remarketing"]) {
        templateId = credentials.templateIds["remarketing"];
      } else {
        const mappingKeys: Record<string, string> = {
          hariox: "remarketing_credit",
          credit: "remarketing_credit",
          finance: "remarketing_finance",
          capital: "remarketing_capital"
        };
        const mappedKey = mappingKeys[companySlug] || "remarketing";
        if (credentials.templateIds[mappedKey]) {
          templateId = credentials.templateIds[mappedKey];
        }
      }
    }

    const phone = formatPhone(lead.phone);
    if (!phone) return "skipped";

    const rawAmount = Number(lead.loan_amount || 0);
    const loanAmount = String(rawAmount > 0 ? rawAmount : 635000);

    const smsResult = await sendSmsGreen({
      apiKey: credentials.apiKey,
      username: credentials.username,
      sender: credentials.sender,
      entityId: credentials.entityId,
      phone,
      message: template.message.replace("{#var#}", loanAmount),
      templateId,
      variables: [loanAmount],
    });

    const newCount = cycle.sms_sent_count + 1;
    const updateData: Record<string, unknown> = {
      sms_sent_count: newCount, last_sms_sent_at: new Date().toISOString(),
    };
    if (newCount >= 10) updateData.status = "completed";

    await supabase.from("remarketing_cycles").update(updateData).eq("id", cycle.id);

    // Log company-specific sms_type for accurate reporting
    const smsTypeMap: Record<string, string> = { hariox: "remarketing_credit", credit: "remarketing_credit", finance: "remarketing_finance", "hariox": "remarketing_finance", capital: "remarketing_capital" };
    const smsType = smsTypeMap[companySlug] || "remarketing_credit";

    await supabase.from("sms_logs").insert({
      phone, message: template.message.replace("{#var#}", loanAmount),
      sms_type: smsType, template_id: templateId,
      lead_id: lead.id, status: smsResult.ok ? "sent" : "failed",
      provider: "greensms", provider_response: smsResult.json,
      sent_at: new Date().toISOString(),
      company_id: effectiveCompanyId,
    });

    return smsResult.ok ? "sent" : "error";
  } catch (err) {
    console.error(`[remarketing] Error processing cycle ${cycle.id}:`, err);
    return "error";
  }
};

// Process batch of cycles in parallel
const processBatch = async (
  batch: any[],
  supabase: ReturnType<typeof createClient>,
  smsApiKey: string,
  companySlugs: Map<string, string>
): Promise<{ sent: number; stopped: number; completed: number; skipped: number; errors: number }> => {
  const results = await Promise.allSettled(
    batch.map(cycle => processCycle(cycle, supabase, smsApiKey, companySlugs))
  );

  const counts = { sent: 0, stopped: 0, completed: 0, skipped: 0, errors: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value === "sent") counts.sent++;
      else if (r.value === "stopped") counts.stopped++;
      else if (r.value === "completed") counts.completed++;
      else if (r.value === "skipped") counts.skipped++;
      else counts.errors++;
    } else {
      counts.errors++;
    }
  }
  return counts;
};

// Fetch ALL active cycles using pagination (bypass 1000-row limit)
const fetchAllActiveCycles = async (supabase: ReturnType<typeof createClient>) => {
  const allCycles: any[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from("remarketing_cycles")
      .select("id, lead_id, company_id, sms_sent_count, start_date, last_sms_sent_at")
      .eq("status", "active")
      .range(offset, offset + PAGE_SIZE - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allCycles.push(...data);
    if (data.length < PAGE_SIZE) break; // Last page
    offset += PAGE_SIZE;
  }
  
  return allCycles;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let smsApiKey = (Deno.env.get("GREENSMS_API_KEY") || "").trim();
    if (smsApiKey.startsWith("http")) {
      try { smsApiKey = new URL(smsApiKey).searchParams.get("apikey") || smsApiKey; } catch {}
    }
    if (!smsApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "SMS not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if SMS is enabled
    const { data: smsEnabledSetting } = await supabase
      .from("system_settings").select("value").eq("key", "sms_enabled").maybeSingle();
    if (smsEnabledSetting?.value === "false") {
      return new Response(
        JSON.stringify({ success: true, message: "SMS disabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { hour, minute } = getISTInfo();
    console.log(`[remarketing] Running at IST ${hour}:${String(minute).padStart(2, '0')}`);

    // Blocked hours check — skip entirely
    if (isBlockedTime(hour)) {
      return new Response(
        JSON.stringify({ success: true, message: "Outside SMS hours (10AM-9PM IST)", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ALL active cycles (paginated to bypass 1000-row limit)
    const allCycles = await fetchAllActiveCycles(supabase);
    console.log(`[remarketing] Found ${allCycles.length} active cycles`);

    if (allCycles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active cycles", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pre-fetch all company slugs in one query
    const companyIds = [...new Set(allCycles.map(c => c.company_id).filter(Boolean))] as string[];
    const companySlugs = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies").select("id, slug").in("id", companyIds);
      (companies || []).forEach(c => companySlugs.set(c.id, c.slug));
    }

    // Prioritize overdue cycles first (sort by last_sms_sent_at ascending, nulls first)
    allCycles.sort((a, b) => {
      const aTime = a.last_sms_sent_at ? new Date(a.last_sms_sent_at).getTime() : 0;
      const bTime = b.last_sms_sent_at ? new Date(b.last_sms_sent_at).getTime() : 0;
      return aTime - bTime;
    });

    // Process in parallel batches of 50
    const BATCH_SIZE = 50;
    const totals = { sent: 0, stopped: 0, completed: 0, skipped: 0, errors: 0 };

    for (let i = 0; i < allCycles.length; i += BATCH_SIZE) {
      const batch = allCycles.slice(i, i + BATCH_SIZE);
      const batchResult = await processBatch(batch, supabase, smsApiKey, companySlugs);
      totals.sent += batchResult.sent;
      totals.stopped += batchResult.stopped;
      totals.completed += batchResult.completed;
      totals.skipped += batchResult.skipped;
      totals.errors += batchResult.errors;

      console.log(`[remarketing] Batch ${Math.floor(i / BATCH_SIZE) + 1} done: sent=${batchResult.sent} stopped=${batchResult.stopped} skipped=${batchResult.skipped}`);
    }

    const summary = {
      success: true,
      ist_time: `${hour}:${String(minute).padStart(2, '0')}`,
      processed: allCycles.length,
      ...totals,
    };

    console.log("[remarketing] Complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[remarketing] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
