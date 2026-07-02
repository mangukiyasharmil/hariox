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
    const accessToken = Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "WHATSAPP_META_ACCESS_TOKEN not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const PHONE_ID = body.phone_id || "938886099316013";

    // Find the WABA ID from the phone number
    const phoneWabaRes = await fetch(
      `https://graph.facebook.com/v24.0/${PHONE_ID}/whatsapp_business_account?fields=id,name`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const phoneWabaData = await phoneWabaRes.json();
    console.log("Phone's WABA:", JSON.stringify(phoneWabaData));

    const WABA_ID = body.waba_id || phoneWabaData.id;

    // Step 1: Check current subscription status
    const getRes = await fetch(
      `https://graph.facebook.com/v24.0/${WABA_ID}/subscribed_apps`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const currentSubs = await getRes.json();
    console.log("Current subscriptions:", JSON.stringify(currentSubs));

    // Step 2: Subscribe the app to this WABA
    const subRes = await fetch(
      `https://graph.facebook.com/v24.0/${WABA_ID}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    const subData = await subRes.json();
    console.log("Subscribe result:", JSON.stringify(subData));

    // Step 3: Verify subscription after subscribing
    const verifyRes = await fetch(
      `https://graph.facebook.com/v24.0/${WABA_ID}/subscribed_apps`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const verifySubs = await verifyRes.json();

    // Step 4: Get phone numbers under this WABA
    const phonesRes = await fetch(
      `https://graph.facebook.com/v24.0/${WABA_ID}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );
    const phonesData = await phonesRes.json();

    return new Response(
      JSON.stringify({
        waba_id: WABA_ID,
        current_subscriptions: currentSubs,
        subscribe_result: subData,
        verified_subscriptions: verifySubs,
        phone_numbers: phonesData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
