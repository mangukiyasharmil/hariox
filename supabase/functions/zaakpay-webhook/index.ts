import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

serve(async (req) => {
  // Handle OPTIONS request for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const zaakpaySecret = Deno.env.get("ZAAKPAY_SECRET_KEY"); // If checksum validation is needed

    // Check if the payload is JSON or Form-Data
    let payload: any;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      // Fallback
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch (e) {
        payload = {};
      }
    }

    console.log("zaakpay-webhook:received", { payload });

    const orderId = payload.orderId;
    const responseCode = payload.responseCode;
    const responseDescription = payload.responseDescription;
    const checksumString = payload.checksumString;
    const udf1 = payload.udf1; // Often used for lead_id

    if (!orderId) {
      console.error("zaakpay-webhook:missing_orderId");
      return new Response(JSON.stringify({ error: "Missing orderId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if the payment already exists
    let { data: payment } = await supabase
      .from("payments")
      .select("id, status, lead_id, company_id, amount, gst_amount, total_amount, payment_source")
      .eq("zaakpay_order_id", orderId)
      .maybeSingle();

    // Determine lead_id (from existing payment or from udf1)
    let leadId = payment?.lead_id || udf1;

    // Check if orderId itself contains the leadId (e.g. leadId_timestamp)
    if (!leadId && orderId && orderId.includes("_")) {
      const potentialLeadId = orderId.split("_")[0];
      if (potentialLeadId && potentialLeadId.length > 20) {
        leadId = potentialLeadId;
      }
    }

    // If payment doesn't exist, try to create it if we have leadId and amount
    if (!payment && leadId && payload.amount) {
      console.log("zaakpay-webhook:creating_missing_payment", { leadId, orderId });
      
      const { data: lead } = await supabase
        .from("leads")
        .select("company_id")
        .eq("id", leadId)
        .maybeSingle();
        
      const amountInt = parseInt(payload.amount) / 100; // Assuming Zaakpay sends in paise
      
      const { data: newPayment, error: insertError } = await supabase
        .from("payments")
        .insert({
          lead_id: leadId,
          company_id: lead?.company_id,
          amount: Math.round(amountInt * 0.82), // Approximate reverse GST
          gst_amount: Math.round(amountInt * 0.18),
          total_amount: amountInt,
          payment_source: "direct",
          zaakpay_order_id: orderId,
          status: "pending"
        })
        .select()
        .single();
        
      if (!insertError && newPayment) {
        payment = newPayment;
      }
    }

    if (!payment) {
      console.error("zaakpay-webhook:payment_not_found", { orderId, leadId });
      return new Response(JSON.stringify({ error: "Payment record not found and could not be created" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Ignore if already processed
    if (payment.status === "completed" || payment.status === "captured") {
      console.log("zaakpay-webhook:already_processed", { payment_id: payment.id });
      return new Response(JSON.stringify({ success: true, message: "Already processed" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Is it a success response? (Zaakpay successful responseCode is '100')
    const isSuccess = responseCode === "100" || String(responseCode) === "100";

    if (!isSuccess) {
      console.log("zaakpay-webhook:payment_failed", { orderId, responseCode, responseDescription });
      await supabase
        .from("payments")
        .update({ 
          status: "failed",
          zaakpay_payment_id: payload.pgTransId || null
        })
        .eq("id", payment.id);
        
      return new Response(JSON.stringify({ success: true, message: "Payment failed logged" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Mark as completed
    const { data: updatedPayment, error: paymentError } = await supabase
      .from("payments")
      .update({
        status: "completed",
        zaakpay_payment_id: payload.pgTransId || null,
        zaakpay_signature: checksumString || null,
        payment_date: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select()
      .single();

    if (paymentError) {
      console.error("zaakpay-webhook:update_error", paymentError);
    }
    
    // Update Lead to Paid
    if (leadId) {
      await supabase
        .from("leads")
        .update({ status: "paid" })
        .eq("id", leadId);

      // Stop remarketing
      await supabase
        .from("remarketing_cycles")
        .update({ status: "stopped" })
        .eq("lead_id", leadId)
        .eq("status", "active");

      // Send Success SMS
      const { data: lead } = await supabase
        .from("leads")
        .select("phone")
        .eq("id", leadId)
        .maybeSingle();

      if (lead?.phone) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              type: "payment_success",
              phone: lead.phone,
              leadId: leadId,
            }),
          });
        } catch (e) {
          console.error("zaakpay-webhook:sms_error", e);
        }
      }

      // Generate Invoice
      try {
        const { data: invoiceNum } = await supabase.rpc("generate_invoice_number", { p_company_id: payment.company_id });
        const invoiceNumber = invoiceNum || `INV/${Date.now()}`;

        const { data: leadDetails } = await supabase
          .from("leads")
          .select("full_name, email, phone")
          .eq("id", leadId)
          .single();

        if (leadDetails) {
          await supabase.from("gst_invoices").insert({
            invoice_number: invoiceNumber,
            lead_id: leadId,
            payment_id: payment.id,
            company_id: payment.company_id,
            customer_name: leadDetails.full_name,
            customer_email: leadDetails.email,
            customer_phone: leadDetails.phone,
            amount: payment.amount,
            gst_amount: payment.gst_amount,
            total_amount: payment.total_amount,
            invoice_date: new Date().toISOString().split("T")[0],
            status: "generated",
          });
        }
      } catch (e) {
        console.error("zaakpay-webhook:invoice_error", e);
      }

      // Trigger Workflows
      try {
        const triggerPayloads = [
          { trigger_type: "payment_received", lead_id: leadId, company_id: payment.company_id },
          { trigger_type: "status_changed", lead_id: leadId, from_status: "unpaid", to_status: "paid", company_id: payment.company_id },
        ];
        for (const wfPayload of triggerPayloads) {
          await fetch(`${supabaseUrl}/functions/v1/execute-workflow`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(wfPayload),
          });
        }
      } catch (e) {
        console.error("zaakpay-webhook:workflow_error", e);
      }
      
      // Activity Log
      await supabase.from("activity_logs").insert({
        lead_id: leadId,
        action: "payment_completed_webhook",
        details: { zaakpay_order_id: orderId, pgTransId: payload.pgTransId },
      });
    }

    console.log("zaakpay-webhook:success", { orderId, leadId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("zaakpay-webhook:unhandled_error", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
