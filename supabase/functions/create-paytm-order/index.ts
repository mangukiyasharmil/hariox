import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v1.7.0";

// Paytm checksum implementation - exact port from official Node SDK
// https://github.com/paytm/Paytm_Node_Checksum/blob/master/PaytmChecksum.js
const PAYTM_IV = "@@@@&&&&####$$$$"; // 16 bytes
const encoder = new TextEncoder();
const ivBytes = encoder.encode(PAYTM_IV);

// Generate random salt like Paytm: randomBytes(length * 3/4) then base64
async function generateRandomSalt(length: number): Promise<string> {
  const byteLength = Math.ceil((length * 3.0) / 4.0);
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  // Convert to base64 and take first `length` chars
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).slice(0, length);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// SHA-256 hash as hex string
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// PKCS7 padding for AES
function pkcs7Pad(data: Uint8Array, blockSize = 16): Uint8Array {
  const padLen = blockSize - (data.length % blockSize);
  const out = new Uint8Array(data.length + padLen);
  out.set(data);
  out.fill(padLen, data.length);
  return out;
}

// AES-128-CBC encrypt with "binary" input (like Node's cipher.update(input, 'binary', 'base64'))
// "binary" in Node means Latin-1 encoding - each byte maps to char code
// NOTE: WebCrypto's encrypt() applies PKCS7 padding automatically
async function aesEncrypt(input: string, key: string): Promise<string> {
  // Key must be exactly 16 bytes for AES-128
  // Node.js createCipheriv treats string keys as UTF-8
  const keyUtf8 = encoder.encode(key);
  const keyBytes = new Uint8Array(16);
  keyBytes.set(keyUtf8.slice(0, 16));

  // "binary" encoding: each character's char code is one byte
  const inputBytes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    inputBytes[i] = input.charCodeAt(i) & 0xff;
  }

  // IV as bytes
  const iv = new Uint8Array(16);
  for (let i = 0; i < PAYTM_IV.length; i++) {
    iv[i] = PAYTM_IV.charCodeAt(i) & 0xff;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );

  // WebCrypto applies PKCS7 padding automatically
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: iv },
    cryptoKey,
    inputBytes,
  );

  return bytesToBase64(new Uint8Array(cipherBuf));
}

// Calculate hash: sha256(params + "|" + salt).hex() + salt
async function calculateHash(params: string, salt: string): Promise<string> {
  const finalString = params + "|" + salt;
  const hash = await sha256Hex(finalString);
  return hash + salt;
}

// Calculate checksum: encrypt(hash + salt, key)
async function calculateChecksum(params: string, key: string, salt: string): Promise<string> {
  const hashString = await calculateHash(params, salt);
  return await aesEncrypt(hashString, key);
}

