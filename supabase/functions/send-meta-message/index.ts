import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { page_id, recipient_id, message, platform } = await req.json();

    if (!page_id || !recipient_id || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: page_id, recipient_id, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the page with access token
    const { data: page, error: pageError } = await supabase
      .from("meta_pages")
      .select("*")
      .eq("id", page_id)
      .single();

    if (pageError || !page) {
      return new Response(
        JSON.stringify({ error: "Page not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!page.page_access_token) {
      return new Response(
        JSON.stringify({ error: "No access token configured for this page" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API endpoint based on platform
    let apiUrl: string;
    let requestBody: any;

    if (platform === "instagram" || page.platform === "instagram") {
      // Instagram Messaging API
      apiUrl = `https://graph.facebook.com/v18.0/${page.instagram_account_id || page.page_id}/messages`;
      requestBody = {
        recipient: { id: recipient_id },
        message: { text: message },
      };
    } else {
      // Facebook Messenger API
      apiUrl = `https://graph.facebook.com/v18.0/${page.page_id}/messages`;
      requestBody = {
        recipient: { id: recipient_id },
        message: { text: message },
        messaging_type: "RESPONSE",
      };
    }

    // Send the message
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${page.page_access_token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Meta API error:", result);
      return new Response(
        JSON.stringify({ error: result.error?.message || "Failed to send message" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store outgoing message in unified_messages
    await supabase.from("unified_messages").insert({
      platform: page.platform,
      page_id: page.id,
      sender_id: page.page_id,
      content: message,
      direction: "outgoing",
      status: "sent",
      message_type: "text",
      external_id: result.message_id,
      metadata: { recipient_id },
    });

    return new Response(
      JSON.stringify({ success: true, message_id: result.message_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Send Meta message error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
