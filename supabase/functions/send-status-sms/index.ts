import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// GreenSMS configuration
const GREENSMS_USERNAME = "HarioxSMS";
const GREENSMS_SENDER = "FUNCER";
const DLT_ENTITY_ID = "1701174159361029653";

// DLT Template IDs from Feb 18, 2026 Excel
const TEMPLATES = {
  rejected: {
    templateId: "1707177005392409980",
    message: "Dear Customer, we regret to inform you that your loan request could not be processed at this time due to eligibility criteria. Team Hariox.",
    varCount: 0,
  },
  payment_success: {
    templateId: "1707177005084194117",
    message: "Dear Customer, congratulations! Your loan application is approved. Our executive will contact you shortly for next steps. Team Hariox.",
    varCount: 0,
  },
  payment_done_docs: {
    templateId: "1707177046090359201",
    message: "Dear Customer, congratulations! Thank u For Paying Fees. Now Upload Your Documents In Portal For faster process and next day Our executive will contact you for next steps. Team Hariox. https://credit.hariox.com/my-account",
    varCount: 0,
  },
  document_pending: {
    templateId: "1707177005136919738",
    message: "Hello Sir/Mam, Please upload your incomplete document. Thanks & Regards, Hariox Corporate",
    varCount: 0,
  },
  payout_message: {
    templateId: "1707177005364583117",
    message: "Dear Customer, Payout is successfully credited to your account. Please check your portal! Thanks & Regards, Hariox Corporate",
    varCount: 0,
  },
};

const formatPhone = (p: string) => {
  const cleaned = (p || "").replace(/\D/g, "");
  return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
};

const sendSmsGreen = async (args: {
  apiKey: string;
  senderId: string;
  phone: string;
  message: string;
  templateId: string;
  variables?: string[];
}) => {
  const params = new URLSearchParams({
    username: GREENSMS_USERNAME,
    apikey: args.apiKey,
    apirequest: "Text",
    sender: args.senderId,
    mobile: args.phone,
    message: args.message,
    route: "TRANS",
    entityid: DLT_ENTITY_ID,
    templateid: args.templateId,
  });
  
  if (args.variables && args.variables.length > 0) {
    args.variables.forEach((v, idx) => {
      params.set(`var${idx + 1}`, v);
    });
    params.set("var", args.variables[0]);
    params.set("val", args.variables[0]);
  }
  
  const smsUrl = `https://login.greensms.in/sms-panel/api/http/sendsms.php?${params.toString()}`;
  const res = await fetch(smsUrl);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, json };
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { lead_id, sms_type, loan_amount, url } = body;

    if (!lead_id || !sms_type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: lead_id, sms_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes = Object.keys(TEMPLATES);
    if (!validTypes.includes(sms_type)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid sms_type. Must be one of: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let smsApiKey = (Deno.env.get("GREENSMS_API_KEY") || "").trim();
    if (smsApiKey.startsWith("http")) {
      try { smsApiKey = new URL(smsApiKey).searchParams.get("apikey") || smsApiKey; } catch {}
    }
    if (!smsApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "SMS API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: smsEnabledSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "sms_enabled")
      .maybeSingle();
    const smsEnabled = smsEnabledSetting?.value == null ? true : smsEnabledSetting.value === "true";

    if (!smsEnabled) {
      return new Response(
        JSON.stringify({ success: false, error: "SMS is disabled in system settings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("full_name, phone, loan_amount")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ success: false, error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = formatPhone(lead.phone);
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const template = TEMPLATES[sms_type as keyof typeof TEMPLATES];
    let message = template.message;
    let variables: string[] = [];

    if (template.varCount > 0) {
      const amount = loan_amount || lead.loan_amount || 0;
      const formattedAmount = String(amount).replace(/,/g, "");
      const marketingUrl = url || "https://credit.hariox.com/pay/marketing";
      
      if (template.varCount === 2) {
        variables = [formattedAmount, marketingUrl];
      } else {
        variables = [formattedAmount];
      }
      
      // Replace {#var#} placeholders
      variables.forEach((v) => {
        message = message.replace("{#var#}", v);
      });
    }

    const smsRes = await sendSmsGreen({
      apiKey: smsApiKey,
      senderId: GREENSMS_SENDER,
      phone,
      message,
      templateId: template.templateId,
      variables,
    });

    await supabase.from("activity_logs").insert({
      lead_id,
      action: `sms_${sms_type}_sent`,
      details: {
        ok: smsRes.ok,
        phone,
        sms_type,
        provider: "greensms",
        provider_response: smsRes.json,
      },
    });

    console.log(`send-status-sms:${sms_type}`, { lead_id, phone, ok: smsRes.ok });

    const providerStatus = String(smsRes.json?.status ?? smsRes.json?.Status ?? "").toLowerCase();
    const isSuccess = smsRes.ok && (
      providerStatus === "success" || 
      providerStatus === "ok" || 
      providerStatus === "sent" ||
      smsRes.json?.raw?.toLowerCase?.()?.includes("success") ||
      smsRes.json?.raw?.toLowerCase?.()?.includes("sent")
    );

    if (isSuccess) {
      return new Response(
        JSON.stringify({ success: true, message: `${sms_type} SMS sent successfully` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = String(smsRes.json?.message ?? smsRes.json?.raw ?? "Failed to send SMS");
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("send-status-sms:error", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
