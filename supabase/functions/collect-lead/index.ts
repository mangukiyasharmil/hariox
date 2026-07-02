import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Infer company slug from request hostname - ONLY for known hariox.com subdomains
// Custom franchise domains (like finance.fundkredit.com) must use custom_domain DB lookup first
const inferCompanySlugFromHostname = (hostname: string): string | null => {
  const host = hostname.toLowerCase();
  // Only match known hariox.com subdomains explicitly - never use startsWith("finance.") etc.
  if (host === "capital.hariox.com" || host.includes("capital.hariox") || host.includes("capital-hariox")) return "hariox";
  if (host === "finance.hariox.com" || host.includes("finance.hariox") || host.includes("finance-hariox")) return "hariox";
  if (host === "credit.hariox.com" || host.includes("credit.hariox") || host.includes("credit-hariox")) return "hariox";
  if (host.includes("finance.fundkredit") || host.includes("fundkredit")) return "hariox";
  if (host.includes("hariox")) return "hariox";
  return null;
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

const DLT_ENTITY_ID = "1701174159361029653";
const WELCOME_TEMPLATE_ID = "1707174297691624208";
// Template: "Your Rs.{#var#} Pre-Approved Loan is Confirm. Get Money Your Bank A/C 10 min. Complete Your Loan Process Apply :[Link]"

// GreenSMS configuration
const GREENSMS_USERNAME = "HarioxSMS";
const GREENSMS_SENDER = "FUNCER";

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
  });

  // Aliases
  params.set("senderid", args.senderId);
  params.set("number", args.phone);
  params.set("msg", args.message);

  // Variables
  if (args.variables?.length) {
    args.variables.forEach((v, idx) => params.set(`var${idx + 1}`, v));
    params.set("var", args.variables[0]);
    params.set("val", args.variables[0]);
  }

  // DLT params (aliases)
  params.set("entityid", DLT_ENTITY_ID);
  params.set("entityId", DLT_ENTITY_ID);
  params.set("entity_id", DLT_ENTITY_ID);
  params.set("dlt_entity_id", DLT_ENTITY_ID);

  params.set("templateid", args.templateId);
  params.set("templateId", args.templateId);
  params.set("template_id", args.templateId);
  params.set("tempid", args.templateId);
  params.set("dlt_template_id", args.templateId);

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

    // Validate required fields
    const requiredFields = ["full_name", "email", "phone", "city", "loan_type", "loan_amount", "employment_type", "monthly_income"];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Missing required fields: ${missingFields.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format (10 digits starting with 6-9)
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (!phoneRegex.test(body.phone)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate loan_type
    const validLoanTypes = ["home", "business", "personal", "education", "vehicle", "gold", "marriage"];
    if (!validLoanTypes.includes(body.loan_type)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid loan_type. Must be one of: ${validLoanTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate employment_type
    const validEmploymentTypes = ["salaried", "self_employed", "business_owner"];
    if (!validEmploymentTypes.includes(body.employment_type)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid employment_type. Must be one of: ${validEmploymentTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper to infer slug from source (e.g. "fundkredit-web" -> "hariox")
    const inferCompanySlugFromSource = (source?: string): string | null => {
      if (!source) return null;
      const lowerSource = source.toLowerCase();
      if (lowerSource.includes("fundkredit")) {
        return "hariox";
      }
      return null;
    };

    const isUuid = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    const resolveCompanyIdBySlug = async (slug: string): Promise<string | null> => {
      const normalized = slug.toLowerCase().trim().replace(/[\s_]+/g, "-");
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("slug", normalized)
        .eq("is_active", true)
        .maybeSingle();
      return company?.id ?? null;
    };

    // Get company_id from slug/UUID if provided, or infer from hostname or source
    let companyId = body.company_id ? String(body.company_id).trim() : null;

    // If companyId is passed but is not a valid UUID, check if it's a slug
    if (companyId && !isUuid(companyId)) {
      const resolved = await resolveCompanyIdBySlug(companyId);
      if (resolved) {
        companyId = resolved;
      } else {
        // It's not a valid UUID and not a valid slug; null it out so we can fall back to hostname/source
        companyId = null;
      }
    }

    // If still no company_id and body.company_slug is provided, try that
    if (!companyId && body.company_slug) {
      companyId = await resolveCompanyIdBySlug(String(body.company_slug).trim());
    }

    // If still no company_id, infer from request hostname
    if (!companyId) {
      const hostname = getHostnameFromRequest(req);
      if (hostname) {
        // Query active companies and match custom_domain programmatically in JS
        const { data: activeCompanies } = await supabase
          .from("companies")
          .select("id, custom_domain, slug")
          .eq("is_active", true);

        const hostnameLower = hostname.toLowerCase().trim();
        const matched = activeCompanies?.find(c => {
          if (!c.custom_domain) return false;
          const domainLower = c.custom_domain.toLowerCase().trim();
          const cleanDomain = domainLower.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
          const cleanHost = hostnameLower.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
          return cleanDomain === cleanHost || cleanDomain.includes(cleanHost) || cleanHost.includes(cleanDomain);
        });

        if (matched?.id) {
          companyId = matched.id;
        } else {
          // Try to infer from source first, then fallback to hostname
          const inferredSlug = inferCompanySlugFromSource(body.source) || inferCompanySlugFromHostname(hostname);
          if (inferredSlug) {
            companyId = await resolveCompanyIdBySlug(inferredSlug);
          }
        }
      } else {
        // If no hostname (e.g. backend to backend call), try to infer from source
        const inferredSlug = inferCompanySlugFromSource(body.source);
        if (inferredSlug) {
          companyId = await resolveCompanyIdBySlug(inferredSlug);
        }
      }
    }

    // Final fallback: first active company (prevents leads with NULL company_id)
    if (!companyId) {
      const { data: fallbackCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("is_active", true)
        .order("created_at")
        .limit(1)
        .maybeSingle();

      if (fallbackCompany?.id) companyId = fallbackCompany.id;
    }

    // Flexible field mapping to handle variations from external forms
    let rawCity = body.city || body.City || body.CITY || "";
    let rawState = body.state || body.State || body.STATE || "";
    const rawPincode = body.pincode || body.Pincode || body.PINCODE || "";
    const rawLoanType = (body.loan_type || body.loanType || body.LoanType || "personal").toLowerCase();
    const rawLoanAmount = body.loan_amount || body.loanAmount || body.LoanAmount || body.loan_amount_requested || 0;
    const rawMonthlyIncome = body.monthly_income || body.monthlyIncome || body.MonthlyIncome || body.income || 0;
    const rawEmi = body.current_monthly_emi || body.currentMonthlyEmi || body.CurrentMonthlyEmi || body.emi || 0;
    let rawCibil = body.cibil_score_range || body.cibilScoreRange || body.cibil_score || body.CibilScore || null;
    let rawEmployment = body.employment_type || body.employmentType || body.EmploymentType || "salaried";

    // Clean up City if it contains state (e.g. "Mumbai, Maharashtra" or "Mumbai. Maharashtra")
    if (typeof rawCity === 'string') {
      const separator = rawCity.includes(',') ? ',' : (rawCity.includes('.') ? '.' : null);
      if (separator) {
        const parts = rawCity.split(separator);
        rawCity = parts[0].trim();
        if (!rawState && parts.length > 1) {
          rawState = parts[1].trim();
        }
      }
    }

    // Extract embedded data from 'source' string if sent from website (e.g. "fundkredit-web;cibil=550-650;emi=0;status=pending")
    let rawSource = body.source || "api";
    if (typeof rawSource === 'string' && rawSource.includes(';')) {
      const parts = rawSource.split(';');
      parts.forEach(p => {
        const [k, v] = p.split('=').map(s => s.trim().toLowerCase());
        if (k === 'cibil' && !rawCibil) rawCibil = v;
        if (k === 'emi' && !rawEmi) rawEmi = v;
      });
    }

    // Normalize CIBIL to match frontend exact values
    if (typeof rawCibil === 'string') {
      const c = rawCibil.toLowerCase().trim();
      if (c.includes('750') && c.includes('plus')) rawCibil = '750+';
      else if (c === '750+') rawCibil = '750+';
      else if (c.includes('650') && c.includes('750')) rawCibil = '650-750';
      else if (c.includes('600') && c.includes('650')) rawCibil = '550-650'; // Mapping 600-650 to nearest
      else if (c.includes('550') && c.includes('600')) rawCibil = '550-650'; // Mapping 550-600 to nearest
      else if (c.includes('550') && c.includes('650')) rawCibil = '550-650';
      else if (c.includes('below') && c.includes('550')) rawCibil = 'below-550';
      else if (c.includes('no') && (c.includes('cibil') || c.includes('hariox'))) rawCibil = 'no-credit';
    }

    // Normalize employment type to match database enum
    if (typeof rawEmployment === 'string') {
      const emp = rawEmployment.toLowerCase();
      if (emp.includes('self')) rawEmployment = 'self_employed';
      else if (emp.includes('business')) rawEmployment = 'business_owner';
      else rawEmployment = 'salaried';
    }

    // Normalize source string
    let finalSource = "other";
    if (typeof rawSource === 'string') {
      const s = rawSource.toLowerCase();
      if (s.includes('web') || s.includes('api') || s.includes('fundkredit')) finalSource = "website";
      else if (s.includes('whatsapp') || s.includes('wa')) finalSource = "whatsapp";
      else if (s.includes('sms')) finalSource = "sms";
      else finalSource = "other";
    }

    // Prepare lead data
    const leadData = {
      full_name: body.full_name ? String(body.full_name).trim() : (body.fullName ? String(body.fullName).trim() : ""),
      email: body.email ? String(body.email).trim().toLowerCase() : "",
      phone: body.phone ? String(body.phone).trim() : "",
      city: String(rawCity).trim(),
      state: String(rawState).trim() || null,
      pincode: String(rawPincode).trim() || null,
      loan_type: rawLoanType,
      loan_amount: Number(rawLoanAmount) || 0,
      employment_type: rawEmployment,
      monthly_income: Number(rawMonthlyIncome) || 0,
      current_monthly_emi: Number(rawEmi) || 0,
      cibil_score_range: rawCibil,
      emi_bounce_last_6_months: body.emi_bounce_last_6_months || body.emiBounce || false,
      company_id: companyId,
      source: finalSource,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      status: "unpaid",
    };

    // Check for existing lead
    let existingLead = null;
    if (companyId) {
      const { data } = await supabase
        .from("leads")
        .select("id, status")
        .eq("phone", body.phone.trim())
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingLead = data;

      // No global fallback to other companies to keep companies completely separate by website
    } else {
      const { data } = await supabase
        .from("leads")
        .select("id, status")
        .eq("phone", body.phone.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingLead = data;
    }

    let lead;
    let error;

    if (existingLead) {
      // Update existing lead
      const { data: updateData, error: updateError } = await supabase
        .from("leads")
        .update({ ...leadData, updated_at: new Date().toISOString() })
        .eq("id", existingLead.id)
        .select("id, full_name, email, phone, status, created_at")
        .single();
      
      lead = updateData;
      error = updateError;
    } else {
      // Insert new lead
      const { data: insertData, error: insertError } = await supabase
        .from("leads")
        .insert(leadData)
        .select("id, full_name, email, phone, status, created_at")
        .single();
        
      lead = insertData;
      error = insertError;
    }

    if (error) {
      console.error("Error inserting lead:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create lead", details: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-assign lead to telecaller (round-robin based on least unpaid assignments)
    try {
      let telecallerIds: string[] = [];

      // First: try telecallers linked to this company
      if (companyId) {
        const { data: companyTelecallers } = await supabase
          .from("company_users")
          .select("user_id")
          .eq("company_id", companyId);

        if (companyTelecallers && companyTelecallers.length > 0) {
          const userIds = companyTelecallers.map((c) => c.user_id);
          const { data: telecallerRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "telecaller")
            .in("user_id", userIds);

          if (telecallerRoles && telecallerRoles.length > 0) {
            telecallerIds = telecallerRoles.map((t) => t.user_id);
          }
        }
      }

      // Fallback: any telecaller if none linked to company
      if (telecallerIds.length === 0) {
        const { data: allTelecallers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "telecaller");

        if (allTelecallers && allTelecallers.length > 0) {
          telecallerIds = allTelecallers.map((t) => t.user_id);
        }
      }

      if (telecallerIds.length > 0) {
        // Count current unpaid lead assignments for each telecaller
        const assignmentCounts = await Promise.all(
          telecallerIds.map(async (userId) => {
            const { count } = await supabase
              .from("leads")
              .select("*", { count: "exact", head: true })
              .eq("assigned_to", userId)
              .eq("status", "unpaid");
            return { user_id: userId, count: count || 0 };
          })
        );

        // Assign to telecaller with fewest leads (round-robin style)
        const minAssignments = Math.min(...assignmentCounts.map((a) => a.count));
        const telecallerId = assignmentCounts.find((a) => a.count === minAssignments)?.user_id;

        if (telecallerId) {
          await supabase
            .from("leads")
            .update({ assigned_to: telecallerId })
            .eq("id", lead.id);
          console.log(`Lead ${lead.id} auto-assigned to telecaller ${telecallerId}`);
        }
      } else {
        console.log(`No telecaller available to assign lead ${lead.id}`);
      }
    } catch (assignError) {
      console.error("Auto-assign error:", assignError);
      // Don't fail lead creation if assignment fails
    }

    // Log activity
    const logHostname = getHostnameFromRequest(req);
    await supabase.from("activity_logs").insert({
      lead_id: lead.id,
      action: existingLead ? "lead_updated_via_api" : "lead_created_via_api",
      details: {
        source: leadData.source,
        company_id: companyId,
        input_company_id: body.company_id || null,
        input_company_slug: body.company_slug || null,
        input_hostname: logHostname || null,
        headers: {
          origin: req.headers.get("origin") || null,
          referer: req.headers.get("referer") || null,
          host: req.headers.get("host") || null,
        }
      },
    });

    console.log("Lead created successfully:", lead.id);

    // Trigger workflow for new lead (best-effort, non-blocking)
    try {
      const workflowResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            trigger_type: "lead_created",
            lead_id: lead.id,
            company_id: companyId,
          }),
        }
      );
      const wfResult = await workflowResponse.json();
      console.log("Workflow trigger result:", wfResult);

      // Also trigger form_filled workflow
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            trigger_type: "form_filled",
            lead_id: lead.id,
            company_id: companyId,
          }),
        }
      );
    } catch (wfError) {
      console.error("Workflow trigger error (non-blocking):", wfError);
    }

    // Start remarketing SMS cycle (best-effort; never block lead creation)
    try {
      const { data: rmSetting } = await supabase.from("system_settings").select("value").eq("key", "remarketing_sms_new_cycles_enabled").maybeSingle();
      if (rmSetting?.value !== "false") {
        await supabase.from("remarketing_cycles").upsert({
          lead_id: lead.id,
          company_id: companyId,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
          status: "active",
          sms_sent_count: 0,
        }, { onConflict: "lead_id", ignoreDuplicates: true });
        console.log(`[collect-lead] Remarketing cycle started for lead ${lead.id}`);
      } else {
        console.log(`[collect-lead] Remarketing new cycles disabled, skipping for ${lead.id}`);
      }
    } catch (remarkErr) {
      console.error("[collect-lead] Remarketing cycle error:", remarkErr);
    }

    // Send Welcome SMS (best-effort; never block lead creation)
    try {
      let smsApiKey = (Deno.env.get("GREENSMS_API_KEY") || "").trim();
      if (smsApiKey.startsWith("http")) {
        try { smsApiKey = new URL(smsApiKey).searchParams.get("apikey") || smsApiKey; } catch {}
      }
      if (smsApiKey) {
        const { data: smsEnabledSetting } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "sms_enabled")
          .maybeSingle();
        const smsEnabled = smsEnabledSetting?.value == null ? true : smsEnabledSetting.value === "true";

        if (smsEnabled) {
          const phone = formatPhone(leadData.phone);
          if (phone) {
            // Template: "Your Rs.{#var#} Pre-Approved Loan is Confirm. Get Money Your Bank A/C 10 min. Complete Your Loan Process Apply :[Link]"
            const loanAmount = String(Number(leadData.loan_amount || 0)).replace(/,/g, "");
            // IMPORTANT: DLT message must match EXACT template text; pass variables separately.
            const message =
              "Your Rs.{#var#} Pre-Approved Loan is Confirm. Get Money Your Bank A/C 10 min. Complete Your Loan Process Apply https://credit.hariox.com/pay/marketing";

            const smsRes = await sendSmsGreen({
              apiKey: smsApiKey,
              senderId: GREENSMS_SENDER,
              phone,
              message,
              templateId: WELCOME_TEMPLATE_ID,
              variables: [loanAmount],
            });

            await supabase.from("activity_logs").insert({
              lead_id: lead.id,
              action: "sms_welcome_sent",
              details: {
                ok: smsRes.ok,
                phone,
                provider: "greensms",
                provider_response: smsRes.json,
              },
            });

            console.log("collect-lead:welcome_sms", { ok: smsRes.ok, phone, provider: "greensms" });
          }
        }
      }
    } catch (smsErr) {
      console.error("collect-lead:welcome_sms_error", smsErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead created successfully",
        data: {
          lead_id: lead.id,
          full_name: lead.full_name,
          status: lead.status,
          created_at: lead.created_at,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
