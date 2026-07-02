 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     );
 
      const metaAccessToken = Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");

      // === Sending window check (10 AM – 9 PM IST) ===
      // IST = UTC+5:30. Compute IST hour from server UTC.
      const nowDate = new Date();
      const istHour = (nowDate.getUTCHours() * 60 + nowDate.getUTCMinutes() + 330) / 60 % 24;
      const inSendingWindow = istHour >= 10 && istHour < 21;

      if (!inSendingWindow) {
        console.log(`[whatsapp-remarketing] Outside sending window (IST hour=${istHour.toFixed(2)}). Skipping run.`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "outside_sending_window", ist_hour: istHour }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get pending scheduled messages that are due
      const now = nowDate.toISOString();
      // Per-lead daily cap (smarter cooldown to prevent Meta throttling 131049)
      const COOLDOWN_HOURS = 20;
      const cooldownCutoff = new Date(nowDate.getTime() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
     const { data: pendingMessages, error: fetchError } = await supabase
       .from("whatsapp_scheduled_messages")
       .select(`
         id, phone_number, message, template_id, account_id, lead_id,
         workflow_id, sequence_number, metadata,
         whatsapp_templates(name, content, variables),
         whatsapp_accounts(meta_phone_id, meta_access_token),
         leads(full_name, loan_amount, status)
       `)
       .eq("status", "pending")
       .lte("scheduled_at", now)
       .order("scheduled_at", { ascending: true })
       .limit(50);
 
     if (fetchError) {
       console.error("[whatsapp-remarketing] Error fetching scheduled messages:", fetchError);
       throw fetchError;
     }
 
     console.log(`[whatsapp-remarketing] Found ${pendingMessages?.length || 0} pending messages to send`);
 
     let sentCount = 0;
     let failedCount = 0;
     let cancelledCount = 0;
 
     for (const msg of pendingMessages || []) {
       try {
         // Check if lead has paid - cancel scheduled messages
         const lead = msg.leads as any;
         if (lead && lead.status !== "unpaid") {
           await supabase
             .from("whatsapp_scheduled_messages")
             .update({ status: "cancelled", error_message: `Lead status changed to ${lead.status}` })
             .eq("id", msg.id);
           
           // Cancel all future scheduled messages for this workflow and lead
           await supabase
             .from("whatsapp_scheduled_messages")
             .update({ status: "cancelled", error_message: "Lead converted - cycle stopped" })
             .eq("lead_id", msg.lead_id)
             .eq("workflow_id", msg.workflow_id)
             .eq("status", "pending")
             .gt("sequence_number", msg.sequence_number);
           
            cancelledCount++;
            console.log(`[whatsapp-remarketing] Cancelled message for converted lead ${msg.lead_id}`);
            continue;
          }

          // === Per-lead cooldown: skip if a WhatsApp msg was sent to this lead in last 20h ===
          const phoneLast10 = (msg.phone_number || "").replace(/\D/g, "").slice(-10);
          const { data: recentSent } = await supabase
            .from("whatsapp_messages")
            .select("id, sent_at")
            .eq("phone_number", phoneLast10)
            .eq("direction", "outbound")
            .gte("sent_at", cooldownCutoff)
            .limit(1);

          if (recentSent && recentSent.length > 0) {
            // Defer: push this message 20h forward instead of sending
            const newScheduledAt = new Date(nowDate.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
            await supabase
              .from("whatsapp_scheduled_messages")
              .update({ scheduled_at: newScheduledAt })
              .eq("id", msg.id);
            console.log(`[whatsapp-remarketing] Cooldown active for ${phoneLast10}, deferred to ${newScheduledAt}`);
            continue;
          }
 
         // Get WhatsApp account info
         const account = msg.whatsapp_accounts as any;
         const accessToken = account?.meta_access_token || metaAccessToken;
         const phoneId = account?.meta_phone_id;
 
         if (!accessToken || !phoneId) {
           await supabase
             .from("whatsapp_scheduled_messages")
             .update({ status: "failed", error_message: "No WhatsApp credentials configured" })
             .eq("id", msg.id);
           failedCount++;
           continue;
         }
 
         // Prepare message content
         let messageContent = msg.message || "";
         const template = msg.whatsapp_templates as any;
         
         if (template) {
           messageContent = template.content || "";
         }
 
         // Replace variables
         const leadName = lead?.full_name || "Customer";
         const loanAmount = lead?.loan_amount || 50000;
         
         messageContent = messageContent
           .replace(/\{\{name\}\}/gi, leadName)
           .replace(/\{\{1\}\}/g, leadName)
           .replace(/\{\{amount\}\}/gi, String(loanAmount))
           .replace(/\{\{2\}\}/g, String(loanAmount))
           .replace(/\{\{loan_amount\}\}/gi, String(loanAmount));
 
         // Format phone number
         const phone = msg.phone_number.replace(/\D/g, "");
         const formattedPhone = phone.startsWith("91") ? phone : `91${phone}`;
 
         // Send via Meta API
         const response = await fetch(
           `https://graph.facebook.com/v18.0/${phoneId}/messages`,
           {
             method: "POST",
             headers: {
               Authorization: `Bearer ${accessToken}`,
               "Content-Type": "application/json",
             },
             body: JSON.stringify({
               messaging_product: "whatsapp",
               to: formattedPhone,
               type: "text",
               text: { body: messageContent },
             }),
           }
         );
 
         const result = await response.json();
 
         if (response.ok && result.messages?.[0]?.id) {
           // Success - update status
           await supabase
             .from("whatsapp_scheduled_messages")
             .update({ 
               status: "sent", 
               sent_at: new Date().toISOString(),
               metadata: { ...((msg.metadata as object) || {}), wamid: result.messages[0].id }
             })
             .eq("id", msg.id);
 
           // Log to whatsapp_messages table
           await supabase.from("whatsapp_messages").insert({
             account_id: msg.account_id,
             phone_number: phone.slice(-10),
             content: messageContent,
             direction: "outbound",
             lead_id: msg.lead_id,
             wamid: result.messages[0].id,
             status: "sent",
             sent_at: new Date().toISOString(),
             message_source: "remarketing_workflow",
           });
 
           sentCount++;
           console.log(`[whatsapp-remarketing] Sent message #${msg.sequence_number} to ${phone}`);
          } else {
            // Failed
            const errorMsg = result.error?.message || "Unknown error";
            const errorCode = result.error?.code;

            // Meta throttling (131049) — defer 24h instead of failing permanently
            if (errorCode === 131049 || /healthy ecosystem/i.test(errorMsg)) {
              const newScheduledAt = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
              await supabase
                .from("whatsapp_scheduled_messages")
                .update({ scheduled_at: newScheduledAt, error_message: `Throttled (131049) - deferred 24h` })
                .eq("id", msg.id);
              console.warn(`[whatsapp-remarketing] Meta throttled ${phone}, deferred to ${newScheduledAt}`);
            } else {
              await supabase
                .from("whatsapp_scheduled_messages")
                .update({ status: "failed", error_message: errorMsg })
                .eq("id", msg.id);
              failedCount++;
              console.error(`[whatsapp-remarketing] Failed to send to ${phone}:`, errorMsg);
            }
         }
       } catch (msgError) {
         console.error(`[whatsapp-remarketing] Error processing message ${msg.id}:`, msgError);
         await supabase
           .from("whatsapp_scheduled_messages")
           .update({ status: "failed", error_message: String(msgError) })
           .eq("id", msg.id);
         failedCount++;
       }
     }
 
     const summary = {
       success: true,
       processed: pendingMessages?.length || 0,
       sent: sentCount,
       failed: failedCount,
       cancelled: cancelledCount,
     };
 
     console.log("[whatsapp-remarketing] Complete:", summary);
 
     return new Response(JSON.stringify(summary), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error) {
     console.error("[whatsapp-remarketing] Error:", error);
     return new Response(
       JSON.stringify({ success: false, error: String(error) }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });