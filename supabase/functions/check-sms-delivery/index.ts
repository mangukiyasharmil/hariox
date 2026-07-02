import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GREENSMS_USERNAME = "HarioxSMS";
const GREENSMS_SENDER = "FUNCER";
const DLT_ENTITY_ID = "1701174159361029653";

// Resolve per-franchise SMS credentials from company_integrations
const resolveSmsCredentials = async (
  supabase: any,
  companyId: string | null,
  defaultApiKey: string,
  defaultSender: string,
  defaultEntityId: string
): Promise<{ apiKey: string; username: string; sender: string; entityId: string }> => {
  if (!companyId) {
    return { apiKey: defaultApiKey, username: GREENSMS_USERNAME, sender: defaultSender, entityId: defaultEntityId };
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
      };
    }
  } catch (e) {
    console.warn('Failed to resolve franchise SMS config, using defaults:', e);
  }

  return { apiKey: defaultApiKey, username: GREENSMS_USERNAME, sender: defaultSender, entityId: defaultEntityId };
};

// Helper to add small delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let defaultApiKey = (Deno.env.get("GREENSMS_API_KEY") || "").trim();
    if (defaultApiKey.startsWith("http")) {
      try { defaultApiKey = new URL(defaultApiKey).searchParams.get("apikey") || defaultApiKey; } catch {}
    }

    if (!defaultApiKey) {
      throw new Error("GREENSMS_API_KEY not configured");
    }

    // Get request body for optional params
    let batchSize = 500;
    let offset = 0;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 200;
      offset = body.offset || 0;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Get pending SMS logs that have message IDs (sent/submitted status)
    const { data: pendingLogs, error: fetchError, count } = await supabase
      .from("sms_logs")
      .select("id, provider_response, status, company_id", { count: "exact" })
      .in("status", ["sent", "submitted"])
      .not("provider_response", "is", null)
      .order("created_at", { ascending: true }) // Oldest first
      .range(offset, offset + batchSize - 1);

    if (fetchError) throw fetchError;

    console.log(`Found ${pendingLogs?.length || 0} pending SMS to check (total pending: ${count})`);

    const results = {
      checked: pendingLogs?.length || 0,
      totalPending: count || 0,
      delivered: 0,
      failed: 0,
      rejected: 0,
      unchanged: 0,
      errors: [] as string[],
    };
    
    // Process in parallel batches of 10 for speed
    const processLog = async (log: any) => {
      try {
        const providerResponse = log.provider_response as any;
        let messageId = providerResponse?.["message-id"] || 
                        providerResponse?.MessageId || 
                        providerResponse?.messageid || 
                        providerResponse?.msgid ||
                        providerResponse?.id;
        
        if (Array.isArray(messageId)) {
          messageId = messageId[0];
        }
        
        if (!messageId) {
          // Mark as failed if no message ID (likely API error on send)
          await supabase
            .from("sms_logs")
            .update({ status: "failed", error_message: "No message ID from provider" })
            .eq("id", log.id);
          results.failed++;
          return;
        }

        // Resolve credentials for this log's company
        const credentials = await resolveSmsCredentials(
          supabase,
          log.company_id,
          defaultApiKey,
          GREENSMS_SENDER,
          DLT_ENTITY_ID
        );

        const params = new URLSearchParams({
          username: credentials.username,
          apikey: credentials.apiKey,
          apirequest: "DeliveryReport",
          messageid: messageId,
          format: "JSON"
        });
        
        const deliveryUrl = `https://login.greensms.in/sms-panel/api/http/index.php?${params.toString()}`;
        
        const response = await fetch(deliveryUrl);
        const deliveryData = await response.json();

        let newStatus = log.status;
        let deliveredAt = null;
        let errorMessage = null;

        const messageStatus = deliveryData.message_status || "";
        const stat = deliveryData.stat || "";
        const statusLower = (messageStatus + stat).toLowerCase();

        if (statusLower.includes("deliver") || stat === "DELIVRD") {
          newStatus = "delivered";
          deliveredAt = new Date().toISOString();
          results.delivered++;
        } else if (statusLower.includes("fail") || stat === "FAILED" || stat === "UNDELIV") {
          newStatus = "failed";
          errorMessage = `${messageStatus} (Error: ${deliveryData.err || "unknown"})`;
          results.failed++;
        } else if (statusLower.includes("reject") || statusLower.includes("dnd") || stat === "REJECTD") {
          newStatus = "rejected";
          errorMessage = `${messageStatus} (Error: ${deliveryData.err || "unknown"})`;
          results.rejected++;
        } else {
          results.unchanged++;
          return;
        }

        if (newStatus !== log.status) {
          await supabase
            .from("sms_logs")
            .update({
              status: newStatus,
              delivered_at: deliveredAt,
              error_message: errorMessage,
            })
            .eq("id", log.id);
        }
      } catch (err: any) {
        console.error(`Error checking log ${log.id}:`, err);
        results.errors.push(`${log.id}: ${err.message}`);
      }
    };

    // Process logs in parallel batches of 10
    const logs = pendingLogs || [];
    for (let i = 0; i < logs.length; i += 10) {
      const batch = logs.slice(i, i + 10);
      await Promise.all(batch.map(processLog));
      // Small delay between batches to avoid rate limiting
      if (i + 10 < logs.length) {
        await delay(100);
      }
    }

    console.log("Sync results:", results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: results.delivered + results.failed + results.rejected,
        ...results,
        message: `Checked ${results.checked} SMS: ${results.delivered} delivered, ${results.failed} failed, ${results.rejected} rejected, ${results.unchanged} pending`
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error("Error in check-sms-delivery:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
