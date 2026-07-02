import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { 
      account_id, 
      phone_number, 
      message, 
      template_name,
      template_params,
      template_language,
      lead_id,
      contact_name,
      message_source = "manual"
    } = await req.json();

    if (!account_id || !phone_number || (!message && !template_name)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check DND list for automated messages (workflow, chatbot, remarketing)
    const automatedSources = ["workflow", "chatbot", "remarketing", "campaign", "scheduled"];
    if (automatedSources.includes(message_source)) {
      const cleanPhoneDnd = phone_number.replace(/[\s+\-()]/g, "").replace(/^91/, "");
      const { data: dndEntry } = await supabase
        .from("whatsapp_dnd")
        .select("id")
        .or(`phone.eq.${cleanPhoneDnd},phone.eq.${phone_number.replace(/[\s+\-()]/g, "")}`)
        .maybeSingle();
      
      if (dndEntry) {
        console.log(`[send-whatsapp] Blocked: ${phone_number} is on DND list (source: ${message_source})`);
        return new Response(
          JSON.stringify({ success: false, error: "Number is on DND list", error_code: "DND_BLOCKED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get WhatsApp account credentials
    const { data: account, error: accountError } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp account not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (account.connection_type !== "meta_api" || !account.meta_phone_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta API not configured for this account" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use token from database first, fall back to global secret
    const accessToken = account.meta_access_token || Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");

    // Format phone number for WhatsApp (remove + and spaces)
    const formattedPhone = phone_number.replace(/[\s+\-()]/g, "");
    const fullPhone = formattedPhone.startsWith("91") ? formattedPhone : `91${formattedPhone}`;

    // Build the message payload
    let messagePayload: any = {
      messaging_product: "whatsapp",
      to: fullPhone,
      recipient_type: "individual",
    };

    let finalParams: string[] = template_params || [];
    // Used to render a readable message in the inbox without an extra DB round-trip
    let templateContentForDisplay: string | null = null;

    if (template_name) {
      // Dynamically map template names based on sending account to guarantee brand isolation
      let mappedTemplateName = template_name;

      if (account_id === "80f1b467-5229-497a-9e5c-0c3516963816") {
        // Finance Fundkredit WhatsApp account
        if (template_name.includes("remarketing") || template_name.includes("marketing") || template_name.includes("promo")) {
          mappedTemplateName = "remarketing_fi_fkd_marketing_1";
        } else if (template_name.includes("pay") || template_name.includes("success")) {
          mappedTemplateName = "pay_test";
        } else {
          mappedTemplateName = "remarketin_utility1";
        }
      } else if (account_id === "d0eb940b-2d3c-4774-a46a-a89548af4004") {
        // Capital Hariox WhatsApp account
        if (template_name.includes("remarketing_capital_2") || template_name === "remarketing_credit_2") {
          mappedTemplateName = "remarketing_capital_2";
        } else if (template_name.includes("remarketing") || template_name.includes("marketing") || template_name.includes("promo")) {
          mappedTemplateName = "remarketing_capital";
        } else if (template_name.includes("telecaller")) {
          mappedTemplateName = "telecaller_capital";
        } else if (template_name.includes("reject")) {
          mappedTemplateName = "loan_rejected_capital";
        } else if (template_name.includes("success")) {
          mappedTemplateName = "payment_sucess_capital";
        }
      } else if (account_id === "14695e74-2978-492a-9d22-43a5237da840") {
        // Credit Hariox WhatsApp account
        if (template_name.includes("remarketing_capital_2") || template_name.includes("remarketing_credit_2")) {
          mappedTemplateName = "remarketing_credit_2";
        } else if (template_name.includes("remarketing") || template_name.includes("marketing") || template_name.includes("promo")) {
          mappedTemplateName = "remarketing_credit_1";
        } else if (template_name.includes("telecaller")) {
          mappedTemplateName = "telecaller_credit";
        } else if (template_name.includes("reject")) {
          mappedTemplateName = "loan_rejected_credit";
        } else if (template_name.includes("success")) {
          mappedTemplateName = "payment_success_credit1";
        }
      }

      console.log(`[send-whatsapp] Resolving template: requested="${template_name}", mapped="${mappedTemplateName}" for account="${account_id}"`);

      // Template message
      messagePayload.type = "template";
      messagePayload.template = {
        name: mappedTemplateName,
        language: { code: template_language || "en" },
      };
      
      // Fetch template + lead data in PARALLEL to minimize latency
      let expectedParamCount = finalParams.length;
      let paramNames: string[] = [];
      let templateHasImageHeader = false;
      let templateHeaderImageUrl: string | null = null;

      const requestedLang = template_language || "en";

      // Single query: fetch ALL matching templates for this name+account, pick best match in JS
      const templatePromise = supabase
        .from("whatsapp_templates")
        .select("meta_variables_count, content, variables, header_type, header_url, stable_header_image_url, language")
        .eq("account_id", account_id)
        .eq("name", mappedTemplateName)
        .limit(10);

      // Fetch lead data in parallel (only if needed)
      const leadPromise = (lead_id && (finalParams.length === 0 || finalParams.some((p: string) => !p || p.trim() === "")))
        ? supabase.from("leads").select("full_name, loan_amount, loan_type, city").eq("id", lead_id).single()
        : Promise.resolve({ data: null });

      const [tmplResult, leadResult] = await Promise.all([templatePromise, leadPromise]);
      const tmplRows = tmplResult.data || [];

      // Pick exact language match, or fallback to first available
      let tmpl = tmplRows.find((t: any) => t.language === requestedLang) || tmplRows[0] || null;
      if (tmpl && tmpl.language !== requestedLang) {
        messagePayload.template.language = { code: tmpl.language };
      }

      if (!tmpl) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Template "${template_name}" is not synced for this WhatsApp account. Please sync templates and try again.`,
            error_code: "TEMPLATE_NOT_SYNCED",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      templateContentForDisplay = tmpl.content || null;
      templateHasImageHeader = (tmpl.header_type || "").toUpperCase() === "IMAGE";
      // Prefer admin-set stable image (matches the approved template image).
      // Fall back to header_url from sync (often a Meta CDN URL that may not render for customers).
      templateHeaderImageUrl = tmpl.stable_header_image_url || tmpl.header_url || null;

      expectedParamCount = tmpl.meta_variables_count || 0;
      if (tmpl.content) {
        const namedMatches = tmpl.content.match(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
        if (namedMatches) {
          paramNames = namedMatches.map((m: string) => m.replace(/\{\{|\}\}/g, ""));
          if (expectedParamCount === 0) expectedParamCount = paramNames.length;
        }
        if (paramNames.length === 0) {
          const posMatches = tmpl.content.match(/\{\{\d+\}\}/g);
          if (posMatches && expectedParamCount === 0) expectedParamCount = posMatches.length;
        }
      }
      if (paramNames.length === 0 && tmpl.variables && Array.isArray(tmpl.variables)) {
        paramNames = (tmpl.variables as string[]).map((v: string) => v.replace(/\{\{|\}\}/g, ""));
      }

      // Auto-fill params from lead data (already fetched in parallel)
      const leadData = leadResult.data;
      if (leadData && expectedParamCount > 0) {
        const customerName = leadData.full_name || contact_name || "Customer";
        const defaults = [
          customerName,
          leadData.loan_amount ? new Intl.NumberFormat("en-IN").format(leadData.loan_amount) : customerName,
          leadData.loan_type || customerName,
          leadData.city || customerName,
        ];
        if (finalParams.length === 0) {
          finalParams = defaults.slice(0, expectedParamCount);
        } else {
          finalParams = finalParams.map((p: string, i: number) => 
            (p && p.trim() !== "") ? p : (defaults[i] || customerName)
          );
        }
      }

      if (finalParams.length === 0 && expectedParamCount > 0) {
        finalParams = Array(expectedParamCount).fill(contact_name || "Customer");
      }
      if (finalParams.length > 0) {
        finalParams = finalParams.map((p: string) => (p && String(p).trim() !== "") ? String(p).trim() : (contact_name || "Customer"));
      }

      // Build components
      const components: any[] = [];
      
      // For dynamic IMAGE header templates: Meta REQUIRES an image parameter.
      // Use a stable URL from our storage (CDN URLs from Meta expire).
      if (templateHasImageHeader) {
        const STABLE_IMAGE = "https://uzfccftfizleiyqzqoki.supabase.co/storage/v1/object/public/public-assets/hariox-banner.jpg";
        // Use stable custom URL if available, otherwise use our default banner
        const isMetaCdnUrl = templateHeaderImageUrl && (
          templateHeaderImageUrl.includes("scontent.whatsapp.net") ||
          templateHeaderImageUrl.includes("lookaside.fbsbx.com")
        );
        const headerUrl = (templateHeaderImageUrl && !isMetaCdnUrl) ? templateHeaderImageUrl : STABLE_IMAGE;
        components.push({
          type: "header",
          parameters: [{ type: "image", image: { link: headerUrl } }],
        });
      }

      // Body parameters
      if (finalParams.length > 0) {
        const parameters = finalParams.map((p: string) => {
          return { type: "text", text: String(p).trim() };
        });
        components.push({ type: "body", parameters });
      }

      if (components.length > 0) {
        messagePayload.template.components = components;
      }
    } else {
      // For automated/workflow sources, skip 24-hour window check — they manage their own logic
      const automatedTextSources = ["workflow", "chatbot"];
      if (!automatedTextSources.includes(message_source)) {
        // Check if within 24-hour window by looking at last incoming message
        const { data: lastIncoming } = await supabase
          .from("whatsapp_messages")
          .select("created_at")
          .eq("account_id", account_id)
          .eq("phone_number", fullPhone)
          .eq("direction", "incoming")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const lastReplyTime = lastIncoming?.created_at ? new Date(lastIncoming.created_at).getTime() : 0;
        const hoursSinceReply = (Date.now() - lastReplyTime) / (1000 * 60 * 60);

        if (hoursSinceReply > 24) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "24-hour window expired. Customer last replied " + Math.floor(hoursSinceReply) + "h ago. Please use an approved Meta template to re-engage.",
              error_code: "OUTSIDE_24H_WINDOW",
              hours_since_reply: Math.floor(hoursSinceReply),
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Text message (within 24h window)
      messagePayload.type = "text";
      messagePayload.text = { body: message };
    }

    // Send via Meta Graph API
    const apiUrl = `https://graph.facebook.com/v22.0/${account.meta_phone_id}/messages`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseData = await response.json();

    // Log the API call (kept as a promise so we can run DB writes in parallel)
    const apiLogPromise = supabase.from("whatsapp_api_logs").insert({
      account_id,
      action: "send_message",
      request_data: messagePayload,
      response_data: responseData,
      status: response.ok ? "success" : "failed",
      error_message: response.ok ? null : JSON.stringify(responseData.error),
    });

    if (!response.ok) {
      // ensure we still store the API log even on failures
      await apiLogPromise;

      console.error("Meta API Error:", responseData, "Template:", template_name, "Language:", template_language);
      const metaError = responseData.error?.message || "Failed to send message";
      const errorCode = responseData.error?.code;
      let userFriendlyError = metaError;
      if (errorCode === 132001) {
        userFriendlyError = `Template "${template_name}" not found for language "${template_language || "en"}". Please sync templates from Meta or check the language code.`;
      } else if (errorCode === 132000) {
        userFriendlyError = `Template "${template_name}" requires parameters that were not provided. Please fill in all template variables before sending.`;
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: userFriendlyError
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store message in database with full readable content (not just template name)
    let displayContent = "";
    if (template_name && message && message.trim() !== "" && !message.startsWith("📋 Template:")) {
      // Use the resolved readable content sent from frontend
      displayContent = message;
    } else if (template_name) {
      // Build readable content from the already-fetched template content + params
      const base = templateContentForDisplay;
      if (base) {
        let resolved = base;
        const validParams = finalParams || [];
        // Replace named variables {{name}} and positional {{1}} in order of params
        validParams.forEach((p: string) => {
          resolved = resolved.replace(/\{\{[^}]*\}\}/, p || "");
        });
        displayContent = resolved;
      } else {
        displayContent = `📋 Template: ${template_name}`;
      }
    } else {
      displayContent = message || "";
    }
    const messageInsertPromise = supabase.from("whatsapp_messages").insert({
      account_id,
      phone_number: fullPhone,
      contact_name,
      content: displayContent,
      direction: "outgoing",
      status: "sent",
      message_type: template_name ? "template" : "text",
      lead_id,
      message_source,
      wamid: responseData.messages?.[0]?.id,
      sent_at: new Date().toISOString(),
    }).select().single();

    const updateAccountPromise = supabase
      .from("whatsapp_accounts")
      .update({ last_connected_at: new Date().toISOString() })
      .eq("id", account_id);

    const [messageInsertRes] = await Promise.all([
      messageInsertPromise,
      apiLogPromise,
      updateAccountPromise,
    ]);

    const { data: insertedMessage } = messageInsertRes;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: insertedMessage?.id,
        wamid: responseData.messages?.[0]?.id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const isAbort =
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError");

    if (isAbort) {
      console.error("Meta API request timed out (15s):", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "WhatsApp provider timeout. Please try again in a few seconds.",
          error_code: "META_TIMEOUT",
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("Error in send-whatsapp:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
