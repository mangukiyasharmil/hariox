import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (req: Request) => {
  const requestedHeaders = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      requestedHeaders ||
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
};

// All DLT-approved template types from Excel (Feb 2026)
type SMSType =
  // Status/Transaction SMS
  | "payment_success"
  | "another_bank"
  | "career_message"
  | "document_pending"
  | "payment_failed"
  | "payout_message"
  | "rejected"
  | "website_maintenance"
  | "file_canceled"
  // Marketing SMS with fixed URLs
  | "hariox_sales"
  // Marketing SMS with dynamic URLs (2 variables: amount, url)
  | "pre_approved_loan"
  // Legacy types for backward compatibility
  | "account_sms"
  | "offline_greeting"
  | "check_loan_status"
  | "forget_password"
  | "request_canceled"
  | "welcome"
  | "marketing"
  | "payment"
  | "status_update"
  | "telecaller"
  | "custom";

interface SMSRequest {
  phone: string | string[];
  message?: string;
  type: SMSType;
  templateId?: string;
  leadId?: string;
  company_id?: string; // NEW: for per-franchise SMS credentials
  variables?: Record<string, string | number | boolean | null | undefined>;
}

// GreenSMS API configuration
const GREENSMS_USERNAME = "HarioxSMS";
const GREENSMS_SENDER = "FUNCER";
const DLT_ENTITY_ID = "1701174159361029653";

type GreenSmsRoute = "TRANS";
const GREENSMS_ROUTE: GreenSmsRoute = "TRANS";

// =====================================================
// DLT-APPROVED TEMPLATES (from Feb 2026 Excel export)
// CRITICAL: Messages must match DLT registry character-for-character
// =====================================================
const DLT_TEMPLATES: Record<string, { message: string; templateId: string; varCount: number }> = {
  // =====================================================
  // UPDATED Feb 3, 2026 from new Excel export
  // =====================================================

  // ===== STATUS/TRANSACTION SMS (0 or 1 variable) =====
  
  payment_success: {
    message: "Dear Customer, congratulations! Your loan application is approved. Our executive will contact you shortly for next steps. Team Hariox.",
    templateId: "1707177046090359201",
    varCount: 0,
  },
  another_bank: {
    message: "It may take 15 to 20 days for your bank to process the transaction at another bank due to low transaction volume. Thanks Hariox Corporate",
    templateId: "1707177005090686508",
    varCount: 0,
  },
  career_message: {
    message: "Thank you for showing interest with us. Our HR team will get call back soon. Have a nice day! Thanks & Regards, Hariox Corporate",
    templateId: "1707177005115227559",
    varCount: 0,
  },
  document_pending: {
    message: "Hello Sir/Mam, Please upload your incomplete document. Thanks & Regards, Hariox Corporate",
    templateId: "1707177005136919738",
    varCount: 0,
  },
  payment_failed: {
    message: "Sorry, your payment for HARIOX Corporate Membership was not successful. We request you to try another payment method {#var#} Hariox Corporate",
    templateId: "1707177005285030757",
    varCount: 1,
  },
  payout_message: {
    message: "Dear Customer, Payout is successfully credited to your account. Please check your portal! Thanks & Regards, Hariox Corporate",
    templateId: "1707177005364583117",
    varCount: 0,
  },
  rejected: {
    message: "Dear Customer, we regret to inform you that your loan request could not be processed at this time due to eligibility criteria. Team Hariox.",
    templateId: "1707177005392409980",
    varCount: 0,
  },
  website_maintenance: {
    message: "Dear Customer, Hariox website is under maintenance. Please try again later. For support, contact our team. Thank you.",
    templateId: "1707177005471065545",
    varCount: 0,
  },
  file_canceled: {
    message: "If your file has been canceled due to the low civil score of your profile, please correct it and give it after {#var#} months. Hariox Corporate",
    templateId: "1707177005482506432",
    varCount: 1,
  },

  // ===== TELECALLER SMS with FIXED URLS (1 variable: amount) =====
  // NEW TEMPLATE IDs from Feb 3, 2026 Excel
  
  hariox_sales: {
    message: "Congrats! Your order of ${#var#} has been confirmed. Complete your onboarding now: https://hariox.com/apply . HARIOX",
    templateId: "1707177011004379215",
    varCount: 1,
  },

  remarketing_hariox: {
    message: "Your Hariox order is waiting! Complete your $129 onboarding and activate your account now: https://hariox.com/apply . HARIOX",
    templateId: "1707177133076035580",
    varCount: 0,
  },

  // ===== MARKETING SMS with DYNAMIC URLS (2 variables: amount, url) =====
  
  pre_approved_loan: {
    message: "Your Rs.{#var#} Pre-Approved Loan is Confirm. Get Money Your Bank A/C 10 min. Complete Your Loan Process Apply {#var#}.HARIOX",
    templateId: "1707176993212722710",
    varCount: 2,
  },
  bl_remarketing: {
    message: "Your Rs.{#var#} Pre-Approved Loan is Confirm. Get Money Your Bank A/C 10 min. Complete Your Loan Process Apply {#var#}.HARIOX",
    templateId: "1707176993230405646",
    varCount: 2,
  },
  congrats_pre_approval: {
    message: "Congrats! Your loan Pre- Approval Rs.{#var#} -Instant Personal Loan in 5 min* -No Cibil Required GetOffer{#var#}.HARIOX",
    templateId: "1707176993242740274",
    varCount: 2,
  },
  pl_remarketing: {
    message: "Your Loan Offer Rs.{#var#} is Successfully Pre-Approved. Get Disbursal in Your Bank A/C Just 10 Mins. Apply {#var#}.HARIOX",
    templateId: "1707176993258421766",
    varCount: 2,
  },

  // ===== LEGACY TEMPLATES (for backward compatibility) =====
  
  account_sms: {
    message: "Dear Customer, congratulations! Your loan application is approved. Our executive will contact you shortly for next steps. Team Hariox.",
    templateId: "1707177046090359201",
    varCount: 0,
  },
  offline_greeting: {
    message: "Dear Customer, congratulations! Your loan application is approved. Our executive will contact you shortly for next steps. Team Hariox.",
    templateId: "1707177046090359201",
    varCount: 0,
  },
  check_loan_status: {
    message: "Dear Customer, Payout is successfully credited to your account. Please check your portal! Thanks & Regards, Hariox Corporate",
    templateId: "1707177005364583117",
    varCount: 0,
  },
  forget_password: {
    message: "Dear Customer, Hariox website is under maintenance. Please try again later. For support, contact our team. Thank you.",
    templateId: "1707177005471065545",
    varCount: 0,
  },
  request_canceled: {
    message: "If your file has been canceled due to the low civil score of your profile, please correct it and give it after {#var#} months. Hariox Corporate",
    templateId: "1707177005482506432",
    varCount: 1,
  },
};

