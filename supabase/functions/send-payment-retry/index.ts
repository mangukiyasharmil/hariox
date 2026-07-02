import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RetryPaymentRequest {
  lead_id: string;
  channel: "sms" | "whatsapp" | "both";
  company_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, channel, company_id }: RetryPaymentRequest = await req.json();

    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: "lead_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, full_name, phone, loan_type, loan_amount, email, company_id")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there's a failed/pending payment
    const { data: failedPayment } = await supabase
      .from("payments")
      .select("id, razorpay_order_id, status")
      .eq("lead_id", lead_id)
      .neq("status", "completed")
      .neq("status", "captured")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Determine company for payment link
    const effectiveCompanyId = company_id || lead.company_id;
    let domain = "credit.hariox.com";
    
    if (effectiveCompanyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("slug, website_url")
        .eq("id", effectiveCompanyId)
        .single();
      
      if (company?.website_url) {
        domain = company.website_url.replace(/^https?:\/\//, "");
      } else if (company?.slug) {
        const slugToDomain: Record<string, string> = {
          hariox: "credit.hariox.com",
          finance: "finance.hariox.com",
          capital: "capital.hariox.com",
        };
        domain = slugToDomain[company.slug] || "credit.hariox.com";
      }
    }

    // Generate payment link
    const paymentLink = `https://${domain}/pay/telecaller?phone=${encodeURIComponent(lead.phone)}`;

    const firstName = lead.full_name.split(" ")[0];
    const formattedAmount = new Intl.NumberFormat("en-IN").format(lead.loan_amount);

    const results: { sms?: boolean; whatsapp?: boolean } = {};

    // Send SMS if requested - use DLT-approved template
    if (channel === "sms" || channel === "both") {
      try {
        // Use the payment_failed template which is DLT-approved
        const smsResponse = await supabase.functions.invoke("send-sms", {
          body: {
            type: "payment_failed",
            phone: lead.phone,
            leadId: lead.id,
            variables: {
              var1: paymentLink,
            },
          },
        });
        
        results.sms = !smsResponse.error;
        console.log("[send-payment-retry] SMS result:", smsResponse);
      } catch (smsError) {
        console.error("[send-payment-retry] SMS error:", smsError);
        results.sms = false;
      }
    }

    // Send WhatsApp if requested
    if (channel === "whatsapp" || channel === "both") {
      try {
        const whatsappMessage = `🙏 नमस्ते ${firstName} जी,

आपका ₹${formattedAmount} ${lead.loan_type} loan application pending है।

🎯 अभी payment complete करें:
${paymentLink}

✅ 24 घंटे में loan approval
✅ Lowest interest rates
✅ No hidden charges

किसी भी सहायता के लिए हमें call करें।

- Team Hariox`;

        const whatsappResponse = await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone: lead.phone,
            message: whatsappMessage,
            lead_id: lead.id,
          },
        });
        
        results.whatsapp = !whatsappResponse.error;
        console.log("[send-payment-retry] WhatsApp result:", whatsappResponse);
      } catch (waError) {
        console.error("[send-payment-retry] WhatsApp error:", waError);
        results.whatsapp = false;
      }
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      lead_id: lead.id,
      action: "payment_retry_sent",
      details: {
        channel,
        payment_link: paymentLink,
        results,
        failed_payment_id: failedPayment?.id,
      },
    });

    // Check for 3 failed payment attempts - notify manager
    const { count: failedAttempts } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("lead_id", lead_id)
      .eq("status", "failed");

    if (failedAttempts && failedAttempts >= 3) {
      // Get admin users to notify
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map((admin) => ({
          user_id: admin.user_id,
          title: "⚠️ Multiple Payment Failures",
          message: `Lead ${lead.full_name} (${lead.phone}) has ${failedAttempts} failed payment attempts. May need manual follow-up.`,
          type: "payment_alert",
          link: `/admin?tab=leads&search=${lead.phone}`,
          metadata: { lead_id: lead.id, failed_attempts: failedAttempts },
        }));

        await supabase.from("staff_notifications").insert(notifications);
        console.log(`[send-payment-retry] Notified ${adminRoles.length} admins about ${failedAttempts} failures`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment retry message sent",
        payment_link: paymentLink,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-payment-retry] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
