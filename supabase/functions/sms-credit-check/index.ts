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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let defaultApiKey = (Deno.env.get("GREENSMS_API_KEY") || "").trim();
    if (defaultApiKey.startsWith("http")) {
      try { defaultApiKey = new URL(defaultApiKey).searchParams.get("apikey") || defaultApiKey; } catch {}
    }

    if (!defaultApiKey) {
      throw new Error("GREENSMS_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract company_id from body
    let companyId = null;
    try {
      const body = await req.json();
      companyId = body.company_id || null;
    } catch {
      // Ignore if no body or invalid json
    }

    const credentials = await resolveSmsCredentials(
      supabase,
      companyId,
      defaultApiKey,
      GREENSMS_SENDER,
      DLT_ENTITY_ID
    );

    // Call Credit Check API
    const creditUrl = `https://login.greensms.in/sms-panel/api/http/index.php?username=${credentials.username}&apikey=${credentials.apiKey}&apirequest=CreditCheck&route=TRANS&format=JSON`;
    
    console.log(`Checking credits for username: ${credentials.username} on company: ${companyId}`);
    const creditResponse = await fetch(creditUrl);
    const creditData = await creditResponse.json();
    console.log("Credit check response:", creditData);

    // Call Route Inquire API
    const routeUrl = `https://login.greensms.in/sms-panel/api/http/index.php?username=${credentials.username}&apikey=${credentials.apiKey}&apirequest=InquireRoute&format=JSON`;
    
    const routeResponse = await fetch(routeUrl);
    const routeData = await routeResponse.json();
    console.log("Route inquire response:", routeData);

    // Calculate SMS count based on cost (₹0.11 per SMS)
    const SMS_COST = 0.11;
    const credits = parseFloat(creditData.credits || creditData.balance || creditData.Credit || "0");
    const estimatedSmsCount = Math.floor(credits / SMS_COST);

    return new Response(
      JSON.stringify({ 
        success: true,
        credits: credits,
        sms_cost: SMS_COST,
        estimated_sms_remaining: estimatedSmsCount,
        routes: routeData.routes || routeData.Routes || routeData,
        raw_credit_response: creditData,
        raw_route_response: routeData,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error("Error in sms-credit-check:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
