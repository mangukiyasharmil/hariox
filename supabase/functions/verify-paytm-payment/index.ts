import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Paytm checksum verification using WebCrypto (AES-128-CBC + SHA-256)
const PAYTM_IV = "@@@@&&&&####$$$$";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ivBytes = encoder.encode(PAYTM_IV);

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
    delete (paramsWithoutChecksum as any).CHECKSUMHASH;

    const payload = getParamString(paramsWithoutChecksum);
    const decrypted = await aesCbcDecrypt(checksum, merchantKey);
    const salt = decrypted.slice(-4);
    const hash = decrypted.slice(0, -4);

    const newHash = await sha256Hex(`${payload}|${salt}`);
    return newHash === hash;
  } catch (err) {
    console.error("Checksum verification error:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const merchantKey = Deno.env.get('PAYTM_MERCHANT_KEY');
    if (!merchantKey) {
      throw new Error('Paytm merchant key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let paytmResponse: Record<string, string>;

    // Handle both POST (callback) and GET (redirect) requests
    if (req.method === 'POST') {
      const formData = await req.formData();
      paytmResponse = {};
      formData.forEach((value, key) => {
        paytmResponse[key] = value.toString();
      });
    } else {
      const url = new URL(req.url);
      paytmResponse = Object.fromEntries(url.searchParams);
    }

    const {
      ORDERID,
      TXNID,
      STATUS,
      TXNAMOUNT,
      CHECKSUMHASH,
      RESPMSG,
    } = paytmResponse;

    console.log('Paytm callback received:', { ORDERID, STATUS, TXNID });

    // Verify checksum
    if (CHECKSUMHASH && !(await verifyChecksum(paytmResponse, CHECKSUMHASH, merchantKey))) {
      console.error('Checksum verification failed');
      throw new Error('Checksum verification failed');
    }

    // Find the payment record
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, leads(*)')
      .eq('razorpay_order_id', ORDERID)
      .single();

    if (fetchError || !payment) {
      throw new Error('Payment not found');
    }

    const isSuccess = STATUS === 'TXN_SUCCESS';

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: isSuccess ? 'captured' : 'failed',
        razorpay_payment_id: TXNID, // Using for Paytm transaction ID
        payment_date: isSuccess ? new Date().toISOString() : null,
      })
      .eq('id', payment.id)
      .select('id, lead_id, payment_source, amount, gst_amount, total_amount, company_id')
      .maybeSingle();

    if (updateError) throw updateError;

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
        
        console.log("verify-paytm-payment:telecaller_attribution", { 
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
        console.log("verify-paytm-payment:workflow_triggered", { lead_id: payment.lead_id });
      } catch (wfError) {
        console.error("verify-paytm-payment:workflow_error", wfError);
      }

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          lead_id: payment.lead_id,
          action: 'payment_received',
          details: {
            amount: TXNAMOUNT,
            gateway: 'paytm',
            transaction_id: TXNID,
            order_id: ORDERID,
          }
        });
      
      // Auto-generate GST invoice
      try {
        const { data: existingInvoice } = await supabase
          .from("gst_invoices")
          .select("id")
          .eq("payment_id", updatedPayment?.id)
          .limit(1)
          .maybeSingle();

        if (!existingInvoice && updatedPayment) {
          const { data: lead } = await supabase
            .from("leads")
            .select("full_name, email, phone, company_id")
            .eq("id", payment.lead_id)
            .single();

          if (lead) {
            const companyId = updatedPayment.company_id || lead.company_id;
            const { data: invoiceNum } = await supabase.rpc(
              "generate_invoice_number",
              { p_company_id: companyId }
            );

            const invoiceNumber = invoiceNum || `INV/${Date.now()}`;

            await supabase.from("gst_invoices").insert({
              invoice_number: invoiceNumber,
              lead_id: payment.lead_id,
              payment_id: updatedPayment.id,
              company_id: companyId,
              customer_name: lead.full_name,
              customer_email: lead.email,
              customer_phone: lead.phone,
              amount: updatedPayment.amount,
              gst_amount: updatedPayment.gst_amount,
              total_amount: updatedPayment.total_amount,
              invoice_date: new Date().toISOString().split("T")[0],
              status: "generated",
            });

            console.log("verify-paytm-payment:invoice_generated", { payment_id: updatedPayment.id, invoiceNumber });
          }
        }
      } catch (invoiceErr) {
        console.error("verify-paytm-payment:invoice_error", invoiceErr);
      }
      }

      // Send payment success SMS (best-effort)
      try {
        let smsApiKey = (Deno.env.get("GREENSMS_API_KEY") || "").trim();
        if (smsApiKey.startsWith("http")) {
          try { smsApiKey = new URL(smsApiKey).searchParams.get("apikey") || smsApiKey; } catch {}
        }
        if (smsApiKey) {
          const { data: smsEnabledSetting } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "sms_enabled")
            .maybeSingle();
          const smsEnabled = smsEnabledSetting?.value == null ? true : smsEnabledSetting.value === "true";

          if (smsEnabled) {
            const { data: senderIdSetting } = await supabase
              .from("system_settings")
              .select("value")
              .eq("key", "sms_sender_id")
              .maybeSingle();
            const senderId = (senderIdSetting?.value || "FUNCER").trim();

            const { data: leadData } = await supabase
              .from("leads")
              .select("full_name, phone")
              .eq("id", payment.lead_id)
              .maybeSingle();

            const phone = ((leadData?.phone || "").replace(/\D/g, "")).slice(-10);
            if (phone) {
              const DLT_ENTITY_ID = "1701174159361029653";
              const PAYMENT_TEMPLATE_ID = "1707177046090359201";
              const msg = "Dear Customer, Congratulations! Your loan application has been successfully submitted. Please check your registered email and submit the required documents. Our company executive call you back soon. Thanks & Regards, Hariox Corporate";

              const params = new URLSearchParams({
                username: "HarioxSMS", apikey: smsApiKey, apirequest: "Text",
                sender: senderId, senderid: senderId, mobile: phone, number: phone,
                message: msg, msg: msg, route: "TRANS",
                entityid: DLT_ENTITY_ID, entityId: DLT_ENTITY_ID, entity_id: DLT_ENTITY_ID, dlt_entity_id: DLT_ENTITY_ID,
                templateid: PAYMENT_TEMPLATE_ID, templateId: PAYMENT_TEMPLATE_ID, template_id: PAYMENT_TEMPLATE_ID, tempid: PAYMENT_TEMPLATE_ID, dlt_template_id: PAYMENT_TEMPLATE_ID,
              });
              await fetch(`https://login.greensms.in/sms-panel/api/http/sendsms.php?${params.toString()}`);
              console.log("verify-paytm-payment:sms_sent", { phone });
            }
          }
        }
      } catch (smsErr) {
        console.error("verify-paytm-payment:sms_error", smsErr);
      }

    // Redirect to success/failure page
    // Use the published lovable URL with company=capital param for correct routing
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';
    // Prefer known production domains, fallback to published lovable URL
    let baseUrl = 'https://capital.hariox.com';
    if (origin.includes('hariox') && !origin.includes('supabase')) {
      baseUrl = origin;
    } else if (origin.includes('lovable.app')) {
      baseUrl = origin;
    }
    
    const redirectUrl = isSuccess 
      ? `${baseUrl}/payment/success?order_id=${ORDERID}&txn_id=${TXNID}&company=capital`
      : `${baseUrl}/pay/hariox?error=${encodeURIComponent(RESPMSG || 'Payment failed')}&company=capital`;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error verifying Paytm payment:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
