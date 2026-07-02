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

    const { account_id, pin = "123456", certificate } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ success: false, error: "account_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account
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

    if (!account.meta_phone_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta Phone ID not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Register the phone number with Meta Cloud API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${account.meta_phone_id}/register`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin: pin,
          ...(certificate ? { data_localization_region: "IN", certificate } : {}),
        }),
      }
    );

    const data = await response.json();

    // Log the API call
    await supabase.from("whatsapp_api_logs").insert({
      account_id,
      action: "register_phone",
      request_data: { phone_id: account.meta_phone_id, pin: "***" },
      response_data: data,
      status: response.ok ? "success" : "failed",
      error_message: response.ok ? null : JSON.stringify(data.error),
    });

    if (!response.ok) {
      const rawMsg = data.error?.message || "Registration failed";
      const errCode = data.error?.code;
      let friendly = rawMsg;
      // Meta code 100 / OAuthException when phone ID can't be loaded by this token
      if (
        errCode === 100 ||
        /does not exist|cannot be loaded|missing permissions/i.test(rawMsg)
      ) {
        friendly =
          `Meta rejected Phone Number ID "${account.meta_phone_id}". ` +
          `This usually means the Phone Number ID does NOT belong to the WhatsApp Business Account ` +
          `that issued the access token (or the token lacks whatsapp_business_management / ` +
          `whatsapp_business_messaging permissions, or has expired). ` +
          `Fix: in Meta Business Manager → WhatsApp Accounts, copy the correct Phone Number ID ` +
          `and generate a fresh System User token from the SAME Business that owns this number, ` +
          `then re-save the account and try again.`;
      }
      return new Response(
        JSON.stringify({ success: false, error: friendly, meta_error: data.error }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch display name from Meta API
    let verifiedName = null;
    try {
      const phoneInfoResp = await fetch(
        `https://graph.facebook.com/v18.0/${account.meta_phone_id}?fields=verified_name,display_phone_number`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
      );
      const phoneInfo = await phoneInfoResp.json();
      verifiedName = phoneInfo.verified_name || null;
      
      // Update account with verified name and display phone number
      await supabase
        .from("whatsapp_accounts")
        .update({ 
          status: "connected", 
          last_connected_at: new Date().toISOString(),
          verified_name: verifiedName,
          phone_number: phoneInfo.display_phone_number || account.phone_number,
        })
        .eq("id", account_id);
    } catch (e) {
      // Fallback: just update status
      await supabase
        .from("whatsapp_accounts")
        .update({ status: "connected", last_connected_at: new Date().toISOString() })
        .eq("id", account_id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Phone number registered successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error registering phone:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
