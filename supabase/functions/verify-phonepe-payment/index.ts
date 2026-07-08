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

// PhonePe API endpoints
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
    // Handle both callback from PhonePe and manual verification
    const url = new URL(req.url);
    const urlOrderId = url.searchParams.get("orderId");
    
    let merchantOrderId: string | null = null;
    let paymentState: string | null = null;
    let transactionId: string | null = null;

    // Check if this is a callback or manual check
    if (req.method === "POST") {
      const body = await req.json();
      console.log("verify-phonepe-payment:callback", body);
      
      // PhonePe Standard Checkout callback format
      // Also handle direct POST with orderId for manual verification
      merchantOrderId = body.orderId || body.merchantOrderId || body.response?.merchantTransactionId;
      paymentState = body.state || body.response?.code;
      transactionId = body.transactionId || body.response?.transactionId;
    } else if (urlOrderId) {
      merchantOrderId = urlOrderId;
    }

    if (!merchantOrderId) {
      return new Response(
        JSON.stringify({ error: "Order ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const phonepeClientId = (Deno.env.get("PHONEPE_CLIENT_ID") || "").trim();
    const phonepeClientSecret = (Deno.env.get("PHONEPE_CLIENT_SECRET") || "").trim();
    const phonepeMerchantId = (Deno.env.get("PHONEPE_MERCHANT_ID") || "").trim();
    const rawClientVersion = (Deno.env.get("PHONEPE_CLIENT_VERSION") || "1").trim();
    const phonepeClientVersion = /^\d+$/.test(rawClientVersion) ? rawClientVersion : "1";
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the payment by transaction ID
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, leads(*)")
      .eq("razorpay_order_id", merchantOrderId)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error("verify-phonepe-payment:payment_not_found", { merchantOrderId, paymentError });
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no state provided, check with PhonePe API
    if (!paymentState) {
      const isSandbox = false; // Always use production PhonePe host since create-phonepe-order does
      const phonepeHost = PHONEPE_HOST_PROD;

      try {
        const authToken = await getPhonePeAuthToken(
          phonepeClientId,
          phonepeClientSecret,
          phonepeClientVersion,
          isSandbox
        );

        const statusResponse = await fetch(
          `${phonepeHost}/checkout/v2/order/${merchantOrderId}/status`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `O-Bearer ${authToken}`,
              "X-MERCHANT-ID": phonepeMerchantId,
            },
          }
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          paymentState = statusData.state;
          transactionId = statusData.orderId;
          console.log("verify-phonepe-payment:status_check", { merchantOrderId, paymentState });
        }
      } catch (statusError) {
        console.error("verify-phonepe-payment:status_check_error", statusError);
      }
    }

    if (paymentState === "COMPLETED" || paymentState === "PAYMENT_SUCCESS") {
      // Update payment status
      const { data: updatedPayment } = await supabase
        .from("payments")
        .update({
          status: "completed",
          razorpay_payment_id: transactionId,
          payment_date: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .select("id, lead_id, payment_source")
        .maybeSingle();

      // For telecaller payments, attribute to the telecaller who worked the lead
      if (updatedPayment?.payment_source === 'telecaller' && updatedPayment?.lead_id) {
        const { data: callLog } = await supabase
          .from("call_logs")
          .select("caller_id")
          .eq("lead_id", updatedPayment.lead_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (callLog?.caller_id) {
          await supabase
            .from("payments")
            .update({ collected_by: callLog.caller_id })
            .eq("id", updatedPayment.id);
          
          console.log("verify-phonepe-payment:telecaller_attribution", { 
            payment_id: updatedPayment.id, 
            collected_by: callLog.caller_id 
          });
        }
      }

      // Update lead status to paid
      await supabase
        .from("leads")
        .update({ status: "paid" })
        .eq("id", payment.lead_id);

      // Trigger workflow for payment received
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        await fetch(`${supabaseUrl}/functions/v1/execute-workflow`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            trigger_type: "payment_received",
            lead_id: payment.lead_id,
            from_status: "unpaid",
            to_status: "paid",
          }),
        });
        console.log("verify-phonepe-payment:workflow_triggered", { lead_id: payment.lead_id });
      } catch (wfError) {
        console.error("verify-phonepe-payment:workflow_error", wfError);
      }

      // Generate GST invoice
      const lead = payment.leads;
      if (lead) {
        const companyId = payment.company_id;
        const { data: invoiceNum } = await supabase.rpc("generate_invoice_number", { p_company_id: companyId });
        await supabase.from("gst_invoices").insert({
          invoice_number: invoiceNum || `INV/${Date.now()}`,
          lead_id: payment.lead_id,
          payment_id: payment.id,
          company_id: companyId,
          customer_name: lead.full_name,
          customer_email: lead.email,
          customer_phone: lead.phone,
          amount: payment.amount,
          gst_amount: payment.gst_amount,
          total_amount: payment.total_amount,
        });
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        lead_id: payment.lead_id,
        action: "payment_completed",
        details: {
          provider: "phonepe",
          transaction_id: transactionId,
          merchant_order_id: merchantOrderId,
          amount: payment.total_amount,
        },
      });

      // Send payment success SMS via centralized send-sms function (best-effort)
      try {
        const lead = payment.leads as any;
        const phone = lead?.phone;
        if (phone) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              type: "payment_success",
              phone,
              leadId: payment.lead_id,
            }),
          });
          const smsResult = await smsRes.json().catch(() => ({}));
          console.log("verify-phonepe-payment:sms_result", { ok: smsRes.ok, result: smsResult });
        }
      } catch (smsErr) {
        console.error("verify-phonepe-payment:sms_error", smsErr);
      }

      console.log("verify-phonepe-payment:success", { merchantOrderId, transactionId });
      
      return new Response(
        JSON.stringify({ success: true, status: "completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (paymentState === "FAILED" || paymentState === "PAYMENT_ERROR") {
      // Payment failed
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment.id);

      console.log("verify-phonepe-payment:failed", { merchantOrderId, paymentState });
      
      return new Response(
        JSON.stringify({ success: false, status: "failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Still pending
      console.log("verify-phonepe-payment:pending", { merchantOrderId, paymentState });
      
      return new Response(
        JSON.stringify({ success: true, status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("verify-phonepe-payment:unhandled_error", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: { message: error instanceof Error ? error.message : String(error) },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
