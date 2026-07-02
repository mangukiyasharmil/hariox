import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-verify',
};

// PhonePe API endpoints
const PHONEPE_HOST_PROD = "https://api.phonepe.com/apis/pg";

// Get OAuth token from PhonePe
async function getPhonePeAuthToken(
  clientId: string,
  clientSecret: string,
  clientVersion: string
): Promise<string> {
  const tokenUrl = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";

  const params = new URLSearchParams();
  params.append("client_id", clientId.trim());
  params.append("client_version", clientVersion.trim());
  params.append("client_secret", clientSecret.trim());
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log("phonepe-webhook:received", { method: req.method, url: req.url });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const phonepeClientId = (Deno.env.get("PHONEPE_CLIENT_ID") || "").trim();
    const phonepeClientSecret = (Deno.env.get("PHONEPE_CLIENT_SECRET") || "").trim();
    const phonepeMerchantId = (Deno.env.get("PHONEPE_MERCHANT_ID") || "").trim();
    const rawClientVersion = (Deno.env.get("PHONEPE_CLIENT_VERSION") || "1").trim();
    const phonepeClientVersion = /^\d+$/.test(rawClientVersion) ? rawClientVersion : "1";

    const supabase = createClient(supabaseUrl, supabaseKey);

    let webhookPayload: Record<string, unknown> = {};
    let merchantOrderId: string | null = null;
    let paymentState: string | null = null;
    let transactionId: string | null = null;

    // Handle callback from PhonePe
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        webhookPayload = await req.json();
      } else {
        const text = await req.text();
        try {
          webhookPayload = JSON.parse(text);
        } catch {
          const params = new URLSearchParams(text);
          params.forEach((value, key) => {
            webhookPayload[key] = value;
          });
        }
      }
    }

    console.log("phonepe-webhook:payload", webhookPayload);

    // PhonePe Standard Checkout v2 callback format
    // The webhook wraps data inside a "payload" object
    const nested = (webhookPayload.payload || webhookPayload) as Record<string, unknown>;
    const responseObj = (webhookPayload.response || nested.response) as Record<string, unknown> | undefined;
    
    merchantOrderId = (nested.merchantOrderId || 
                       nested.orderId || 
                       nested.merchantTransactionId ||
                       webhookPayload.merchantOrderId ||
                       webhookPayload.orderId ||
                       responseObj?.merchantTransactionId) as string | null;
    
    paymentState = (nested.state || 
                    nested.code ||
                    webhookPayload.state ||
                    responseObj?.code) as string | null;
    
    transactionId = (nested.transactionId || 
                     nested.orderId ||
                     webhookPayload.transactionId ||
                     responseObj?.transactionId) as string | null;
    
    // Extract PhonePe transaction ID from paymentDetails if available
    const paymentDetails = (nested.paymentDetails as Array<Record<string, unknown>>) || [];
    if (!transactionId && paymentDetails.length > 0) {
      transactionId = paymentDetails[0]?.transactionId as string || null;
    }

    if (!merchantOrderId) {
      console.error("phonepe-webhook:no_order_id", webhookPayload);
      return new Response(JSON.stringify({ error: 'No order ID in webhook' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("phonepe-webhook:processing", { merchantOrderId, paymentState, transactionId });

    // Find the payment record
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, leads(*)')
      .eq('razorpay_order_id', merchantOrderId)
      .maybeSingle();

    if (fetchError || !payment) {
      console.error('phonepe-webhook:payment_not_found', { merchantOrderId, fetchError });
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip if already processed
    if (payment.status === 'completed' || payment.status === 'captured') {
      console.log('phonepe-webhook:already_processed', { merchantOrderId, status: payment.status });
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SECURITY: Always re-verify payment state with PhonePe server-side.
    // Never trust the webhook payload's state field alone (no signature verification).
    try {
      const authToken = await getPhonePeAuthToken(
        phonepeClientId,
        phonepeClientSecret,
        phonepeClientVersion
      );

      const statusResponse = await fetch(
        `${PHONEPE_HOST_PROD}/checkout/v2/order/${merchantOrderId}/status`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `O-Bearer ${authToken}`,
            "X-MERCHANT-ID": phonepeMerchantId,
          },
        }
      );

      if (!statusResponse.ok) {
        const errText = await statusResponse.text();
        console.error("phonepe-webhook:status_check_failed", { merchantOrderId, status: statusResponse.status, errText });
        return new Response(JSON.stringify({ error: 'Unable to verify payment with PhonePe' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const statusData = await statusResponse.json();
      paymentState = statusData.state;
      transactionId = statusData.orderId || transactionId;
      console.log("phonepe-webhook:status_verified", { merchantOrderId, paymentState });
    } catch (statusError) {
      console.error("phonepe-webhook:status_check_error", statusError);
      return new Response(JSON.stringify({ error: 'Verification error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSuccess = paymentState === 'COMPLETED' || paymentState === 'PAYMENT_SUCCESS';
    const isFailed = paymentState === 'FAILED' || paymentState === 'PAYMENT_ERROR';

    if (!isSuccess && !isFailed) {
      console.log('phonepe-webhook:pending', { merchantOrderId, paymentState });
      return new Response(JSON.stringify({ success: true, status: 'pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: isSuccess ? 'completed' : 'failed',
        razorpay_payment_id: transactionId,
        payment_date: isSuccess ? new Date().toISOString() : null,
      })
      .eq('id', payment.id)
      .select('id, lead_id, payment_source')
      .maybeSingle();

    if (updateError) {
      console.error('phonepe-webhook:update_error', updateError);
      throw updateError;
    }

    console.log('phonepe-webhook:payment_updated', { merchantOrderId, isSuccess });

    // For telecaller payments, attribute to the telecaller who worked the lead
    if (isSuccess && updatedPayment?.payment_source === 'telecaller' && updatedPayment?.lead_id) {
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
        
        console.log("phonepe-webhook:telecaller_attribution", { 
          payment_id: updatedPayment.id, 
          collected_by: callLog.caller_id 
        });
      }
    }

    // Update lead status if payment successful
    if (isSuccess && payment.lead_id) {
      await supabase
        .from('leads')
        .update({ 
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.lead_id);

      // Trigger workflow for payment received
      try {
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
        console.log("phonepe-webhook:workflow_triggered", { lead_id: payment.lead_id });
      } catch (wfError) {
        console.error("phonepe-webhook:workflow_error", wfError);
      }

      // Generate GST invoice
      const lead = payment.leads;
      if (lead) {
        try {
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
          console.log("phonepe-webhook:invoice_created", { lead_id: payment.lead_id });
        } catch (invoiceErr) {
          console.error("phonepe-webhook:invoice_error", invoiceErr);
        }
      }

      // --- META CONVERSIONS API (Server-Side Purchase Tracking) ---
      try {
        const leadForCapi = payment.leads;
        if (leadForCapi) {
          const { data: company } = await supabase
            .from("companies")
            .select("slug")
            .eq("id", payment.company_id)
            .maybeSingle();

          await fetch(`${supabaseUrl}/functions/v1/send-meta-capi`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              event_name: "Purchase",
              value: payment.total_amount,
              currency: "INR",
              order_id: merchantOrderId,
              company_slug: company?.slug || "hariox",
              email: leadForCapi.email,
              phone: leadForCapi.phone,
              fbc: leadForCapi.meta_fbc,
              fbp: leadForCapi.meta_fbp,
            }),
          });
          console.log("phonepe-webhook:capi_purchase_sent", { lead_id: payment.lead_id });
        }
      } catch (capiErr) {
        console.error("phonepe-webhook:capi_error", capiErr);
      }

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          lead_id: payment.lead_id,
          action: 'payment_completed',
          details: {
            provider: 'phonepe',
            transaction_id: transactionId,
            order_id: merchantOrderId,
            webhook: true,
          }
        });
    }

    console.log('phonepe-webhook:success', { merchantOrderId, isSuccess });

    return new Response(JSON.stringify({
      success: true,
      status: isSuccess ? 'completed' : 'failed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('phonepe-webhook:error', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
