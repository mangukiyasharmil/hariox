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

    const { account_id } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Account ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Access token not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the WABA ID from the phone number or business ID
    let wabaId = account.meta_business_id;
    
    // If meta_business_id is a Business Portfolio ID (not WABA), find the real WABA
    if (wabaId) {
      // Try to fetch templates directly - if it fails, try finding WABA from portfolio
      const testUrl = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?limit=1`;
      const testResponse = await fetch(testUrl, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      
      if (!testResponse.ok) {
        // The stored ID is likely a Business Portfolio ID, find WABA from it
        const bizResponse = await fetch(
          `https://graph.facebook.com/v22.0/${wabaId}/owned_whatsapp_business_accounts`,
          { headers: { "Authorization": `Bearer ${accessToken}` } }
        );
        const bizData = await bizResponse.json();
        
        if (bizData.data && bizData.data.length > 0) {
          wabaId = bizData.data[0].id;
          // Update the account with the correct WABA ID
          await supabase
            .from("whatsapp_accounts")
            .update({ meta_business_id: wabaId })
            .eq("id", account_id);
        }
      }
    } else {
      // No business ID stored, find WABA from portfolio
      const PORTFOLIO_ID = "1181007073921340";
      const bizResponse = await fetch(
        `https://graph.facebook.com/v22.0/${PORTFOLIO_ID}/owned_whatsapp_business_accounts`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
      );
      const bizData = await bizResponse.json();
      
      if (bizData.data && bizData.data.length > 0) {
        wabaId = bizData.data[0].id;
        await supabase
          .from("whatsapp_accounts")
          .update({ meta_business_id: wabaId })
          .eq("id", account_id);
      }
    }

    if (!wabaId) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not find WhatsApp Business Account ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch templates from Meta API
    const url = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?limit=100`;
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    const responseData = await response.json();

    await supabase.from("whatsapp_api_logs").insert({
      account_id,
      action: "fetch_templates",
      request_data: { url, waba_id: wabaId },
      response_data: { count: responseData.data?.length || 0 },
      status: response.ok ? "success" : "failed",
      error_message: response.ok ? null : JSON.stringify(responseData.error),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: responseData.error?.message || "Failed to fetch templates" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const templates = responseData.data || [];
    
    let syncedCount = 0;
    for (const template of templates) {
      const variables: string[] = [];
      let content = "";
      let category = template.category || "UTILITY";
      let metaStatus = template.status || "UNKNOWN";
      let metaVariablesCount = 0;
      let headerType: string | null = null;
      let headerUrl: string | null = null;

      for (const component of template.components || []) {
        if (component.type === "HEADER") {
          // Detect header format (TEXT, IMAGE, VIDEO, DOCUMENT)
          if (component.format) {
            headerType = component.format; // e.g., "IMAGE", "TEXT"
          }
          if (component.example?.header_handle?.[0]) {
            headerUrl = component.example.header_handle[0];
          }
          if (component.text) {
            content += component.text + "\n\n";
            const headerMatches = component.text.match(/\{\{(\d+)\}\}/g) || [];
            headerMatches.forEach((m: string) => variables.push(m));
          }
        } else if (component.type === "BODY" && component.text) {
          content += component.text;
          // Count positional variables {{1}}, {{2}}
          const posMatches = component.text.match(/\{\{\d+\}\}/g) || [];
          posMatches.forEach((m: string) => variables.push(m));
          metaVariablesCount = posMatches.length;
          // Also count named variables {{name}}, {{amount}}
          if (metaVariablesCount === 0) {
            const namedMatches = component.text.match(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g) || [];
            metaVariablesCount = namedMatches.length;
            namedMatches.forEach((m: string) => variables.push(m));
          }
        }
      }
      if (!content) content = template.name;

      const { error: upsertError } = await supabase
        .from("whatsapp_templates")
        .upsert({
          account_id,
          name: template.name,
          content: content.trim(),
          variables: [...new Set(variables)],
          is_active: metaStatus === "APPROVED",
          category,
          meta_status: metaStatus,
          meta_template_id: template.id,
          language: template.language || "en",
          meta_variables_count: metaVariablesCount,
          header_type: headerType,
          header_url: headerUrl,
        }, {
          onConflict: "account_id,name",
          ignoreDuplicates: false,
        });

      if (!upsertError) syncedCount++;
      else console.error("Upsert error:", upsertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced_count: syncedCount,
        total_fetched: templates.length,
        waba_id: wabaId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error fetching Meta templates:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
