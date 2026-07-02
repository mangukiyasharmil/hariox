 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 interface ScheduleStep {
   delay_minutes: number;
   delay_label: string;
   action_type: string;
   action_config: Record<string, unknown>;
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     );
 
     const body = await req.json();
     const { lead_id, workflow_id, account_id, steps } = body;
 
     if (!lead_id || !steps || !Array.isArray(steps)) {
       return new Response(
         JSON.stringify({ success: false, error: "lead_id and steps array required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log(`[start-whatsapp-remarketing] Scheduling ${steps.length} steps for lead ${lead_id}`);
 
     // Get lead info
     const { data: lead, error: leadError } = await supabase
       .from("leads")
       .select("id, phone, full_name, loan_amount, status, company_id")
       .eq("id", lead_id)
       .single();
 
     if (leadError || !lead) {
       return new Response(
         JSON.stringify({ success: false, error: "Lead not found" }),
         { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Cancel any existing pending messages for this lead + workflow
     if (workflow_id) {
       await supabase
         .from("whatsapp_scheduled_messages")
         .update({ status: "cancelled", error_message: "New cycle started" })
         .eq("lead_id", lead_id)
         .eq("workflow_id", workflow_id)
         .eq("status", "pending");
     }
 
     const phone = (lead.phone || "").replace(/\D/g, "").slice(-10);
     if (!phone) {
       return new Response(
         JSON.stringify({ success: false, error: "Invalid phone number" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     let cumulativeMinutes = 0;
     let sequenceNumber = 1;
     const scheduledMessages = [];
 
     for (const step of steps as ScheduleStep[]) {
       // Add delay to cumulative time
       cumulativeMinutes += step.delay_minutes || 0;
 
       // Only schedule message actions
       if (step.action_type === "send_message" || step.action_type === "send_template") {
         const scheduledAt = new Date(Date.now() + cumulativeMinutes * 60 * 1000);
 
         const msgData = {
           workflow_id: workflow_id || null,
           lead_id: lead_id,
           phone_number: phone,
           message: step.action_config?.message as string || null,
           template_id: step.action_config?.template_id as string || null,
           account_id: account_id || null,
           scheduled_at: scheduledAt.toISOString(),
           sequence_number: sequenceNumber,
           status: "pending",
           company_id: lead.company_id,
           metadata: {
             delay_label: step.delay_label,
             lead_name: lead.full_name,
             loan_amount: lead.loan_amount,
           },
         };
 
         scheduledMessages.push(msgData);
         sequenceNumber++;
       }
     }
 
     if (scheduledMessages.length > 0) {
       const { error: insertError } = await supabase
         .from("whatsapp_scheduled_messages")
         .insert(scheduledMessages);
 
       if (insertError) {
         console.error("[start-whatsapp-remarketing] Insert error:", insertError);
         throw insertError;
       }
     }
 
     console.log(`[start-whatsapp-remarketing] Scheduled ${scheduledMessages.length} messages for lead ${lead_id}`);
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         scheduled: scheduledMessages.length,
         lead_id,
         phone
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("[start-whatsapp-remarketing] Error:", error);
     return new Response(
       JSON.stringify({ success: false, error: String(error) }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });