import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function processes:
// 1. Leads created 30-35 min ago still unpaid (no payment attempted)
// 2. Pending payments 15-60 min old (customer opened gateway but didn't complete)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { leadId: string; success: boolean; channel: string; type: string }[] = [];

    // ── Part 1: Leads created 30-35 min ago, still unpaid ──
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000);

    const { data: unpaidLeads } = await supabase
      .from("leads")
      .select("id, full_name, phone, loan_amount, loan_type, company_id")
      .eq("status", "unpaid")
      .gte("created_at", thirtyFiveMinsAgo.toISOString())
      .lte("created_at", thirtyMinsAgo.toISOString());

    // ── Part 2: Pending payments 15-60 min old ──
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data: pendingPayments } = await supabase
      .from("payments")
      .select("id, lead_id, total_amount, payment_source, razorpay_order_id")
      .eq("status", "pending")
      .gte("created_at", sixtyMinsAgo.toISOString())
      .lte("created_at", fifteenMinsAgo.toISOString());

    // Collect unique lead IDs from pending payments
    const pendingLeadIds = [...new Set((pendingPayments || []).map(p => p.lead_id))];

    // Fetch lead details for pending payments
    let pendingLeadDetails: any[] = [];
    if (pendingLeadIds.length > 0) {
      const { data } = await supabase
        .from("leads")
        .select("id, full_name, phone, loan_amount, loan_type, company_id")
        .in("id", pendingLeadIds)
        .eq("status", "unpaid");
      pendingLeadDetails = data || [];
    }

    // Merge both lists, deduplicate by lead ID
    const allLeadIds = new Set<string>();
    const leadsToProcess: { lead: any; type: string }[] = [];

    for (const lead of pendingLeadDetails) {
      if (!allLeadIds.has(lead.id)) {
        allLeadIds.add(lead.id);
        leadsToProcess.push({ lead, type: "payment_abandoned" });
      }
    }

    for (const lead of (unpaidLeads || [])) {
      if (!allLeadIds.has(lead.id)) {
        allLeadIds.add(lead.id);
        leadsToProcess.push({ lead, type: "no_payment_attempt" });
      }
    }

    if (leadsToProcess.length === 0) {
      console.log("[abandoned-payment-reminder] No leads to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No leads to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[abandoned-payment-reminder] Processing ${leadsToProcess.length} leads (${pendingLeadDetails.length} payment abandoned, ${(unpaidLeads || []).length} no attempt)`);

    for (const { lead, type } of leadsToProcess) {
      try {
        // Check if we already sent a reminder for this lead recently (last 2 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: existingLog } = await supabase
          .from("activity_logs")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("action", "abandoned_payment_reminder")
          .gte("created_at", twoHoursAgo)
          .limit(1)
          .maybeSingle();

        if (existingLog) {
          continue;
        }

        // Determine company domain
        let domain = "credit.hariox.com";
        if (lead.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("slug, website_url")
            .eq("id", lead.company_id)
            .single();

          if (company?.website_url) {
            domain = company.website_url.replace(/^https?:\/\//, "");
          } else if (company?.slug) {
            const slugToDomain: Record<string, string> = {
              hariox: "credit.hariox.com",
              finance: "finance.hariox.com",
              capital: "capital.hariox.com",
            };
            domain = slugToDomain[company.slug] || "credit.hariox.com";
          }
        }

        const paymentLink = `https://${domain}/pay/marketing?phone=${encodeURIComponent(lead.phone)}`;
        const firstName = (lead.full_name || "Customer").split(" ")[0];
        const formattedAmount = new Intl.NumberFormat("en-IN").format(lead.loan_amount || 0);

        const message = type === "payment_abandoned"
          ? `🔔 ${firstName} जी, आपका payment अभी complete नहीं हुआ।

₹${formattedAmount} loan के लिए बस ₹799 consulting fee बाकी है।

✅ 100% Refundable if not approved
✅ 30+ Partner Banks
✅ 24hr Disbursal

👉 अभी pay करें: ${paymentLink}

- Team Hariox`
          : `🙏 नमस्ते ${firstName} जी,

आपका ₹${formattedAmount} ${lead.loan_type || ""} loan application incomplete है।

✅ अभी complete करें: ${paymentLink}

👉 किसी भी सहायता के लिए reply करें।

- Team Hariox`;

        const { error: waError } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone: lead.phone,
            message,
            lead_id: lead.id,
          },
        });

        results.push({
          leadId: lead.id,
          success: !waError,
          channel: "whatsapp",
          type,
        });

        await supabase.from("activity_logs").insert({
          lead_id: lead.id,
          action: "abandoned_payment_reminder",
          details: { channel: "whatsapp", type, payment_link: paymentLink },
        });

        console.log(`[abandoned-payment-reminder] Sent (${type}) to ${lead.phone}`);
      } catch (err) {
        console.error(`[abandoned-payment-reminder] Error for lead ${lead.id}:`, err);
        results.push({ leadId: lead.id, success: false, channel: "whatsapp", type });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: leadsToProcess.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[abandoned-payment-reminder] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
