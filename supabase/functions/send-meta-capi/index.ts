import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Server-side Meta Conversions API (CAPI) event sender.
 * Called from payment webhooks to guarantee Purchase events reach Meta
 * even when client-side pixel fails (ad blockers, navigation, redirects).
 *
 * Required secret: META_CAPI_ACCESS_TOKEN (System User Token with ads_management permission)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("send-meta-capi: META_CAPI_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "CAPI not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      event_name,       // "Purchase", "Lead", etc.
      event_time,       // Unix timestamp (seconds)
      pixel_id,         // Override pixel ID
      company_slug,     // Alternative: resolve pixel from slug
      value,            // Event value (amount)
      currency = "INR",
      order_id,         // For deduplication
      lead_id,          // For deduplication
      // User data for matching
      email,
      phone,
      fbc,              // Meta click ID cookie (_fbc)
      fbp,              // Meta browser ID cookie (_fbp)
      client_ip,        // Client IP for matching
      client_user_agent, // Client UA for matching
      event_source_url,  // URL where event occurred
    } = await req.json();

    if (!event_name) {
      return new Response(
        JSON.stringify({ error: "event_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve pixel ID from DB if company_slug provided
    let resolvedPixelId = pixel_id || null;
    if (!resolvedPixelId && company_slug) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: comp } = await supabase
          .from("companies")
          .select("meta_pixel_id")
          .or(`slug.eq.${company_slug}`)
          .single();
        resolvedPixelId = comp?.meta_pixel_id || null;
      } catch {}
    }
    if (!resolvedPixelId) {
      console.log("send-meta-capi: No pixel ID for company", company_slug);
      return new Response(
        JSON.stringify({ success: false, error: "No pixel for this company" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build event ID for deduplication (matches client-side eventID)
    let eventId: string | undefined;
    if (event_name === "Purchase" && order_id) {
      eventId = `purchase_${order_id}`;
    } else if (event_name === "Lead" && lead_id) {
      eventId = `lead_${lead_id}`;
    }

    // Hash user data (Meta requires SHA-256 hashed PII)
    const hashValue = async (val: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(val.trim().toLowerCase());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    };

    // Build user_data object
    const userData: Record<string, any> = {};
    if (email) userData.em = [await hashValue(email)];
    if (phone) {
      // Ensure phone is in E.164 format for hashing
      const cleanPhone = phone.replace(/\D/g, "");
      const e164 = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
      userData.ph = [await hashValue(e164)];
    }
    if (fbc) userData.fbc = fbc;
    if (fbp) userData.fbp = fbp;
    if (client_ip) userData.client_ip_address = client_ip;
    if (client_user_agent) userData.client_user_agent = client_user_agent;

    // Build event payload
    const eventData: Record<string, any> = {
      event_name,
      event_time: event_time || Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: userData,
    };

    if (eventId) eventData.event_id = eventId;
    if (event_source_url) eventData.event_source_url = event_source_url;

    // Custom data
    const customData: Record<string, any> = {};
    if (value !== undefined) customData.value = value;
    if (currency) customData.currency = currency;
    if (order_id) customData.order_id = order_id;
    if (Object.keys(customData).length > 0) {
      eventData.custom_data = customData;
    }

    // Send to Meta Conversions API
    const apiUrl = `https://graph.facebook.com/v21.0/${resolvedPixelId}/events`;
    const payload = {
      data: [eventData],
      access_token: accessToken,
    };

    console.log("send-meta-capi:sending", {
      pixel_id: resolvedPixelId,
      event_name,
      event_id: eventId,
      value,
      has_email: !!email,
      has_phone: !!phone,
      has_fbc: !!fbc,
      has_fbp: !!fbp,
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("send-meta-capi:error", result);
      return new Response(
        JSON.stringify({ success: false, error: result.error?.message || "CAPI request failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("send-meta-capi:success", {
      pixel_id: resolvedPixelId,
      event_name,
      events_received: result.events_received,
      fbtrace_id: result.fbtrace_id,
    });

    return new Response(
      JSON.stringify({ success: true, events_received: result.events_received }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-meta-capi:exception", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
