import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Infer company slug from request hostname - always return hariox for single brand
const inferCompanySlugFromHostname = (hostname: string): string | null => {
  return "hariox";
};

// Fallback for preview domains - always return hariox
const inferCompanySlugFromSource = (source: unknown): string | null => {
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

    let parsedSource = body.source || "website";
    let parsedCibil = body.cibil_score_range || body.cibil_score || null;
    let parsedEmi = body.emi_amount ? Number(body.emi_amount) : null;
    
    if (typeof parsedSource === 'string' && parsedSource.includes(";")) {
      const parts = parsedSource.split(";");
      parsedSource = parts[0];
      for (const part of parts.slice(1)) {
        if (part.startsWith("cibil=")) parsedCibil = part.replace("cibil=", "");
        if (part.startsWith("emi=")) parsedEmi = Number(part.replace("emi=", ""));
      }
    }

    let parsedCity = body.city ? String(body.city).trim() : null;
    if (parsedCity && parsedCity.includes(",")) {
      parsedCity = parsedCity.split(",")[0].trim();
    }

    // Validate phone (required for all operations)
    const phoneRegex = /^[6-9][0-9]{9}$/;
    const cleanPhone = String(body.phone || "").replace(/\D/g, "").slice(-10);
    
    if (!phoneRegex.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve company_id
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
          const inferredSlug = inferCompanySlugFromHostname(hostname);
          if (inferredSlug) {
            companyId = await resolveCompanyIdBySlug(inferredSlug);
          }
        }
      }
    }

    // Preview fallback: infer by source (e.g. website-capital-otp)
    if (!companyId) {
      const inferredSlugFromSource = inferCompanySlugFromSource(parsedSource);
      if (inferredSlugFromSource) {
        companyId = await resolveCompanyIdBySlug(inferredSlugFromSource);
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

    // Check for existing lead by phone AND company (each company treats leads independently)
    let existingLead = null;
    let fetchError = null;

    if (companyId) {
      // Look for lead with same phone in the SAME company only
      const result = await supabase
        .from("leads")
        .select("id, full_name, email, status, company_id")
        .eq("phone", cleanPhone)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      existingLead = result.data;
      fetchError = result.error;

      // No global fallback to other companies to keep companies completely separate by website
    } else {
      // Fallback: no company context, check globally (legacy behavior)
      const result = await supabase
        .from("leads")
        .select("id, full_name, email, status, company_id")
        .eq("phone", cleanPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      existingLead = result.data;
      fetchError = result.error;
    }

    if (fetchError) {
      console.error("upsert-lead: fetch error", fetchError);
    }

    // If this is a draft creation (phone-only from OTP step)
    if (body.is_draft === true) {
      if (existingLead) {
        // Build update payload for existing draft leads
        const draftUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
        
        // Backfill company_id if missing
        if (companyId && !existingLead.company_id) {
          draftUpdate.company_id = companyId;
        }

        // ALWAYS update UTM params if provided — ensures latest campaign attribution
        if (body.utm_source) draftUpdate.utm_source = body.utm_source;
        if (body.utm_medium) draftUpdate.utm_medium = body.utm_medium;
        if (body.utm_campaign) draftUpdate.utm_campaign = body.utm_campaign;

        if (Object.keys(draftUpdate).length > 1) { // more than just updated_at
          await supabase
            .from("leads")
            .update(draftUpdate)
            .eq("id", existingLead.id);
          console.log("upsert-lead: Draft - updated existing lead with UTM/company", existingLead.id, draftUpdate);
        }

        // Lead already exists, return existing ID
        console.log("upsert-lead: Draft - returning existing lead", existingLead.id);
        return new Response(
          JSON.stringify({ success: true, lead_id: existingLead.id, action: "existing" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create draft lead with minimal data (empty fields where possible)
      const leadId = crypto.randomUUID();
      const { error: insertError } = await supabase.from("leads").insert({
        id: leadId,
        phone: cleanPhone,
        full_name: "", // Empty - will be filled later
        email: "", // Empty - will be filled later
        city: "", // Empty - will be filled later
        loan_type: "personal", // Default
        loan_amount: 0, // Zero - will be filled later
        employment_type: "salaried", // Default
        monthly_income: 0, // Zero - will be filled later
        status: "unpaid",
        source: body.source || parsedSource || "website-otp",
        company_id: companyId,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
      });

      if (insertError) {
        console.error("upsert-lead: draft insert error", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create draft lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("upsert-lead: Draft lead created", leadId);

      // Log activity
      try {
        const hostname = getHostnameFromRequest(req);
        await supabase.from("activity_logs").insert({
          lead_id: leadId,
          action: "lead_created_via_api",
          details: {
            source: body.source || parsedSource || "website-otp",
            company_id: companyId,
            is_draft: true,
            input_company_id: body.company_id || null,
            input_company_slug: body.company_slug || null,
            input_hostname: hostname || null,
            headers: {
              origin: req.headers.get("origin") || null,
              referer: req.headers.get("referer") || null,
              host: req.headers.get("host") || null,
            }
          },
        });
      } catch (logErr) {
        console.error("upsert-lead: Draft logging error:", logErr);
      }

      // Trigger lead_created workflow for draft leads so WhatsApp templates are sent immediately
      try {
        const wfHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        };
        const wfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`;
        await fetch(wfUrl, {
          method: "POST",
          headers: wfHeaders,
          body: JSON.stringify({
            trigger_type: "lead_created",
            lead_id: leadId,
            company_id: companyId,
          }),
        });
        console.log("upsert-lead: Triggered lead_created workflow for draft lead", leadId);
      } catch (wfErr) {
        console.error("upsert-lead: Draft workflow trigger error:", wfErr);
      }

      return new Response(
        JSON.stringify({ success: true, lead_id: leadId, action: "created_draft", debug_company_id: companyId, debug_parsed_source: parsedSource }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Full form submission - validate required fields
    const requiredFields = ["full_name", "email", "loan_type", "loan_amount", "employment_type", "monthly_income", "city"];
    const missingFields = requiredFields.filter(field => body[field] === undefined || body[field] === null || body[field] === "");
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Missing required fields: ${missingFields.join(", ")}` }),
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
        JSON.stringify({ success: false, error: `Invalid loan_type` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate employment_type
    const validEmploymentTypes = ["salaried", "self_employed", "business_owner"];
    if (!validEmploymentTypes.includes(body.employment_type)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid employment_type` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadData: Record<string, any> = {
      full_name: String(body.full_name).trim(),
      email: String(body.email).trim().toLowerCase(),
      city: parsedCity,
      state: body.state?.trim() || null,
      pincode: body.pincode?.trim() || null,
      loan_type: body.loan_type,
      loan_amount: Number(body.loan_amount),
      employment_type: body.employment_type,
      monthly_income: Number(body.monthly_income),
      current_monthly_emi: body.current_monthly_emi ? Number(body.current_monthly_emi) : 0,
      cibil_score_range: parsedCibil,
      emi_bounce_last_6_months: body.emi_bounce_last_6_months || false,
      emi_amount: parsedEmi,
      interest_rate: body.interest_rate ? Number(body.interest_rate) : 10,
      tenure_months: body.tenure_months ? Number(body.tenure_months) : 36,
      updated_at: new Date().toISOString(),
    };

    // Merge UTM params (only overwrite if provided and non-null)
    if (body.utm_source) leadData.utm_source = body.utm_source;
    if (body.utm_medium) leadData.utm_medium = body.utm_medium;
    if (body.utm_campaign) leadData.utm_campaign = body.utm_campaign;

    // Store Meta fbc/fbp cookies for server-side CAPI attribution
    if (body.meta_fbc) leadData.meta_fbc = body.meta_fbc;
    if (body.meta_fbp) leadData.meta_fbp = body.meta_fbp;

    if (existingLead) {
      // UPDATE existing lead
      const updatePayload = {
        ...leadData,
        company_id: companyId || existingLead.company_id || null
      };

      const { error: updateError } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", existingLead.id);

      if (updateError) {
        console.error("upsert-lead: update error", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fire-and-forget: remarketing + workflows (don't block response)
      const effectiveCompanyId = companyId || existingLead.company_id;

      supabase.from("system_settings").select("value").eq("key", "remarketing_sms_new_cycles_enabled").maybeSingle()
        .then(({ data: rmSetting }) => {
          if (rmSetting?.value !== "false") {
            supabase.from("remarketing_cycles").upsert({
              lead_id: existingLead.id,
              company_id: effectiveCompanyId,
              start_date: new Date().toISOString(),
              end_date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
              status: "active",
              sms_sent_count: 0,
            }, { onConflict: "lead_id", ignoreDuplicates: true })
              .then(() => console.log("upsert-lead: Remarketing cycle ensured for lead", existingLead.id))
              .catch((e: any) => console.error("upsert-lead: Remarketing cycle error:", e));
          }
        }).catch((e: any) => console.error("upsert-lead: Remarketing settings error:", e));

      const wfHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      };
      const wfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`;
      fetch(wfUrl, {
        method: "POST",
        headers: wfHeaders,
        body: JSON.stringify({ trigger_type: "lead_created", lead_id: existingLead.id, company_id: effectiveCompanyId }),
      }).catch((e: any) => console.error("upsert-lead: lead_created workflow error:", e));
      fetch(wfUrl, {
        method: "POST",
        headers: wfHeaders,
        body: JSON.stringify({ trigger_type: "form_filled", lead_id: existingLead.id, company_id: effectiveCompanyId }),
      }).catch((e: any) => console.error("upsert-lead: form_filled workflow error:", e));

      console.log("upsert-lead: Lead updated (workflows fired async)", existingLead.id);

      // Log activity
      try {
        const hostname = getHostnameFromRequest(req);
        await supabase.from("activity_logs").insert({
          lead_id: existingLead.id,
          action: "lead_updated_via_api",
          details: {
            source: parsedSource || "website",
            company_id: effectiveCompanyId,
            input_company_id: body.company_id || null,
            input_company_slug: body.company_slug || null,
            input_hostname: hostname || null,
            headers: {
              origin: req.headers.get("origin") || null,
              referer: req.headers.get("referer") || null,
              host: req.headers.get("host") || null,
            }
          },
        });
      } catch (logErr) {
        console.error("upsert-lead: Lead update logging error:", logErr);
      }
      return new Response(
        JSON.stringify({ success: true, lead_id: existingLead.id, action: "updated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // CREATE new lead
      const leadId = crypto.randomUUID();
      const { error: insertError } = await supabase.from("leads").insert({
        id: leadId,
        phone: cleanPhone,
        ...leadData,
        status: "unpaid",
        source: parsedSource || "website",
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        company_id: companyId,
      });

      if (insertError) {
        console.error("upsert-lead: insert error", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fire-and-forget: remarketing + workflows (don't block response)
      supabase.from("system_settings").select("value").eq("key", "remarketing_sms_new_cycles_enabled").maybeSingle()
        .then(({ data: rmSetting2 }) => {
          if (rmSetting2?.value !== "false") {
            supabase.from("remarketing_cycles").upsert({
              lead_id: leadId,
              company_id: companyId,
              start_date: new Date().toISOString(),
              end_date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
              status: "active",
              sms_sent_count: 0,
            }, { onConflict: "lead_id", ignoreDuplicates: true })
              .then(() => console.log("upsert-lead: Remarketing cycle started for lead", leadId))
              .catch((e: any) => console.error("upsert-lead: Remarketing cycle error:", e));
          }
        }).catch((e: any) => console.error("upsert-lead: Remarketing settings error:", e));

      const wfHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      };
      const wfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`;
      fetch(wfUrl, {
        method: "POST",
        headers: wfHeaders,
        body: JSON.stringify({ trigger_type: "lead_created", lead_id: leadId, company_id: companyId }),
      }).catch((e: any) => console.error("upsert-lead: lead_created workflow error:", e));
      fetch(wfUrl, {
        method: "POST",
        headers: wfHeaders,
        body: JSON.stringify({ trigger_type: "form_filled", lead_id: leadId, company_id: companyId }),
      }).catch((e: any) => console.error("upsert-lead: form_filled workflow error:", e));

      console.log("upsert-lead: Lead created (workflows fired async)", leadId);

      // Log activity
      try {
        const hostname = getHostnameFromRequest(req);
        await supabase.from("activity_logs").insert({
          lead_id: leadId,
          action: "lead_created_via_api",
          details: {
            source: parsedSource || "website",
            company_id: companyId,
            is_draft: false,
            input_company_id: body.company_id || null,
            input_company_slug: body.company_slug || null,
            input_hostname: hostname || null,
            headers: {
              origin: req.headers.get("origin") || null,
              referer: req.headers.get("referer") || null,
              host: req.headers.get("host") || null,
            }
          },
        });
      } catch (logErr) {
        console.error("upsert-lead: Lead creation logging error:", logErr);
      }
      return new Response(
        JSON.stringify({ 
          success: true, 
          lead_id: leadId, 
          action: "created",
          debug_company_id: companyId,
          debug_parsed_source: parsedSource
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("upsert-lead: error", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
