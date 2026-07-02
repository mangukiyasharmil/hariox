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

    const { account_id, fetch_insights, date } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ success: false, error: "account_id required" }),
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

    if (account.connection_type !== "meta_api" || !account.meta_phone_id) {
      return new Response(
        JSON.stringify({ success: true, connected: false, status: "not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check phone number status
    const apiUrl = `https://graph.facebook.com/v18.0/${account.meta_phone_id}`;
    const response = await fetch(apiUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const data = await response.json();

    if (!response.ok) {
      await supabase.from("whatsapp_accounts").update({ status: "error" }).eq("id", account_id);
      // Return DB phone number even on error
      return new Response(
        JSON.stringify({ success: true, connected: false, status: "error", phone_number: account.phone_number, error: data.error?.message || "API failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get quality/limits
    const limitsUrl = `https://graph.facebook.com/v18.0/${account.meta_phone_id}?fields=messaging_limit_tier,quality_rating,throughput`;
    const limitsResponse = await fetch(limitsUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const limitsData = await limitsResponse.json();

    // Use Meta's display_phone_number only if it looks like a real number (not a test/sandbox number)
    // Test/sandbox numbers typically start with 1555 (US sandbox) — keep DB value for those
    const metaDisplayPhone = data.display_phone_number || "";
    const isSandboxNumber = metaDisplayPhone.replace(/\D/g, "").startsWith("1555");
    const phoneToStore = isSandboxNumber ? account.phone_number : (metaDisplayPhone || account.phone_number || "");
    // For analytics API calls, use the real phone (from DB) if Meta returned a sandbox number
    const realPhoneForAnalytics = isSandboxNumber
      ? account.phone_number.replace(/[^0-9]/g, "")
      : metaDisplayPhone.replace(/[^0-9]/g, "");

    // Update account with Meta's real values — but never overwrite phone_number with a sandbox test number
    await supabase.from("whatsapp_accounts").update({
      status: "connected",
      phone_number: phoneToStore,
      verified_name: data.verified_name || null,
      last_connected_at: new Date().toISOString()
    }).eq("id", account_id);

    // Today's message stats — fetch from both DB and Meta analytics, use whichever is higher
    const nowIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
    const todayMidnightIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - 5.5 * 60 * 60 * 1000);
    const todayISO = todayMidnightIST.toISOString();

    const [{ count: dbSent }, { count: dbDelivered }] = await Promise.all([
      supabase.from("whatsapp_messages").select("*", { count: "exact", head: true })
        .eq("account_id", account_id).eq("direction", "outgoing").gte("created_at", todayISO),
      supabase.from("whatsapp_messages").select("*", { count: "exact", head: true })
        .eq("account_id", account_id).in("status", ["delivered", "read"]).gte("created_at", todayISO),
    ]);

    // Also fetch Meta analytics for today to get accurate sent/delivered counts
    let metaSentToday = 0, metaDeliveredToday = 0;
    try {
      const wabaId = account.meta_business_id;
      const phoneNumber = realPhoneForAnalytics;
      const startOfDay = Math.floor(todayMidnightIST.getTime() / 1000);
      const endOfDay = startOfDay + 86400;
      const todayInsightsUrl = `https://graph.facebook.com/v20.0/${wabaId}?fields=analytics.start(${startOfDay}).end(${endOfDay}).granularity(DAY).phone_numbers([${phoneNumber}])`;
      const todayInsightsResp = await fetch(todayInsightsUrl, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const todayInsightsData = await todayInsightsResp.json();
      const analyticsRoot = todayInsightsData?.analytics;
      if (analyticsRoot?.data_points) {
        for (const dp of analyticsRoot.data_points) {
          metaSentToday += dp.sent || 0;
          metaDeliveredToday += dp.delivered || 0;
        }
      }
      if (analyticsRoot?.data) {
        for (const point of analyticsRoot.data) {
          for (const dp of (point.data_points || [])) {
            metaSentToday += dp.sent || 0;
            metaDeliveredToday += dp.delivered || 0;
          }
        }
      }
    } catch (_) { /* ignore, fall back to DB */ }

    // Use the higher of DB or Meta counts (Meta API is source of truth for sent)
    const todaySent = Math.max(dbSent || 0, metaSentToday);
    const todayDelivered = Math.max(dbDelivered || 0, metaDeliveredToday);

    // Fetch Meta Business API analytics/insights if requested
    let metaInsights = null;
    if (fetch_insights) {
      try {
        // Use the target date or today
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = Math.floor(new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime() / 1000);
        const endOfDay = startOfDay + 86400;
        const phoneNumber = realPhoneForAnalytics;

        // Step 1: Find the WABA ID from the phone number
        let wabaId = account.meta_business_id;
        
        // Try to get WABA ID from the phone number's owner
        try {
          const ownerUrl = `https://graph.facebook.com/v18.0/${account.meta_phone_id}?fields=name,id`;
          const ownerResp = await fetch(ownerUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` },
          });
          const ownerData = await ownerResp.json();
          console.log("[whatsapp-status] Phone owner:", JSON.stringify(ownerData));

          // Try to discover WABA ID from phone_numbers endpoint
          const wabaPhoneUrl = `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers`;
          const wabaPhoneResp = await fetch(wabaPhoneUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` },
          });
          const wabaPhoneData = await wabaPhoneResp.json();
          console.log("[whatsapp-status] WABA phone_numbers:", JSON.stringify(wabaPhoneData).slice(0, 500));
        } catch (e) {
          console.log("[whatsapp-status] Could not resolve WABA:", e);
        }

        // Fetch conversation analytics - use DAY granularity (not DAILY)
        const analyticsUrl = `https://graph.facebook.com/v20.0/${wabaId}?fields=conversation_analytics.start(${startOfDay}).end(${endOfDay}).granularity(DAILY).phone_numbers([${phoneNumber}])`;
        console.log("[whatsapp-status] Analytics URL:", analyticsUrl);
        
        const analyticsResp = await fetch(analyticsUrl, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        const analyticsData = await analyticsResp.json();
        console.log("[whatsapp-status] Conversation analytics response:", JSON.stringify(analyticsData).slice(0, 1000));

        // Also try the analytics (message stats) endpoint - use DAY granularity
        const insightsUrl = `https://graph.facebook.com/v20.0/${wabaId}?fields=analytics.start(${startOfDay}).end(${endOfDay}).granularity(DAY).phone_numbers([${phoneNumber}])`;
        
        const insightsResp = await fetch(insightsUrl, {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        const insightsData = await insightsResp.json();
        console.log("[whatsapp-status] Analytics response:", JSON.stringify(insightsData).slice(0, 1000));

        // Parse conversation analytics
        let conversations: any = { marketing: 0, utility: 0, service: 0, authentication: 0 };
        let charges: any = { marketing: 0, utility: 0, service: 0, authentication: 0, total: 0 };
        let freeMessages = { customer_service: 0, entry_point: 0, total: 0 };
        let paidMessages = { marketing: 0, utility: 0, authentication: 0, total: 0 };

        if (analyticsData?.conversation_analytics?.data) {
          const convData = analyticsData.conversation_analytics.data;
          for (const point of convData) {
            if (point.data_points) {
              for (const dp of point.data_points) {
                const type = (dp.conversation_type || dp.conversation_category || "").toLowerCase();
                const cost = dp.cost || 0;
                const count = dp.conversation || 1;
                if (type.includes("marketing")) {
                  conversations.marketing += count;
                  charges.marketing += cost;
                  paidMessages.marketing += count;
                } else if (type.includes("utility")) {
                  conversations.utility += count;
                  charges.utility += cost;
                  paidMessages.utility += count;
                } else if (type.includes("service")) {
                  conversations.service += count;
                  freeMessages.customer_service += count;
                } else if (type.includes("authentication")) {
                  conversations.authentication += count;
                  charges.authentication += cost;
                  paidMessages.authentication += count;
                } else if (type.includes("free_entry")) {
                  freeMessages.entry_point += count;
                } else if (type.includes("free_tier") || type.includes("free_customer")) {
                  freeMessages.customer_service += count;
                }
              }
            }
          }
        }

        // Parse message analytics - handle both nested and flat data_points
        let messageSent = 0, messageDelivered = 0, messageReceived = 0;
        const analyticsRoot = insightsData?.analytics;
        if (analyticsRoot) {
          // Flat structure: { data_points: [...] }
          if (analyticsRoot.data_points) {
            for (const dp of analyticsRoot.data_points) {
              messageSent += dp.sent || 0;
              messageDelivered += dp.delivered || 0;
              messageReceived += dp.received || 0;
            }
          }
          // Nested structure: { data: [{ data_points: [...] }] }
          if (analyticsRoot.data) {
            for (const point of analyticsRoot.data) {
              if (point.data_points) {
                for (const dp of point.data_points) {
                  messageSent += dp.sent || 0;
                  messageDelivered += dp.delivered || 0;
                  messageReceived += dp.received || 0;
                }
              }
            }
          }
        }

        charges.total = charges.marketing + charges.utility + charges.authentication;
        freeMessages.total = freeMessages.customer_service + freeMessages.entry_point;
        paidMessages.total = paidMessages.marketing + paidMessages.utility + paidMessages.authentication;

        metaInsights = {
          all_messages: { sent: messageSent, delivered: messageDelivered, received: messageReceived },
          messages_delivered: {
            marketing: conversations.marketing,
            marketing_lite: 0,
            utility: conversations.utility,
            authentication: conversations.authentication,
            authentication_international: 0,
            service: conversations.service,
            total: messageDelivered
          },
          free_messages: freeMessages,
          paid_messages: paidMessages,
          charges,
          raw_conversation: analyticsData?.conversation_analytics || null,
          raw_analytics: insightsData?.analytics || null,
        };
      } catch (insightErr) {
        console.error("Error fetching Meta insights:", insightErr);
        metaInsights = { error: "Failed to fetch insights" };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        connected: true,
        status: "connected",
        phone_number: phoneToStore,  // Use DB phone for test/sandbox numbers
        verified_name: data.verified_name,
        quality_rating: limitsData.quality_rating || "GREEN",
        messaging_limit: limitsData.messaging_limit_tier || "TIER_1K",
        today_stats: { sent: todaySent || 0, delivered: todayDelivered || 0 },
        meta_insights: metaInsights,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
