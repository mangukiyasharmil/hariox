import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (req: Request) => {
  const requestedHeaders = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

// PhonePe API endpoints (Standard Checkout v2)
const PHONEPE_HOST_PROD = "https://api.phonepe.com/apis/pg";
const PHONEPE_HOST_SANDBOX = "https://api-preprod.phonepe.com/apis/pg-sandbox";

// Get OAuth token from PhonePe
async function getPhonePeAuthToken(
  clientId: string,
  clientSecret: string,
  clientVersion: string,
  isSandbox: boolean
): Promise<string> {
  const safeClientId = (clientId ?? "").trim();
  const safeClientSecret = (clientSecret ?? "").trim();
  const safeClientVersion = (clientVersion ?? "").trim();
  if (!safeClientId || !safeClientSecret || !safeClientVersion) {
    throw new Error("Missing PhonePe OAuth credentials (client_id/client_secret/client_version)");
  }

  const tokenUrl = isSandbox
    ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
    : "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";

  const params = new URLSearchParams();
  params.append("client_id", safeClientId);
  params.append("client_version", safeClientVersion);
  params.append("client_secret", safeClientSecret);
  params.append("grant_type", "client_credentials");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token fetch failed: ${response.status} - ${errorText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, testMode, paymentSource } = await req.json();

    const validSources = ["direct", "telecaller", "manual", "marketing", "whatsapp", "sms"];
    const resolvedPaymentSource = validSources.includes(paymentSource) ? paymentSource : "direct";

    console.log("create-phonepe-order:request", { leadId, testMode, paymentSource: resolvedPaymentSource });

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "Lead ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const phonepeMerchantId = (Deno.env.get("PHONEPE_MERCHANT_ID") || "").trim();
    const phonepeClientId = (Deno.env.get("PHONEPE_CLIENT_ID") || "").trim();
    const phonepeClientSecret = (Deno.env.get("PHONEPE_CLIENT_SECRET") || "").trim();
    // PhonePe client_version MUST be a numeric string (usually "1", "2", etc.)
    // If stored incorrectly or missing, default to "1".
    const rawClientVersion = (Deno.env.get("PHONEPE_CLIENT_VERSION") || "1").trim();
    const phonepeClientVersion = /^\d+$/.test(rawClientVersion) ? rawClientVersion : "1";

    console.log("create-phonepe-order:credentials_check", {
      hasClientId: !!phonepeClientId,
      hasClientSecret: !!phonepeClientSecret,
      hasMerchantId: !!phonepeMerchantId,
      clientVersion: phonepeClientVersion,
    });

    if (!phonepeMerchantId || !phonepeClientId || !phonepeClientSecret) {
      console.error("create-phonepe-order:missing_credentials");
      return new Response(
        JSON.stringify({ error: "PhonePe credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // RATE LIMITING: Max 3 payment attempts per lead per hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentOrders, error: rateError } = await supabase
      .from("payments")
      .select("created_at")
      .eq("lead_id", leadId)
      .gte("created_at", oneHourAgo);

    if (!rateError && recentOrders && recentOrders.length >= 3) {
      console.warn("create-phonepe-order:rate_limited", { leadId, attempts: recentOrders.length });
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
      console.error("create-phonepe-order:lead_not_found", { leadId, leadError });
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
        .select("id")
        .eq("lead_id", leadId)
        .eq("status", "completed")
        .limit(1)
        .maybeSingle();

      if (completedPayment) {
        return new Response(
          JSON.stringify({ error: "Payment already completed for this application." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      console.log("create-phonepe-order:test_mode_enabled", { phone: leadPhone, testMode });
    }
    
    const consultingFee = isTestMode ? 1 : Number(settings?.find(s => s.key === "consulting_fee")?.value || 677);
    const gstPercentage = isTestMode ? 0 : Number(settings?.find(s => s.key === "gst_percentage")?.value || 18);
    const gstAmount = Math.round(consultingFee * gstPercentage / 100);
    const totalAmount = consultingFee + gstAmount;

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

    // Generate unique order ID
    const merchantOrderId = `TXN_${leadId.substring(0, 8)}_${Date.now()}`;
    
    // Build redirect URL from request origin or fallback to production (reuse hostname from above)
    const baseUrl = hostname 
      ? (hostname.includes("localhost") || hostname.includes("lovable") 
          ? `https://${hostname}` 
          : `https://${hostname}`)
      : "https://credit.hariox.com";
    // Include company param for proper theming on success page
    const companyParam = slug !== 'hariox' ? `&company=${slug}` : '';
    const redirectUrl = `${baseUrl}/payment/success?orderId=${merchantOrderId}${companyParam}`;
    
    // Use dedicated webhook endpoint for PhonePe server-to-server callbacks
    const callbackUrl = `${supabaseUrl}/functions/v1/phonepe-webhook`;

    // Always use production PhonePe - sandbox requires separate credentials
    // testMode only affects pricing (₹1 for QC), not the PhonePe environment
    const isSandbox = false;
    const phonepeHost = PHONEPE_HOST_PROD;
    
    console.log("create-phonepe-order:environment", { isSandbox, redirectUrl, hostname });

    // Get OAuth token
    let authToken: string;
    try {
      authToken = await getPhonePeAuthToken(
        phonepeClientId,
        phonepeClientSecret,
        phonepeClientVersion,
        isSandbox
      );
    } catch (tokenError) {
      console.error("create-phonepe-order:token_error", tokenError);

      // Most common cause: sandbox token called with production credentials (when testMode=true)
      const tokenMessage = tokenError instanceof Error ? tokenError.message : String(tokenError);
      const hint =
        isSandbox && tokenMessage.includes("401")
          ? "Sandbox auth failed. Disable test mode or configure sandbox credentials."
          : !isSandbox && tokenMessage.includes("400")
            ? "Production auth returned 400. Double-check PHONEPE_CLIENT_VERSION (must match PhonePe-provided client_version) and ensure no extra spaces in secrets."
            : undefined;
      return new Response(
        JSON.stringify({
          error: "Failed to authenticate with PhonePe",
          details: {
            message: tokenMessage,
            hint,
            debug: {
              isSandbox,
              client_version: phonepeClientVersion,
            },
          },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Standard Checkout v2 request with callback URL for webhook
    const payloadData = {
      merchantOrderId: merchantOrderId,
      amount: totalAmount * 100, // Amount in paise
      expireAfter: 1200, // 20 minutes
      metaInfo: {
        udf1: lead.phone,
        udf2: lead.full_name,
        udf3: leadId,
      },
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Payment for loan consultation fee",
        merchantUrls: {
          redirectUrl: redirectUrl,
          callbackUrl: callbackUrl, // Server-to-server webhook for payment confirmation
        },
      },
    };
    
    console.log("create-phonepe-order:urls", { redirectUrl, callbackUrl });

    console.log("create-phonepe-order:payload", { merchantOrderId, amount: totalAmount * 100 });

    // Make PhonePe API call
    const phonepeResponse = await fetch(`${phonepeHost}/checkout/v2/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `O-Bearer ${authToken}`,
      },
      body: JSON.stringify(payloadData),
    });

    const phonepeResult = await phonepeResponse.json();

    if (!phonepeResponse.ok || phonepeResult.code) {
      console.error("create-phonepe-order:phonepe_error", {
        leadId,
        status: phonepeResponse.status,
        result: phonepeResult,
      });
      return new Response(
        JSON.stringify({
          error: "Failed to create PhonePe payment",
          details: {
            provider: "phonepe",
            provider_status: phonepeResponse.status,
            provider_message: phonepeResult.message || phonepeResult.code,
          },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payment record
    await supabase.from("payments").insert({
      lead_id: leadId,
      company_id: resolvedCompanyId,
      amount: consultingFee,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      payment_source: resolvedPaymentSource,
      razorpay_order_id: merchantOrderId, // Using this field for PhonePe order ID
      status: "pending",
    });

    console.log("create-phonepe-order:success", {
      leadId,
      merchantOrderId,
      orderId: phonepeResult.orderId,
      paymentSource: resolvedPaymentSource,
      totalAmount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: phonepeResult.redirectUrl,
        transactionId: merchantOrderId,
        orderId: phonepeResult.orderId,
        amount: totalAmount,
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
    console.error("create-phonepe-order:unhandled_error", error);
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