// Main signature generation - matches Paytm's generateSignatureByString
async function generatePaytmSignature(body: string, key: string): Promise<string> {
  const salt = await generateRandomSalt(4);
  console.log(`[DEBUG] Salt: ${salt}, Salt length: ${salt.length}`);
  const hashString = await calculateHash(body, salt);
  console.log(`[DEBUG] Hash string length: ${hashString.length}, ends with salt: ${hashString.endsWith(salt)}`);
  const signature = await aesEncrypt(hashString, key);
  console.log(`[DEBUG] Signature length: ${signature.length}`);
  return signature;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  console.log(`[${VERSION}] Request received`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, amount, customerName, customerEmail, customerPhone, callbackUrl, testMode, returnUrl } = await req.json();

    if (!leadId) {
      throw new Error('Lead ID is required');
    }

    const merchantId = Deno.env.get('PAYTM_MERCHANT_ID');
    const merchantKey = Deno.env.get('PAYTM_MERCHANT_KEY');

    if (!merchantId || !merchantKey) {
      throw new Error('Paytm credentials not configured');
    }

    console.log(`[${VERSION}] MID: ${merchantId}, Key length: ${merchantKey.length}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get lead details first to check phone for test mode
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error(`[${VERSION}] Lead not found:`, leadId);
      throw new Error('Lead not found');
    }

    // Get Capital Hariox company ID
    const { data: capitalCompany } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', '%capital%')
      .maybeSingle();

    const companyId = capitalCompany?.id || lead.company_id;

    // Test mode: ₹1 for QC testing (phones 8460191818 or 7041409801)
    const TEST_PHONES = ["8460191818", "7041409801"];
    const leadPhone = (lead.phone || "").replace(/\D/g, "").slice(-10);
    const isTestMode = testMode === true || TEST_PHONES.includes(leadPhone);
    
    if (isTestMode) {
      console.log(`[${VERSION}] Test mode enabled for phone: ${leadPhone}`);
    }

    // Capital Hariox consulting fee: ₹399 + 18% GST
    const consultingFee = isTestMode ? 1 : 399;
    const gstPercentage = isTestMode ? 0 : 18;
    const gstAmount = Math.round(consultingFee * gstPercentage / 100);
    const totalAmount = consultingFee + gstAmount;

    // Create order ID - alphanumeric only, max 50 chars
    const orderId = `PAYTM${Date.now()}${leadId.replace(/-/g, '').slice(0, 8)}`.slice(0, 50);

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        lead_id: leadId,
        amount: consultingFee,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        status: 'pending',
        payment_source: 'direct',
        razorpay_order_id: orderId,
        company_id: companyId,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Use updated production endpoint as per Paytm's request
    const paytmHost = 'https://secure.paytmpayments.com';
    const websiteName = 'DEFAULT';

    // Use our dedicated webhook endpoint for Paytm callbacks
    // Configure this URL in Paytm merchant dashboard for server-to-server notifications
    const paytmCallbackUrl = `${supabaseUrl}/functions/v1/paytm-webhook`;
    
    const cleanMobile = (customerPhone || "").replace(/\D/g, "").slice(-10);
    const txnBody = {
      body: {
        requestType: "Payment",
        mid: merchantId,
        websiteName,
        orderId: orderId,
        callbackUrl: paytmCallbackUrl,
        txnAmount: {
          value: totalAmount.toFixed(2),
          currency: "INR",
        },
        userInfo: {
          custId: leadId.replace(/-/g, "").slice(0, 32),
          ...(cleanMobile ? { mobile: cleanMobile } : {}),
          ...(customerEmail ? { email: customerEmail } : {}),
        },
      },
      head: {
        // Per Paytm Initiate Transaction API docs
        version: "v1",
        channelId: "WEB",
        requestTimestamp: `${Date.now()}`,
        signature: "",
      },
    };

    // Generate signature for the body (JSON string)
    const bodyString = JSON.stringify(txnBody.body);
    const signature = await generatePaytmSignature(bodyString, merchantKey);
    txnBody.head.signature = signature;

    console.log(`[${VERSION}] Initiating Paytm transaction for order: ${orderId}`);
    console.log(`[${VERSION}] Full body: ${bodyString}`);
    console.log(`[${VERSION}] Signature: ${signature}`);
    console.log(`[${VERSION}] Key first 4 chars: ${merchantKey.slice(0, 4)}***`);

    // Call Paytm Initiate Transaction API
    const initUrl = `${paytmHost}/theia/api/v1/initiateTransaction?mid=${merchantId}&orderId=${orderId}`;
    const initResponse = await fetch(
      initUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(txnBody),
      }
    );

    console.log(`[${VERSION}] Paytm initiate HTTP status: ${initResponse.status} ${initResponse.statusText}`);
    console.log(`[${VERSION}] Paytm initiate URL: ${initUrl}`);

    const initData = await initResponse.json();
    console.log(`[${VERSION}] Paytm initiate response:`, JSON.stringify(initData));

    if (initData.body?.resultInfo?.resultStatus !== 'S') {
      const errorMsg = initData.body?.resultInfo?.resultMsg || 'Failed to initiate Paytm transaction';
      const errorCode = initData.body?.resultInfo?.resultCode || 'UNKNOWN';
      console.error(`[${VERSION}] Paytm init failed: ${errorCode} - ${errorMsg}`);
      throw new Error(`${errorMsg} (Code: ${errorCode})`);
    }

    const txnToken = initData.body?.txnToken;
    if (!txnToken) {
      throw new Error('No transaction token received from Paytm');
    }

    console.log(`[${VERSION}] Paytm order created: ${orderId}, Token received`);

    // Return the redirect URL for Paytm payment page
    return new Response(JSON.stringify({
      success: true,
      orderId,
      paymentId: payment.id,
      amount: totalAmount,
      consultingFee,
      gstAmount,
      txnToken,
      mid: merchantId,
      paymentUrl: `${paytmHost}/theia/api/v1/showPaymentPage?mid=${merchantId}&orderId=${orderId}`,
      _version: VERSION,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${VERSION}] Error creating Paytm order:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      _version: VERSION,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
