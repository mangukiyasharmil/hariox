import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

serve(async (req) => {
  // Dynamic CORS headers to handle all required headers
  const requestedHeaders = req.headers.get("Access-Control-Request-Headers") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders || "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, leadId } = await req.json();

    console.log("verify-razorpay-payment:request", { razorpay_order_id, razorpay_payment_id, leadId });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !leadId) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!razorpayKeySecret || !supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("Invalid signature", { expected: expectedSignature, received: razorpay_signature });
      return new Response(
        JSON.stringify({ error: "Invalid payment signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Signature verified successfully");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if payment already processed (webhook may have beaten us)
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status, lead_id, amount, gst_amount, total_amount, company_id")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (existingPayment?.status === "completed" || existingPayment?.status === "captured") {
      console.log("verify-razorpay-payment:already_processed", { payment_id: existingPayment.id });
      
      // Even if already processed, ensure payment success SMS was sent
      try {
        const { data: smsSent } = await supabase
          .from("sms_logs")
          .select("id")
          .eq("lead_id", leadId)
          .eq("sms_type", "payment_success")
          .limit(1)
          .maybeSingle();

        if (!smsSent) {
          const { data: lead } = await supabase
            .from("leads")
            .select("phone")
            .eq("id", leadId)
            .maybeSingle();

          if (lead?.phone) {
            const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                type: "payment_success",
                phone: lead.phone,
                leadId,
              }),
            });
            console.log("verify-razorpay-payment:catchup_sms_sent", { phone: lead.phone, ok: smsRes.ok });
          }
        } else {
          console.log("verify-razorpay-payment:sms_already_sent", { lead_id: leadId });
        }
      } catch (smsErr) {
        console.error("verify-razorpay-payment:catchup_sms_error", smsErr);
      }

      return new Response(
        JSON.stringify({ success: true, status: "completed", message: "Already processed by webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update payment record
    const { data: updatedPayment, error: paymentError } = await supabase
      .from("payments")
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: "completed",
        payment_date: new Date().toISOString(),
      })
      .eq("razorpay_order_id", razorpay_order_id)
      .select("id, lead_id, amount, gst_amount, total_amount, company_id");

    if (paymentError) {
      console.error("Payment update error:", paymentError);
    }

    const paymentRow = updatedPayment?.[0];
    if (!paymentRow) {
      console.error("No payment row found/updated for order", { razorpay_order_id });
      return new Response(
        JSON.stringify({ error: "Payment record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update lead status to paid
    const { error: leadError } = await supabase
      .from("leads")
      .update({ status: "paid" })
      .eq("id", leadId);

    if (leadError) {
      console.error("Lead update error:", leadError);
    }

    // Stop remarketing cycle since lead has paid
    await supabase
      .from("remarketing_cycles")
      .update({ status: "stopped" })
      .eq("lead_id", leadId)
      .eq("status", "active");
    
    console.log("verify-razorpay-payment:remarketing_stopped", { lead_id: leadId });

    // Trigger workflows for payment received — fire BOTH trigger types to support all workflow configurations
    const workflowCompanyId = paymentRow.company_id || null;
    const triggerPayloads = [
      { trigger_type: "payment_received", lead_id: leadId, company_id: workflowCompanyId },
      { trigger_type: "status_changed", lead_id: leadId, from_status: "unpaid", to_status: "paid", company_id: workflowCompanyId },
    ];
    for (const payload of triggerPayloads) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/execute-workflow`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(payload),
        });
        console.log("verify-razorpay-payment:workflow_triggered", { trigger_type: payload.trigger_type, lead_id: leadId });
      } catch (wfError) {
        console.error("verify-razorpay-payment:workflow_error", wfError);
      }
    }

    // Send payment success SMS via centralized send-sms function (best-effort)
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("phone")
        .eq("id", leadId)
        .maybeSingle();

      if (lead?.phone) {
        const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            type: "payment_success",
            phone: lead.phone,
            leadId,
          }),
        });
        const smsResult = await smsRes.json().catch(() => ({}));
        console.log("verify-razorpay-payment:sms_result", { ok: smsRes.ok, result: smsResult });
      }
    } catch (smsErr) {
      console.error("verify-razorpay-payment:sms_error", smsErr);
    }

    // Auto-generate GST invoice for direct (online) payments
    try {
      const { data: existingInvoice, error: existingInvoiceError } = await supabase
        .from("gst_invoices")
        .select("id")
        .eq("payment_id", paymentRow.id)
        .limit(1)
        .maybeSingle();

      if (existingInvoiceError) {
        console.error("GST invoice lookup error:", existingInvoiceError);
      }

      if (!existingInvoice) {
        const { data: lead, error: leadFetchError } = await supabase
          .from("leads")
          .select("full_name, email, phone")
          .eq("id", leadId)
          .single();

        if (leadFetchError) {
          console.error("Lead fetch error for invoice:", leadFetchError);
        } else {
          const companyId = paymentRow.company_id;
          const { data: invoiceNum, error: invoiceNumError } = await supabase.rpc(
            "generate_invoice_number",
            { p_company_id: companyId }
          );

          if (invoiceNumError) {
            console.error("Invoice number generation error:", invoiceNumError);
          }

          const invoiceNumber = invoiceNum || `INV/${Date.now()}`;

          const { error: invoiceInsertError } = await supabase.from("gst_invoices").insert({
            invoice_number: invoiceNumber,
            lead_id: leadId,
            payment_id: paymentRow.id,
            company_id: companyId,
            customer_name: lead.full_name,
            customer_email: lead.email,
            customer_phone: lead.phone,
            amount: paymentRow.amount,
            gst_amount: paymentRow.gst_amount,
            total_amount: paymentRow.total_amount,
            invoice_date: new Date().toISOString().split("T")[0],
            status: "generated",
          });

          if (invoiceInsertError) {
            console.error("GST invoice insert error:", invoiceInsertError);
          } else {
            console.log("GST invoice generated", { payment_id: paymentRow.id, invoiceNumber });
          }
        }
      } else {
        console.log("GST invoice already exists", { payment_id: paymentRow.id, invoice_id: existingInvoice.id });
      }
    } catch (invoiceErr) {
      console.error("GST invoice generation exception:", invoiceErr);
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: "payment_completed",
      details: {
        razorpay_order_id,
        razorpay_payment_id,
        payment_source: "direct",
      },
    });

    console.log("verify-razorpay-payment:success", { leadId, razorpay_payment_id });

    return new Response(
      JSON.stringify({ success: true, message: "Payment verified successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-razorpay-payment:error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
