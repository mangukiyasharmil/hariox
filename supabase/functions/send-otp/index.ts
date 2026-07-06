import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DLT_ENTITY_ID = "1701174159361029653";

// OTP Templates - use primary OTP template (shorter, cleaner)
// Template ID: 1707174160032929634
// Content: "Hello, OTP for your mobile number registration is {#var#}. Kindly do not share it with anyone. Thanks, HARIOX"
const OTP_TEMPLATE_ID = "1707174160032929634";
const OTP_TEMPLATE_MESSAGE = "Hello, OTP for your mobile number registration is {#var#}. Kindly do not share it with anyone. Thanks, HARIOX";

// GreenSMS configuration fallback
const GREENSMS_USERNAME = "HarioxSMS";
const GREENSMS_SENDER = "FUNCER";

// Infer company slug from request hostname - always return hariox for single brand
const inferCompanySlugFromHostname = (hostname: string): string | null => {
  return "hariox";
};

const getHostnameFromRequest = (req: Request): string | null => {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {}
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {}
  }
  return null;
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
    let defaultApiKey = (Deno.env.get("GREENSMS_API_KEY") || "").trim();
    if (defaultApiKey.startsWith("http")) {
      try {
        const url = new URL(defaultApiKey);
        defaultApiKey = url.searchParams.get("apikey") || defaultApiKey;
      } catch {}
    }
    if (!defaultApiKey) {
      throw new Error("GREENSMS_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const cleanPhone = phone.length > 10 ? phone.slice(-10) : phone;

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve company_id based on explicit body parameter or request origin
    let companyId = body.company_id || null;
    
    if (!companyId) {
      const hostname = getHostnameFromRequest(req);
      if (hostname) {
        // Query by custom_domain first to support custom franchise domains (e.g. finance.fundkredit.com)
        // Use .ilike() directly (not .or()) to avoid PostgREST parsing issues with dots in hostname
        const { data: matchedDomains } = await supabase
          .from("companies")
          .select("id")
          .ilike("custom_domain", `%${hostname}%`)
          .eq("is_active", true)
          .limit(1);

        const matchedDomain = matchedDomains?.[0] || null;

        if (matchedDomain?.id) {
          companyId = matchedDomain.id;
          console.log(`send-otp:custom_domain_match hostname=${hostname} companyId=${companyId}`);
        } else {
          const inferredSlug = inferCompanySlugFromHostname(hostname);
          if (inferredSlug) {
            const { data: company } = await supabase
              .from("companies")
              .select("id")
              .eq("slug", inferredSlug)
              .eq("is_active", true)
              .maybeSingle();
            if (company?.id) companyId = company.id;
            console.log(`send-otp:slug_match hostname=${hostname} slug=${inferredSlug} companyId=${companyId}`);
          }
        }
      }
    }

    // Rate limiting: max 5 OTPs per phone per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", cleanPhone)
      .gte("created_at", tenMinutesAgo);

    if ((count || 0) >= 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many OTP requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nowMs = Date.now();
    
    // Generate 4-digit OTP or use provided code
    const otp = body.code ? String(body.code) : String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(nowMs + 5 * 60 * 1000).toISOString(); // 5 minutes
    
    // Helper: SHA-256 hash
    async function hashCode(code: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }
    
    const hashedOtp = await hashCode(otp);

    // Expire any previous unverified OTPs for this phone.
    await supabase
      .from("otp_codes")
      .update({ expires_at: new Date(nowMs - 1000).toISOString() })
      .eq("phone", cleanPhone)
      .eq("verified", false);

    // Store OTP
    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: cleanPhone,
      hashed_code: hashedOtp,
      expires_at: expiresAt,
      attempts: 0,
      verified: false,
      company_id: companyId,
    });

    if (insertError) {
      console.error("send-otp:insert_error", insertError);
      throw new Error("Failed to generate OTP");
    }

    // Resolve SMS credentials dynamically
    const credentials = await resolveSmsCredentials(
      supabase,
      companyId,
      defaultApiKey,
      GREENSMS_SENDER,
      DLT_ENTITY_ID
    );

    let templateId = OTP_TEMPLATE_ID;
    let messageTemplate = OTP_TEMPLATE_MESSAGE;

    if (credentials.templateIds?.otp) {
      templateId = credentials.templateIds.otp;
      // Finance Fundkredit OTP template
      if (templateId === "1707178134576869391") {
        messageTemplate = "Hello, the OTP for your mobile number registration is {#var#} Kindly don't share it with anyone. Regards, FinanceFundkredit";
      } else if (templateId && templateId !== OTP_TEMPLATE_ID) {
        // Generic fallback for other franchise OTP templates - use their custom message if available
        // The actual message will be resolved from the company's registered template
        messageTemplate = messageTemplate; // keep default, franchise must use same format
      }
    }

    const message = messageTemplate.replace("{#var#}", otp);

    const params = new URLSearchParams({
      username: credentials.username,
      apikey: credentials.apiKey,
      apirequest: "Text",
      sender: credentials.sender,
      mobile: cleanPhone,
      message,
      route: "TRANS",
    });

    params.set("senderid", credentials.sender);
    params.set("number", cleanPhone);
    params.set("msg", message);

    params.set("var1", otp);
    params.set("var", otp);
    params.set("val", otp);

    params.set("entityid", credentials.entityId);
    params.set("entityId", credentials.entityId);
    params.set("EntityID", credentials.entityId);
    params.set("entity_id", credentials.entityId);
    params.set("dlt_entity_id", credentials.entityId);

    params.set("templateid", templateId);
    params.set("templateId", templateId);
    params.set("TemplateID", templateId);
    params.set("template_id", templateId);
    params.set("tempid", templateId);
    params.set("dlt_template_id", templateId);
    
    const smsUrl = `https://login.greensms.in/sms-panel/api/http/index.php?${params.toString()}`;

    console.log(`send-otp:sending via ${credentials.username} for company: ${companyId}`);

    const response = await fetch(smsUrl);
    const text = await response.text();
    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    console.log("send-otp:provider_response", { ok: response.ok, result });

    const providerStatus = String(result?.status ?? result?.Status ?? result?.STATUS ?? "").toLowerCase();
    const rawText = String((result as any)?.raw ?? "").toLowerCase();
    const isSuccess = response.ok && (providerStatus === "success" || providerStatus === "ok" || providerStatus === "sent" || rawText.includes("success") || rawText.includes("sent"));
    
    // Log to sms_logs table (storing company_id correctly)
    await supabase.from("sms_logs").insert({
      phone: cleanPhone,
      sms_type: "otp",
      message,
      status: isSuccess ? "sent" : "failed",
      cost_credits: isSuccess ? 0.11 : 0,
      sent_at: isSuccess ? new Date().toISOString() : null,
      error_message: isSuccess ? null : String(result?.message ?? "Failed to send OTP"),
      provider: "greensms",
      template_id: templateId,
      provider_response: result,
      company_id: companyId,
    });
    
    if (isSuccess) {
      return new Response(
        JSON.stringify({ success: true, message: "OTP sent successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = String(result?.message ?? result?.Message ?? "Failed to send OTP");
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("send-otp:error", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
