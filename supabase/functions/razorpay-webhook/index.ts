import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

serve(async (req) => {
  // Razorpay webhooks don't need CORS, but handle OPTIONS just in case
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    console.log("razorpay-webhook:received", { 
      hasSignature: !!signature, 
      hasSecret: !!webhookSecret,
      bodyLength: rawBody.length 
    });

    // SECURITY: Always require webhook secret + signature. Reject otherwise.
    if (!webhookSecret) {
      console.error("razorpay-webhook:secret_not_configured");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!signature) {
      console.error("razorpay-webhook:missing_signature");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    if (expectedSignature !== signature) {
      console.error("razorpay-webhook:invalid_signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("razorpay-webhook:signature_verified");

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    console.log("razorpay-webhook:event", { event, payload_id: payload.payload?.payment?.entity?.id });

    // Handle payment.captured and payment.authorized events
    if (event === "payment.captured" || event === "payment.authorized") {
      const payment = payload.payload?.payment?.entity;
      
      if (!payment) {
        console.error("razorpay-webhook:no_payment_entity");
        return new Response(JSON.stringify({ error: "No payment entity" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const razorpay_order_id = payment.order_id;
      const razorpay_payment_id = payment.id;
      const leadId = payment.notes?.lead_id;

      console.log("razorpay-webhook:processing", { razorpay_order_id, razorpay_payment_id, leadId });

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check if payment already verified
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id, status, razorpay_payment_id")
        .eq("razorpay_order_id", razorpay_order_id)
        .maybeSingle();

      if (existingPayment?.status === "completed" || existingPayment?.status === "captured") {
        console.log("razorpay-webhook:already_processed", { payment_id: existingPayment.id });

        // Even if already processed, ensure SMS was sent
        const resolvedLeadId2 = existingPayment.lead_id || leadId;
        if (resolvedLeadId2) {
          try {
            const { data: smsSent } = await supabase
              .from("sms_logs")
              .select("id")
              .eq("lead_id", resolvedLeadId2)
              .eq("sms_type", "payment_success")
              .limit(1)
              .maybeSingle();

            if (!smsSent) {
              const { data: lead } = await supabase
                .from("leads")
                .select("phone")
                .eq("id", resolvedLeadId2)
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
                    leadId: resolvedLeadId2,
                  }),
                });
                console.log("razorpay-webhook:catchup_sms_sent", { phone: lead.phone, ok: smsRes.ok });
              }
            }
          } catch (smsErr) {
            console.error("razorpay-webhook:catchup_sms_error", smsErr);
          }
        }

        return new Response(JSON.stringify({ success: true, message: "Already processed" }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // Update payment record
      const { data: updatedPayment, error: paymentError } = await supabase
        .from("payments")
        .update({
          razorpay_payment_id,
          status: "completed",
          payment_date: new Date().toISOString(),
        })
        .eq("razorpay_order_id", razorpay_order_id)
        .select("id, lead_id, amount, gst_amount, total_amount, payment_source, company_id")
        .maybeSingle();

      // For telecaller payments, find the telecaller from call logs (before lead was reassigned)
      if (updatedPayment?.payment_source === 'telecaller' && updatedPayment?.lead_id) {
        // Get the most recent caller for this lead (the telecaller who worked it)
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
          
          console.log("razorpay-webhook:telecaller_attribution", { 
            payment_id: updatedPayment.id, 
            collected_by: callLog.caller_id 
          });
        }
      }

      if (paymentError) {
        console.error("razorpay-webhook:payment_update_error", paymentError);
      }

      const paymentRow = updatedPayment;
      const resolvedLeadId = paymentRow?.lead_id || leadId;

      if (!paymentRow) {
        console.error("razorpay-webhook:payment_not_found", { razorpay_order_id });
        return new Response(JSON.stringify({ error: "Payment record not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Update lead status to paid
      if (resolvedLeadId) {
        const { error: leadError } = await supabase
          .from("leads")
          .update({ status: "paid" })
          .eq("id", resolvedLeadId);

        if (leadError) {
          console.error("razorpay-webhook:lead_update_error", leadError);
        }

        // Stop remarketing cycle since lead has paid
        await supabase
          .from("remarketing_cycles")
          .update({ status: "stopped" })
          .eq("lead_id", resolvedLeadId)
          .eq("status", "active");
        
        console.log("razorpay-webhook:remarketing_stopped", { lead_id: resolvedLeadId });
      }

      // Send payment success SMS via centralized send-sms function (best-effort)
      try {
        if (resolvedLeadId) {
          const { data: lead } = await supabase
            .from("leads")
            .select("phone")
            .eq("id", resolvedLeadId)
            .maybeSingle();

          if (lead?.phone) {
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
                phone: lead.phone,
                leadId: resolvedLeadId,
              }),
            });
            const smsResult = await smsRes.json().catch(() => ({}));
            console.log("razorpay-webhook:sms_result", { ok: smsRes.ok, result: smsResult });
          }
        }
      } catch (smsErr) {
        console.error("razorpay-webhook:sms_error", smsErr);
      }

      // Auto-generate GST invoice
      try {
        const { data: existingInvoice } = await supabase
          .from("gst_invoices")
          .select("id")
          .eq("payment_id", paymentRow.id)
          .limit(1)
          .maybeSingle();

        if (!existingInvoice && resolvedLeadId) {
          const { data: lead } = await supabase
            .from("leads")
            .select("full_name, email, phone")
            .eq("id", resolvedLeadId)
            .single();

          if (lead) {
            const companyId = paymentRow.company_id;
            const { data: invoiceNum } = await supabase.rpc("generate_invoice_number", { p_company_id: companyId });
            const invoiceNumber = invoiceNum || `INV/${Date.now()}`;

            await supabase.from("gst_invoices").insert({
              invoice_number: invoiceNumber,
              lead_id: resolvedLeadId,
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

            console.log("razorpay-webhook:invoice_generated", { payment_id: paymentRow.id, invoiceNumber });
          }
        }
      } catch (invoiceErr) {
        console.error("razorpay-webhook:invoice_error", invoiceErr);
      }

      // Trigger workflows — fire BOTH trigger types to support all workflow configurations
      if (resolvedLeadId) {
        const workflowCompanyId = paymentRow.company_id || null;
        const triggerPayloads = [
          { trigger_type: "payment_received", lead_id: resolvedLeadId, company_id: workflowCompanyId },
          { trigger_type: "status_changed", lead_id: resolvedLeadId, from_status: "unpaid", to_status: "paid", company_id: workflowCompanyId },
        ];
        for (const wfPayload of triggerPayloads) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/execute-workflow`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify(wfPayload),
            });
            console.log("razorpay-webhook:workflow_triggered", { trigger_type: wfPayload.trigger_type, lead_id: resolvedLeadId });
          } catch (wfError) {
            console.error("razorpay-webhook:workflow_error", wfError);
          }
        }
      }

      // --- META CONVERSIONS API (Server-Side Purchase Tracking) ---
      try {
        const { data: leadForCapi } = await supabase
          .from("leads")
          .select("email, phone, meta_fbc, meta_fbp, company_id")
          .eq("id", resolvedLeadId)
          .maybeSingle();

        if (leadForCapi) {
          // Resolve company slug for pixel mapping
          const { data: company } = await supabase
            .from("companies")
            .select("slug")
            .eq("id", leadForCapi.company_id || paymentRow.company_id)
            .maybeSingle();

          await fetch(`${supabaseUrl}/functions/v1/send-meta-capi`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              event_name: "Purchase",
              value: paymentRow.total_amount,
              currency: "INR",
              order_id: razorpay_order_id,
              company_slug: company?.slug || "hariox",
              email: leadForCapi.email,
              phone: leadForCapi.phone,
              fbc: leadForCapi.meta_fbc,
              fbp: leadForCapi.meta_fbp,
            }),
          });
          console.log("razorpay-webhook:capi_purchase_sent", { lead_id: resolvedLeadId });
        }
      } catch (capiErr) {
        console.error("razorpay-webhook:capi_error", capiErr);
      }

      // Log activity
      if (resolvedLeadId) {
        await supabase.from("activity_logs").insert({
          lead_id: resolvedLeadId,
          action: "payment_completed_webhook",
          details: { razorpay_order_id, razorpay_payment_id, event },
        });
      }

      console.log("razorpay-webhook:success", { lead_id: resolvedLeadId, razorpay_payment_id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Handle payment.failed event
    if (event === "payment.failed") {
      const payment = payload.payload?.payment?.entity;
      const razorpay_order_id = payment?.order_id;
      
      console.log("razorpay-webhook:payment_failed", { razorpay_order_id, error: payment?.error_description });

      if (razorpay_order_id) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from("payments")
          .update({ status: "failed" })
          .eq("razorpay_order_id", razorpay_order_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Acknowledge other events
    console.log("razorpay-webhook:unhandled_event", { event });
    return new Response(JSON.stringify({ success: true, message: "Event not processed" }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("razorpay-webhook:error", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
