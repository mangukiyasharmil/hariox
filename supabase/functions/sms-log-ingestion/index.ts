import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-franchise-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * SMS Log Ingestion Endpoint
 * 
 * External franchise websites call this endpoint to log SMS messages
 * into the Hariox admin panel's sms_logs table.
 * 
 * POST body:
 * {
 *   "api_key": "FRANCHISE_API_KEY",        // required: security key
 *   "company_id": "uuid",                   // optional: company UUID (auto-resolved if not provided)
 *   "company_slug": "hariox",   // optional: used to resolve company_id
 *   "phone": "9876543210",                  // required: 10-digit phone number
 *   "message": "Hello, OTP is 1234",        // required: SMS message content
 *   "sms_type": "otp",                      // required: otp|status|marketing|remarketing|reminder
 *   "status": "sent",                       // required: sent|delivered|failed|pending
 *   "message_id": "abc123",                 // optional: provider message ID for delivery tracking
 *   "template_id": "1707xxx",               // optional: DLT template ID
 *   "cost_credits": 0.11,                   // optional: cost in credits
 *   "sent_at": "2026-06-20T08:56:00Z",      // optional: ISO timestamp when sent
 *   "error_message": null                   // optional: error if failed
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // Validate API key for security
    // Hardcoded keys — add more keys separated by comma for multiple franchises
    const VALID_API_KEYS = [
      "02bfc9c38692d80b37a023f2ad88d61ede846c97aef2c6cd03b8d3da3025c486", // Finance Fundkredit
    ];
    const providedKey = (body.api_key || req.headers.get("x-franchise-api-key") || "").trim();
    
    if (!VALID_API_KEYS.includes(providedKey)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = String(body.message || "").trim();
    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes = ["otp", "status", "marketing", "remarketing", "reminder", "telecaller_credit", "payment_success", "payment_failed"];
    const smsType = validTypes.includes(body.sms_type) ? body.sms_type : "otp";

    const validStatuses = ["sent", "delivered", "failed", "pending", "submitted"];
    const status = validStatuses.includes(body.status) ? body.status : "sent";

    // Resolve company_id
    let companyId = body.company_id || null;

    if (!companyId && body.company_slug) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("slug", body.company_slug)
        .eq("is_active", true)
        .maybeSingle();
      if (company?.id) companyId = company.id;
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: "company_id or company_slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify company exists
    const { data: company } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (!company) {
      return new Response(
        JSON.stringify({ success: false, error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build provider_response from message_id if provided
    const providerResponse = body.message_id ? { "message-id": body.message_id } : null;

    // Insert SMS log
    const { data: insertedLog, error: insertError } = await supabase
      .from("sms_logs")
      .insert({
        phone,
        sms_type: smsType,
        message,
        status,
        company_id: companyId,
        provider: body.provider || "greensms",
        template_id: body.template_id || null,
        provider_response: providerResponse,
        cost_credits: Number(body.cost_credits) || (status === "sent" || status === "delivered" ? 0.11 : 0),
        sent_at: body.sent_at || (status !== "failed" ? new Date().toISOString() : null),
        error_message: body.error_message || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("sms-log-ingestion:insert_error", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to insert log", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`sms-log-ingestion:success company=${company.name} phone=${phone} type=${smsType} log_id=${insertedLog?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        log_id: insertedLog?.id,
        company: company.name,
        message: "SMS log recorded successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("sms-log-ingestion:error", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
