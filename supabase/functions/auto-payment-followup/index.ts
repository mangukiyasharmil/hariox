import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Company domain map
const COMPANY_DOMAINS: Record<string, string> = {
  "0a817e57-9c31-4aba-b709-3647958b917e": "https://credit.hariox.com",
  "e00c26fa-d874-4977-9fc6-bdf6e6b66344": "https://finance.hariox.com",
  "bbe9fc5c-0caf-458e-aada-fa33143c4ff4": "https://capital.hariox.com",
  "e6b82169-19d7-4e93-a0c0-304b89bcab71": "https://finance.fundkredit.com",
};

// Per-company WhatsApp account IDs
const COMPANY_WA_ACCOUNT: Record<string, string> = {
  "0a817e57-9c31-4aba-b709-3647958b917e": "14695e74-2978-492a-9d22-43a5237da840", // Credit
  "e00c26fa-d874-4977-9fc6-bdf6e6b66344": "a91e64ce-86b8-49de-b949-ac260bb9163b", // Finance Hariox
  "bbe9fc5c-0caf-458e-aada-fa33143c4ff4": "d0eb940b-2d3c-4774-a46a-a89548af4004", // Capital
  "e6b82169-19d7-4e93-a0c0-304b89bcab71": "80f1b467-5229-497a-9e5c-0c3516963816", // Finance Fundkredit
};

// Per-company template names for each reminder slot
const COMPANY_TEMPLATES: Record<string, { first: string; second: string }> = {
  "0a817e57-9c31-4aba-b709-3647958b917e": { first: "remarketing_credit_1", second: "remarketing_credit_2" },
  "e00c26fa-d874-4977-9fc6-bdf6e6b66344": { first: "remarketing_finance_1", second: "remarketing_finance_2" },
  "bbe9fc5c-0caf-458e-aada-fa33143c4ff4": { first: "remarketing_capital",   second: "remarketing_capital_2" },
  "e6b82169-19d7-4e93-a0c0-304b89bcab71": { first: "remarketing_finance_1", second: "remarketing_finance_2" },
};

/**
 * Auto Payment Follow-up System
 * Called by cron every minute. Checks for unpaid leads and sends
 * WhatsApp reminders at 1hr, 6hr, and 24hr intervals.
 *
 * Payment link logic:
 *  - Telecaller source → /telecaller link
 *  - WhatsApp/marketing/other → /whatsapp link
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const results = { checked: 0, sent1hr: 0, sent6hr: 0, sent24hr: 0, skipped: 0, errors: 0 };

    // Check IST time - only send between 9 AM and 9 PM IST
    const istHour = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();
    if (istHour < 9 || istHour >= 21) {
      return new Response(
        JSON.stringify({ success: true, message: "Outside messaging window (9AM-9PM IST)", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch unpaid leads created in last 25 hours (covers all 3 reminder windows)
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const { data: unpaidLeads, error: leadsError } = await supabase
      .from("leads")
      .select("id, full_name, phone, loan_amount, loan_type, city, source, company_id, created_at")
      .eq("status", "unpaid")
      .gte("created_at", twentyFiveHoursAgo)
      .order("created_at", { ascending: true })
      .limit(200);

    if (leadsError || !unpaidLeads) {
      console.error("[auto-followup] Error fetching leads:", leadsError);
      return new Response(
        JSON.stringify({ success: false, error: leadsError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    results.checked = unpaidLeads.length;

    for (const lead of unpaidLeads) {
      const leadAgeMs = now.getTime() - new Date(lead.created_at).getTime();
      const leadAgeHours = leadAgeMs / (1000 * 60 * 60);

      // Determine which reminder to send based on age
      let reminderType: "1hr" | "6hr" | "24hr" | null = null;
      if (leadAgeHours >= 1 && leadAgeHours < 1.5) reminderType = "1hr";
      else if (leadAgeHours >= 6 && leadAgeHours < 6.5) reminderType = "6hr";
      else if (leadAgeHours >= 24 && leadAgeHours < 24.5) reminderType = "24hr";

      if (!reminderType) continue;

      // Check if this reminder was already sent
      const { data: existingReminder } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("action", `auto_followup_${reminderType}`)
        .maybeSingle();

      if (existingReminder) {
        results.skipped++;
        continue;
      }

      // Check DND
      const cleanPhone = lead.phone?.replace(/\D/g, "").slice(-10);
      if (!cleanPhone) continue;

      // Build payment link based on source
      const domain = COMPANY_DOMAINS[lead.company_id] || "https://credit.hariox.com";
      const isTelecaller = lead.source === "telecaller" || lead.source === "staff";
      const paymentPath = isTelecaller ? "/telecaller" : "/whatsapp";
      const paymentLink = `${domain}${paymentPath}`;

      // Approved Meta template is the source of truth for what's sent.
      // We no longer attach a hardcoded fallback text — the template renders the actual message.
      const name = lead.full_name || "Customer";
      const message = "";

      try {
        // Pick the correct WA account and template for this lead's company
        const companyId = lead.company_id || "";
        const waAccountId = COMPANY_WA_ACCOUNT[companyId];
        const templates = COMPANY_TEMPLATES[companyId];

        if (!waAccountId || !templates) {
          console.warn(`[auto-followup] No WA account/template config for company ${companyId}, skipping lead ${lead.id}`);
          results.skipped++;
          continue;
        }

        // TEMPLATE STRATEGY:
        // 1hr  → remarketing_credit_1 (first template)
        // 6hr & 24hr → remarketing_credit_2 (second template)
        // All sent as approved Meta marketing templates (correct category, no surprise Utility charges)
        const templateName = reminderType === "1hr" ? templates.first : templates.second;

        const payload: Record<string, unknown> = {
          account_id: waAccountId,
          phone_number: cleanPhone,
          contact_name: name,
          lead_id: lead.id,
          message_source: "workflow",
          template_name: templateName,
          template_language: "en",
          template_params: [name],
          message, // readable fallback for inbox display
        };

        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            },
            body: JSON.stringify(payload),
          }
        );

        const result = await response.json();
        console.log(`[auto-followup] ${reminderType} → ${templateName} for ${lead.id}: ${result.success ? "OK" : result.error}`);
        
        if (result.success || result.error_code === "DND_BLOCKED") {
          await supabase.from("activity_logs").insert({
            lead_id: lead.id,
            action: `auto_followup_${reminderType}`,
            details: {
              reminder_type: reminderType,
              template: templateName,
              payment_link: paymentLink,
              source: lead.source,
              sent: result.success,
              blocked: result.error_code === "DND_BLOCKED",
            },
          });

          if (reminderType === "1hr") results.sent1hr++;
          else if (reminderType === "6hr") results.sent6hr++;
          else results.sent24hr++;
        } else {
          console.error(`[auto-followup] Failed for ${lead.id}:`, result.error);
          results.errors++;
          
          await supabase.from("activity_logs").insert({
            lead_id: lead.id,
            action: `auto_followup_${reminderType}`,
            details: { reminder_type: reminderType, template: templateName, error: result.error },
          });
        }
      } catch (error) {
        console.error(`[auto-followup] Error sending to ${lead.id}:`, error);
        results.errors++;
      }

      // Small delay between sends to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[auto-followup] Results:`, results);
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[auto-followup] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
