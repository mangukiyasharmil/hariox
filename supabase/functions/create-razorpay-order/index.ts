import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (req: Request) => {
  // Browsers send a preflight (OPTIONS) with Access-Control-Request-Headers.
  // If we don't echo/allow ALL requested headers, fetch() fails with "Failed to fetch".
  const requestedHeaders = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    // Echo requested headers for maximum compatibility.
    "Access-Control-Allow-Headers":
      requestedHeaders ||
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  };
};

const inferCompanySlugFromHostname = (hostname: string): string => {
  return "hariox";
};

const getHostnameFromRequest = (req: Request): string | null => {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {
      // ignore
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      // ignore
    }
  }

  return null;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, testMode, paymentSource } = await req.json();

    // Validate payment source: direct=main website, whatsapp=WA remarketing, marketing=SMS campaign, telecaller=staff, manual=offline
    const validSources = ["direct", "telecaller", "manual", "marketing", "whatsapp", "sms"];
    const resolvedPaymentSource = validSources.includes(paymentSource) ? paymentSource : "direct";

    console.log("create-razorpay-order:request", { leadId, testMode, paymentSource: resolvedPaymentSource });

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "Lead ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // RATE LIMITING: Max 3 payment attempts per lead per hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentOrders, error: rateError } = await supabase
      .from("payments")
      .select("created_at")
      .eq("lead_id", leadId)
      .gte("created_at", oneHourAgo);

    if (!rateError && recentOrders && recentOrders.length >= 25) {
      console.warn("create-razorpay-order:rate_limited", { leadId, attempts: recentOrders.length });
      return new Response(
        JSON.stringify({ error: "Too many payment attempts. Please try again after some time." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get lead details first to check phone for test mode
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("create-razorpay-order:lead_not_found", { leadId, leadError });
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test phones can make multiple payments
    const TEST_PHONES = ["8460191818", "7041409801"];
    const leadPhone = (lead.phone || "").replace(/\D/g, "").slice(-10);
    const isTestPhone = TEST_PHONES.includes(leadPhone);

    // Check for existing completed payment (skip for test phones)
    if (!isTestPhone) {
      const { data: completedPayment } = await supabase
        .from("payments")
        .select("id, total_amount, razorpay_order_id, razorpay_payment_id")
        .eq("lead_id", leadId)
        .in("status", ["completed", "captured", "paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (completedPayment) {
        // Return 200 with alreadyPaid flag so frontend can redirect to success page
        return new Response(
          JSON.stringify({
            alreadyPaid: true,
            message: "Payment already completed for this application.",
            payment: {
              orderId: completedPayment.razorpay_order_id,
              paymentId: completedPayment.razorpay_payment_id,
              amount: completedPayment.total_amount,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get consulting fee from settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["consulting_fee", "gst_percentage"]);

    // Test mode: ₹1 for QC testing
    const isTestMode = testMode === true || isTestPhone;
    
    if (isTestMode) {
      console.log("create-razorpay-order:test_mode_enabled", { phone: leadPhone, testMode });
    }
    
    const consultingFee = isTestMode ? 1 : Number(settings?.find(s => s.key === "consulting_fee")?.value || 677);
    const gstPercentage = isTestMode ? 0 : Number(settings?.find(s => s.key === "gst_percentage")?.value || 18);
    const gstAmount = Math.round(consultingFee * gstPercentage / 100);
    const totalAmount = consultingFee + gstAmount;

    // Lead already fetched above for phone check

    // ALWAYS resolve company from request hostname - this ensures payments go to correct company
    // regardless of lead's existing company_id (fixes credit.hariox.com payments going to wrong company)
    const hostname = getHostnameFromRequest(req);
    let resolvedCompanyId: string | null = null;
    let slug = 'hariox';

    if (hostname) {
       // Query by custom_domain first to support custom franchise domains (e.g. finance.fundkredit.com)
       const { data: matchedDomain } = await supabase
         .from("companies")
         .select("id, slug")
         .or(`custom_domain.ilike.%${hostname}%,custom_domain.ilike.%${hostname}/%`)
         .eq("is_active", true)
         .maybeSingle();

       if (matchedDomain) {
         resolvedCompanyId = matchedDomain.id;
         slug = matchedDomain.slug;
       } else {
         const inferredSlug = inferCompanySlugFromHostname(hostname);
         if (inferredSlug) {
           const { data: company } = await supabase
             .from("companies")
             .select("id, slug")
             .eq("slug", inferredSlug)
             .eq("is_active", true)
             .maybeSingle();
           if (company) {
             resolvedCompanyId = company.id;
             slug = company.slug;
           }
         }
       }
    }

    if (!resolvedCompanyId) {
      resolvedCompanyId = lead.company_id ?? null;
      if (resolvedCompanyId) {
        const { data: company } = await supabase
          .from("companies")
          .select("slug")
          .eq("id", resolvedCompanyId)
          .maybeSingle();
        if (company) slug = company.slug;
      }
    }

    // Update lead's company_id if it was NULL or different from hostname-derived company
    if (resolvedCompanyId && lead.company_id !== resolvedCompanyId) {
      await supabase
        .from("leads")
        .update({ company_id: resolvedCompanyId })
        .eq("id", leadId);
    }

    // Create Razorpay order
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: totalAmount * 100, // Razorpay expects amount in paise
        currency: "INR",
        receipt: leadId.substring(0, 40), // Razorpay receipt max 40 chars
        notes: {
          lead_id: leadId,
          lead_name: lead.full_name,
          lead_email: lead.email,
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("create-razorpay-order:razorpay_error", {
        leadId,
        status: orderResponse.status,
        body: errorText,
      });
      return new Response(
        JSON.stringify({
          error: "Failed to create payment order",
          details: {
            provider: "razorpay",
            provider_status: orderResponse.status,
            provider_body: errorText,
          },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const order = await orderResponse.json();

    // Create payment record with company_id from lead
    // payment_source: "direct" = website/marketing, "telecaller" = telecaller collected
    await supabase.from("payments").insert({
      lead_id: leadId,
      company_id: resolvedCompanyId, // Include resolved company_id
      amount: consultingFee,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      payment_source: resolvedPaymentSource,
      razorpay_order_id: order.id,
      status: "pending",
    });

    console.log("create-razorpay-order:success", {
      leadId,
      razorpay_order_id: order.id,
      paymentSource: resolvedPaymentSource,
      totalAmount,
    });

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: totalAmount,
        currency: "INR",
        keyId: razorpayKeyId,
        leadDetails: {
          name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
        },
        breakdown: {
          consultingFee,
          gstPercentage,
          gstAmount,
          totalAmount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-razorpay-order:unhandled_error", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