// Legacy type mappings (map old types to new templates)
const LEGACY_TYPE_MAP: Record<string, string> = {
  welcome: "payment_success",
  marketing: "remarketing_credit",
  remarketing_fl: "pre_approved_loan", // Old template removed, map to dynamic URL version
  payment: "payment_success",
  status_update: "rejected",
  telecaller: "telecaller_credit",
};

// DLT URL setting keys mapping
const DLT_URL_KEYS = {
  telecaller: {
    credit: "sms_url_credit_telecaller",
    finance: "sms_url_finance_telecaller",
    capital: "sms_url_capital_telecaller",
  },
  marketing: {
    credit: "sms_url_credit_marketing",
    finance: "sms_url_finance_marketing",
    capital: "sms_url_capital_marketing",
  },
};

// Default fallback URLs
const DEFAULT_URLS = {
  credit_telecaller: "https://credit.hariox.com/pay/telecaller",
  credit_marketing: "https://credit.hariox.com/pay/marketing",
  finance_telecaller: "https://finance.hariox.com/pay/telecaller",
  finance_marketing: "https://finance.hariox.com/pay/marketing",
  capital_telecaller: "https://capital.hariox.com/pay/telecaller",
  capital_marketing: "https://capital.hariox.com/pay/marketing",
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
  const corsHeaders = getCorsHeaders(req);
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
      try { defaultApiKey = new URL(defaultApiKey).searchParams.get("apikey") || defaultApiKey; } catch {}
    }
    if (!defaultApiKey) {
      throw new Error("GREENSMS_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const formatPhone = (p: string) => {
      const cleaned = (p || "").replace(/\D/g, "");
      return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
    };

    const getSetting = async (key: string): Promise<string | null> => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      return data?.value ?? null;
    };

    // Auth check
    const authHeader = req.headers.get("authorization") || "";
    let token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;

    // Check if token is the anon/publishable key (treat as unauthenticated)
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    // Also check apikey header which Supabase JS sends separately
    const apikeyHeader = req.headers.get("apikey") || "";
    // Only treat as anon if it matches anon/publishable keys — NOT service_role_key
    const isAnonKey = token === anonKey || token === publishableKey;
    const isApikeyAnon = apikeyHeader && (apikeyHeader === anonKey || apikeyHeader === publishableKey);
    if (token && (isAnonKey || (isApikeyAnon && token !== serviceRoleKey))) {
      console.log("send-sms: anon/publishable key detected, treating as unauthenticated");
      token = null;
    }
    // If token looks like a service key or anon key, handle accordingly
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role === "anon") {
          console.log("send-sms: anon role JWT detected, treating as unauthenticated");
          token = null;
        } else if (payload.role === "service_role") {
          // Service role key = trusted server-to-server call, skip user auth
          console.log("send-sms: service_role detected, skipping user auth");
          // Keep token set so it passes the !token check below (treated as authenticated)
        }
      } catch {
        // Not a valid JWT, will fail auth check below
      }
    }

    const body: SMSRequest = await req.json();
    let { type, phone, message, leadId, variables } = body;
    const requestCompanyId = body.company_id || null;

    // Resolve company_id: use explicit company_id or derive from lead
    let effectiveCompanyId = requestCompanyId;

    if (!effectiveCompanyId && leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("company_id")
        .eq("id", leadId)
        .maybeSingle();
      if (lead?.company_id) {
        effectiveCompanyId = lead.company_id;
      }
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Permission checks
    if (!token) {
      // Allow welcome / post-submit remarketing SMS without auth (lead submission flow).
      // These all require a valid leadId (validated below) and use approved DLT templates.
      const allowedUnauthTypes = [
        "welcome",
        "account_sms",
        "payment_success",
        "remarketing_credit",
        "remarketing_finance",
        "remarketing_capital",
      ];
      if (!allowedUnauthTypes.includes(type)) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!leadId) {
        return new Response(
          JSON.stringify({ success: false, error: "leadId is required for unauthenticated SMS" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Check if service_role key (trusted server-to-server)
      let isServiceRole = false;
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        isServiceRole = payload.role === "service_role";
      } catch {}

      if (!isServiceRole) {
        // Validate logged-in user is staff
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey);
        const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userRes?.user) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userRes.user.id });
        if (!isStaff) {
          return new Response(
            JSON.stringify({ success: false, error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Global enable switch
    const smsEnabledSetting = await getSetting("sms_enabled");
    const smsEnabled = smsEnabledSetting == null ? true : smsEnabledSetting === "true";
    if (!smsEnabled) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "sms_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Per-franchise credentials will be resolved after we know effectiveCompanyId
    // (placeholder — actual resolution happens after template/lead processing below)

    const phoneNumbers = Array.isArray(phone)
      ? phone.map(formatPhone).filter(Boolean).join(",")
      : formatPhone(phone);

    if (!phoneNumbers) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If unauthenticated, enforce phone matches lead
    if (!token && leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("phone, created_at")
        .eq("id", leadId)
        .maybeSingle();

      const leadPhone = formatPhone(lead?.phone || "");
      if (!lead || leadPhone !== phoneNumbers) {
        return new Response(
          JSON.stringify({ success: false, error: "Phone does not match lead" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Only allow welcome SMS within 10 minutes of lead creation
      const createdAt = lead.created_at ? Date.parse(lead.created_at) : 0;
      if (!createdAt || Date.now() - createdAt > 10 * 60 * 1000) {
        return new Response(
          JSON.stringify({ success: false, error: "Welcome SMS window expired" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Map legacy types to new types
    let resolvedType = LEGACY_TYPE_MAP[type] || type;

    // Single brand: all lead types resolve to hariox_sales or remarketing_hariox
    if (
      resolvedType === "telecaller_credit" ||
      resolvedType === "telecaller_finance" ||
      resolvedType === "telecaller_capital" ||
      resolvedType === "telecaller"
    ) {
      resolvedType = "hariox_sales";
    } else if (
      resolvedType === "remarketing_credit" ||
      resolvedType === "remarketing_finance" ||
      resolvedType === "remarketing_capital" ||
      resolvedType === "marketing" ||
      resolvedType === "pre_approved_loan" ||
      resolvedType === "bl_remarketing" ||
      resolvedType === "congrats_pre_approval" ||
      resolvedType === "pl_remarketing"
    ) {
      resolvedType = "remarketing_hariox";
    }

    // To prevent DLT content mismatches, disallow truly custom SMS (non-approved templates).
    if (resolvedType === "custom" && !body.templateId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Custom SMS is disabled. Please select an approved template.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get template
    const template = DLT_TEMPLATES[resolvedType];
    
    if (!template && type !== "custom") {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown template type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalMessage = message?.trim() || "";
    let templateId = body.templateId || "";
    let variableValues: string[] = [];

    if (template) {
      // Start with the DLT template message
      finalMessage = template.message;
      templateId = template.templateId;

      // Collect variable values for templates that need them
      if (template.varCount > 0) {
        let primaryVarValue = "";
        let companySlug = "hariox"; // Default company
        
        // Get loan amount and company from lead if available
        if (leadId) {
          const { data: lead } = await supabase
            .from("leads")
            .select("loan_amount, company_id")
            .eq("id", leadId)
            .maybeSingle();
          if (lead) {
            primaryVarValue = String(lead.loan_amount ?? "").replace(/,/g, "");

            // Derive effectiveCompanyId from lead if not explicitly provided
            if (lead.company_id && !effectiveCompanyId) {
              effectiveCompanyId = lead.company_id;
            }
            
            // Get company slug for URL selection
            if (lead.company_id) {
              const { data: company } = await supabase
                .from("companies")
                .select("slug")
                .eq("id", lead.company_id)
                .maybeSingle();
              if (company?.slug) {
                companySlug = company.slug === "hariox" ? "hariox" : company.slug;
              }
            }
          }
        }
        
        // Override with explicit variables
        if (variables?.val != null) {
          primaryVarValue = String(variables.val).replace(/,/g, "");
        } else if (variables?.var != null) {
          primaryVarValue = String(variables.var).replace(/,/g, "");
        } else if (variables?.var1 != null) {
          primaryVarValue = String(variables.var1).replace(/,/g, "");
        }

        // Fallback value for variables to prevent empty string substitution causing double spaces (DLT silent drop)
        if (!primaryVarValue || primaryVarValue.trim() === "") {
          if (resolvedType === "file_canceled") {
            primaryVarValue = "6";
          } else if (resolvedType === "payment_failed") {
            primaryVarValue = "soon";
          } else {
            primaryVarValue = "50000";
          }
        }

        // For 2-variable templates (marketing SMS), fetch URL from system_settings
        if (template.varCount === 2) {
          let amount = variables?.var1 != null ? String(variables.var1) : primaryVarValue;
          if (!amount || amount.trim() === "") {
            amount = primaryVarValue || "50000";
          }
          
          // Fetch DLT-whitelisted URL from system_settings
          let url = variables?.var2 != null ? String(variables.var2) : (variables?.url != null ? String(variables.url) : null);
          
          if (!url) {
            // Determine URL type (marketing for dynamic URL templates)
            const urlKey = DLT_URL_KEYS.marketing[companySlug as keyof typeof DLT_URL_KEYS.marketing];
            const dbUrl = urlKey ? await getSetting(urlKey) : null;
            url = dbUrl || DEFAULT_URLS[`${companySlug}_marketing` as keyof typeof DEFAULT_URLS] || DEFAULT_URLS.credit_marketing;
          }
          
          variableValues = [amount, url];
        } else {
          // Single variable templates
          for (let i = 0; i < template.varCount; i++) {
            const varKey = `var${i + 1}`;
            let val = "";
            if (variables?.[varKey] != null) {
              val = String(variables[varKey]).replace(/,/g, "");
            } else {
              val = primaryVarValue;
            }
            if (!val || val.trim() === "") {
              if (resolvedType === "file_canceled") {
                val = "6";
              } else if (resolvedType === "payment_failed") {
                val = "soon";
              } else {
                val = "50000";
              }
            }
            variableValues.push(val);
          }
        }

        // IMPORTANT: Substitute {#var#} placeholders with actual values BEFORE sending
        variableValues.forEach((v) => {
          finalMessage = finalMessage.replace("{#var#}", v);
        });
      }
    }

    if (!finalMessage) {
      return new Response(
        JSON.stringify({ success: false, error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve per-franchise credentials (falls back to global if no franchise config)
    const {
      apiKey,
      username: resolvedUsername,
      sender: rawSenderId,
      entityId: resolvedEntityId,
      templateIds: franchiseTemplateIds
    } = await resolveSmsCredentials(
      supabase,
      effectiveCompanyId,
      defaultApiKey,
      ((await getSetting("sms_sender_id")) || "").trim() || GREENSMS_SENDER,
      DLT_ENTITY_ID
    );

    // Hard-guard: GreenSMS rejects empty/invalid sender IDs
    const senderId = (rawSenderId || "").trim() || GREENSMS_SENDER;

    // Override templateId with franchise-specific one if available
    if (franchiseTemplateIds) {
      if (resolvedType && franchiseTemplateIds[resolvedType]) {
        templateId = franchiseTemplateIds[resolvedType];
      } else if (
        (resolvedType === "remarketing_credit" || 
         resolvedType === "remarketing_finance" || 
         resolvedType === "remarketing_capital" ||
         resolvedType === "marketing") && 
        franchiseTemplateIds["remarketing"]
      ) {
        templateId = franchiseTemplateIds["remarketing"];
      } else if (
        (resolvedType === "payment_success" || 
         resolvedType === "welcome" ||
         resolvedType === "account_sms") && 
        franchiseTemplateIds["welcome"]
      ) {
        templateId = franchiseTemplateIds["welcome"];
      } else if (
        (resolvedType === "telecaller_credit" || 
         resolvedType === "telecaller_finance" || 
         resolvedType === "telecaller_capital" ||
         resolvedType === "telecaller") && 
        franchiseTemplateIds["telecaller"]
      ) {
        templateId = franchiseTemplateIds["telecaller"];
      }
    }

    const route = GREENSMS_ROUTE;

    const addDltParams = (params: URLSearchParams, tId: string) => {
      params.set("entityid", DLT_ENTITY_ID);
      params.set("entityId", DLT_ENTITY_ID);
      params.set("entity_id", DLT_ENTITY_ID);
      params.set("dlt_entity_id", DLT_ENTITY_ID);
      params.set("templateid", tId);
      params.set("templateId", tId);
      params.set("template_id", tId);
      params.set("tempid", tId);
      params.set("dlt_template_id", tId);
    };

    const buildGreenSmsUrl = () => {
      const params = new URLSearchParams({
        username: resolvedUsername,
        apikey: apiKey,
        apirequest: "Text",
        sender: senderId,
        mobile: phoneNumbers,
        message: finalMessage,
        route,
      });

      params.set("senderid", senderId);
      params.set("number", phoneNumbers);
      params.set("msg", finalMessage);

      if (variableValues.length > 0) {
        variableValues.forEach((v, idx) => {
          params.set(`var${idx + 1}`, v);
        });
        params.set("var", variableValues[0]);
        params.set("val", variableValues[0]);
      }

      if (templateId) {
        const dltParams = new URLSearchParams();
        dltParams.set("entityid", resolvedEntityId);
        dltParams.set("entityId", resolvedEntityId);
        dltParams.set("EntityID", resolvedEntityId);
        dltParams.set("entity_id", resolvedEntityId);
        dltParams.set("dlt_entity_id", resolvedEntityId);
        dltParams.set("templateid", templateId);
        dltParams.set("templateId", templateId);
        dltParams.set("TemplateID", templateId);
        dltParams.set("template_id", templateId);
        dltParams.set("tempid", templateId);
        dltParams.set("dlt_template_id", templateId);
        dltParams.forEach((v, k) => params.set(k, v));
      }

      return `https://login.greensms.in/sms-panel/api/http/index.php?${params.toString()}`;
    };

    const smsUrl = buildGreenSmsUrl();

    console.log("send-sms:request", {
      phone: phoneNumbers,
      type: resolvedType,
      leadId,
      templateId,
      messagePreview: finalMessage.substring(0, 100),
    });

    const response = await fetch(smsUrl);
    const text = await response.text();
    let result: any = null;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    const providerStatus = String(result?.status ?? result?.Status ?? result?.STATUS ?? "").toLowerCase();
    const rawText = String(result?.raw ?? "").toLowerCase();
    const providerMessage = String(result?.message ?? result?.Message ?? result?.raw ?? "Failed to send SMS");

    const isSuccess =
      response.ok &&
      (providerStatus === "success" ||
        providerStatus === "ok" ||
        providerStatus === "sent" ||
        rawText.includes("success") ||
        rawText.includes("sent"));

    console.log("send-sms:response", { ok: response.ok, providerStatus, isSuccess, result });

    // Log to sms_logs table
    await supabase.from("sms_logs").insert({
      phone: phoneNumbers,
      sms_type: resolvedType,
      message: finalMessage,
      status: isSuccess ? "sent" : "failed",
      cost_credits: isSuccess ? 0.11 : 0,
      sent_at: isSuccess ? new Date().toISOString() : null,
      error_message: isSuccess ? null : providerMessage,
      provider: "greensms",
      template_id: templateId || null,
      lead_id: leadId || null,
      company_id: effectiveCompanyId || null,
      provider_response: result,
    });

    // Log to activity_logs if lead
    if (leadId) {
      await supabase.from("activity_logs").insert({
        lead_id: leadId,
        action: `sms_sent_${resolvedType}`,
        details: {
          phone: phoneNumbers,
          message_preview: finalMessage.substring(0, 80),
          templateId,
        },
      });
    }

    if (isSuccess) {
      return new Response(
        JSON.stringify({ success: true, message: "SMS sent successfully", data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: providerMessage, data: result }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("send-sms:error", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
