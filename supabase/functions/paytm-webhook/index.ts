import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Paytm checksum verification using WebCrypto (AES-128-CBC + SHA-256)
const PAYTM_IV = "@@@@&&&&####$$$$";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pkcs7Unpad(data: Uint8Array) {
  const padLen = data[data.length - 1];
  if (padLen < 1 || padLen > 16) return data;
  return data.slice(0, data.length - padLen);
}

async function aesCbcDecrypt(cipherBase64: string, merchantKey: string) {
  const keyBytes = encoder.encode(merchantKey);
  const ivBytes = encoder.encode(PAYTM_IV);
  
  if (keyBytes.length !== 16) {
    throw new Error("Invalid PAYTM_MERCHANT_KEY: must be 16 characters");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  const cipherBytes = decodeBase64(cipherBase64);
  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: ivBytes },
    cryptoKey,
    new Uint8Array(cipherBytes).buffer,
  );

  const unpadded = pkcs7Unpad(new Uint8Array(decryptedBuf));
  return decoder.decode(unpadded);
}

function getParamString(params: Record<string, string>) {
  const keys = Object.keys(params).sort();
  return keys
    .map((k) => (params[k] ?? "").toString().replace(/\|/g, ""))
    .join("|");
}

async function verifyChecksum(params: Record<string, string>, checksum: string, merchantKey: string): Promise<boolean> {
  try {
    const paramsWithoutChecksum = { ...params };
    delete (paramsWithoutChecksum as Record<string, string>).CHECKSUMHASH;

    const payload = getParamString(paramsWithoutChecksum);
    const decrypted = await aesCbcDecrypt(checksum, merchantKey);
    const salt = decrypted.slice(-4);
    const hash = decrypted.slice(0, -4);

    const newHash = await sha256Hex(`${payload}|${salt}`);
    return newHash === hash;
  } catch (err) {
    console.error("paytm-webhook:checksum_error", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log("paytm-webhook:received", { method: req.method, url: req.url });

  try {
    const merchantKey = Deno.env.get('PAYTM_MERCHANT_KEY');
    if (!merchantKey) {
      console.error("paytm-webhook:no_merchant_key");
      throw new Error('Paytm merchant key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let paytmResponse: Record<string, string> = {};

    // Handle both POST (webhook callback) and GET (redirect) requests
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const body = await req.json();
        paytmResponse = body;
      } else if (contentType.includes('form')) {
        const formData = await req.formData();
        formData.forEach((value, key) => {
          paytmResponse[key] = value.toString();
        });
      } else {
        // Try parsing as JSON first, then form data
        const text = await req.text();
        try {
          paytmResponse = JSON.parse(text);
        } catch {
          const params = new URLSearchParams(text);
          params.forEach((value, key) => {
            paytmResponse[key] = value;
          });
        }
      }
    } else {
      const url = new URL(req.url);
      paytmResponse = Object.fromEntries(url.searchParams);
    }

    console.log("paytm-webhook:payload", paytmResponse);

    const {
      ORDERID,
      TXNID,
      STATUS,
      TXNAMOUNT,
      CHECKSUMHASH,
      RESPMSG,
    } = paytmResponse;

    if (!ORDERID) {
      console.error("paytm-webhook:no_order_id");
      return new Response(JSON.stringify({ error: 'No order ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('paytm-webhook:processing', { ORDERID, STATUS, TXNID });

    // SECURITY: Checksum is mandatory for all Paytm webhooks
    if (!CHECKSUMHASH) {
      console.error('paytm-webhook:missing_checksum', { ORDERID });
      return new Response(JSON.stringify({ error: 'Missing checksum' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const valid = await verifyChecksum(paytmResponse, CHECKSUMHASH, merchantKey);
    if (!valid) {
      console.error('paytm-webhook:checksum_failed', { ORDERID });
      return new Response(JSON.stringify({ error: 'Checksum verification failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('paytm-webhook:checksum_verified', { ORDERID });

    // Find the payment record
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, leads(*)')
      .eq('razorpay_order_id', ORDERID)
      .maybeSingle();

    if (fetchError || !payment) {
      console.error('paytm-webhook:payment_not_found', { ORDERID, fetchError });
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip if already processed
    if (payment.status === 'completed' || payment.status === 'captured') {
      console.log('paytm-webhook:already_processed', { ORDERID, status: payment.status });
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSuccess = STATUS === 'TXN_SUCCESS';

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: isSuccess ? 'completed' : 'failed',
        razorpay_payment_id: TXNID,
        payment_date: isSuccess ? new Date().toISOString() : null,
      })
      .eq('id', payment.id)
      .select('id, lead_id, payment_source')
      .maybeSingle();

    if (updateError) {
      console.error('paytm-webhook:update_error', updateError);
      throw updateError;
    }

    console.log('paytm-webhook:payment_updated', { ORDERID, isSuccess });

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
        
        console.log("paytm-webhook:telecaller_attribution", { 
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
        console.log("paytm-webhook:workflow_triggered", { lead_id: payment.lead_id });
      } catch (wfError) {
        console.error("paytm-webhook:workflow_error", wfError);
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
          console.log("paytm-webhook:invoice_created", { lead_id: payment.lead_id });
        } catch (invoiceErr) {
          console.error("paytm-webhook:invoice_error", invoiceErr);
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
              order_id: ORDERID,
              company_slug: company?.slug || "hariox",
              email: leadForCapi.email,
              phone: leadForCapi.phone,
              fbc: leadForCapi.meta_fbc,
              fbp: leadForCapi.meta_fbp,
            }),
          });
          console.log("paytm-webhook:capi_purchase_sent", { lead_id: payment.lead_id });
        }
      } catch (capiErr) {
        console.error("paytm-webhook:capi_error", capiErr);
      }

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          lead_id: payment.lead_id,
          action: 'payment_completed',
          details: {
            provider: 'paytm',
            amount: TXNAMOUNT,
            transaction_id: TXNID,
            order_id: ORDERID,
            webhook: true,
          }
        });
    }

    console.log('paytm-webhook:success', { ORDERID, isSuccess });

    return new Response(JSON.stringify({
      success: true,
      status: isSuccess ? 'completed' : 'failed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('paytm-webhook:error', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
