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
      name, 
      category = "UTILITY",
      language = "en",
      header_text,
      header_format,
      header_image_url,
      body_text,
      footer_text,
      buttons,
    } = await req.json();

    if (!account_id || !name || !body_text) {
      return new Response(
        JSON.stringify({ success: false, error: "account_id, name, and body_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account and WABA ID
    const { data: account, error: accountError } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ success: false, error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = account.meta_access_token || Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");
    let wabaId = account.meta_business_id;

    if (!wabaId) {
      // Find WABA from portfolio
      const PORTFOLIO_ID = "1181007073921340";
      const bizResponse = await fetch(
        `https://graph.facebook.com/v18.0/${PORTFOLIO_ID}/owned_whatsapp_business_accounts`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
      );
      const bizData = await bizResponse.json();
      if (bizData.data?.[0]) {
        wabaId = bizData.data[0].id;
        await supabase.from("whatsapp_accounts").update({ meta_business_id: wabaId }).eq("id", account_id);
      }
    }

    if (!wabaId) {
      return new Response(
        JSON.stringify({ success: false, error: "WABA ID not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build template components
    const components: any[] = [];

    if (header_format === "IMAGE" && header_image_url) {
      components.push({
        type: "HEADER",
        format: "IMAGE",
        example: { header_handle: [header_image_url] },
      });
    } else if (header_text) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: header_text,
      });
    }

    components.push({
      type: "BODY",
      text: body_text,
    });

    if (footer_text) {
      components.push({
        type: "FOOTER",
        text: footer_text,
      });
    }

    if (buttons && buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((btn: any) => ({
          type: btn.type || "QUICK_REPLY",
          text: btn.text,
          ...(btn.url ? { url: btn.url } : {}),
          ...(btn.phone_number ? { phone_number: btn.phone_number } : {}),
        })),
      });
    }

    // Format template name (Meta requires lowercase with underscores)
    const formattedName = name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

    // Create template via Meta API
    const payload = {
      name: formattedName,
      category: category.toUpperCase(),
      language,
      components,
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    // Log API call
    await supabase.from("whatsapp_api_logs").insert({
      account_id,
      action: "create_template",
      request_data: payload,
      response_data: data,
      status: response.ok ? "success" : "failed",
      error_message: response.ok ? null : JSON.stringify(data.error),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || "Failed to create template" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract variables
    const allText = (header_text || "") + " " + body_text;
    const variables = [...new Set((allText.match(/\{\{(\d+)\}\}/g) || []))];

    // Save to local DB
    const { data: savedTemplate } = await supabase
      .from("whatsapp_templates")
      .upsert({
        account_id,
        name: formattedName,
        content: ((header_text ? header_text + "\n\n" : "") + body_text).trim(),
        variables,
        is_active: false,
        category: category.toUpperCase(),
        meta_status: "PENDING",
        meta_template_id: data.id,
        language,
        header_type: header_format === "IMAGE" ? "IMAGE" : (header_text ? "TEXT" : null),
        header_url: header_format === "IMAGE" ? header_image_url : null,
        stable_header_image_url: header_format === "IMAGE" ? header_image_url : null,
      }, {
        onConflict: "account_id,name",
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({ 
        success: true, 
        template_id: data.id,
        template_name: formattedName,
        status: data.status || "PENDING",
        message: "Template submitted to Meta for review. It will be available once approved.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error creating template:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
