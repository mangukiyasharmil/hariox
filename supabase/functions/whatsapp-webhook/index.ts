import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Send interactive button message via Meta API
async function sendInteractiveButtons(
  account: any,
  phone: string,
  bodyText: string,
  options: string[],
  leadId: string | null,
  contactName: string | null,
  supabase: any
) {
  const accessToken = account.meta_access_token || Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");
  const formattedPhone = phone.replace(/[\s+\-()]/g, "");
  const fullPhone = formattedPhone.startsWith("91") ? formattedPhone : `91${formattedPhone}`;

  const buttons = options.slice(0, 3).map((opt, i) => ({
    type: "reply",
    reply: {
      id: `btn_${i}_${Date.now()}`,
      title: opt.substring(0, 20), // WhatsApp 20 char limit for button titles
    },
  }));

  const payload = {
    messaging_product: "whatsapp",
    to: fullPhone,
    recipient_type: "individual",
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: { buttons },
    },
  };

  try {
    const apiUrl = `https://graph.facebook.com/v22.0/${account.meta_phone_id}/messages`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    // Log
    await supabase.from("whatsapp_api_logs").insert({
      account_id: account.id,
      action: "send_interactive_buttons",
      request_data: payload,
      response_data: responseData,
      status: response.ok ? "success" : "failed",
      error_message: response.ok ? null : JSON.stringify(responseData.error),
    });

    if (response.ok) {
      // Store in messages
      const buttonLabels = options.join(" | ");
      await supabase.from("whatsapp_messages").insert({
        account_id: account.id,
        phone_number: fullPhone,
        contact_name: contactName,
        content: `${bodyText}\n🔘 ${buttonLabels}`,
        direction: "outgoing",
        status: "sent",
        message_type: "interactive",
        lead_id: leadId,
        message_source: "chatbot",
        wamid: responseData.messages?.[0]?.id,
        sent_at: new Date().toISOString(),
      });
    } else {
      console.error("Interactive buttons error:", responseData);
    }
  } catch (err) {
    console.error("Error sending interactive buttons:", err);
  }
}

Deno.serve(async (req) => {
  // Handle webhook verification (GET request from Meta)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Get expected verify token from env or default
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "hariox_webhook_verify";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    } else {
      console.error("Webhook verification failed");
      return new Response("Forbidden", { status: 403 });
    }
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    // Meta webhook payload structure
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      return new Response(JSON.stringify({ status: "no_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneNumberId = value.metadata?.phone_number_id;

    // TEMPORARY DEBUG: Log incoming webhook directly to DB to see if Meta is hitting us
    await supabase.from("whatsapp_api_logs").insert({
      action: "incoming_webhook",
      request_data: body,
      response_data: { meta_phone_id: phoneNumberId },
      status: "debug"
    });

    // Find the WhatsApp account by phone_number_id
    const { data: account, error: accountError } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("meta_phone_id", phoneNumberId)
      .single();

    if (accountError || !account) {
      console.error("Account not found for phone_number_id:", phoneNumberId);
      return new Response(JSON.stringify({ status: "account_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle incoming messages
    const messages = value.messages || [];
    
    for (const message of messages) {
      const senderPhone = message.from;
      const messageType = message.type;
      const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

      // Get message content and media URL based on type
      let content = "";
      let mediaUrl: string | null = null;
      let mediaMimeType: string | null = null;

      if (messageType === "text") {
        content = message.text?.body || "";
      } else if (messageType === "button") {
        content = message.button?.text || "";
      } else if (messageType === "interactive") {
        content = message.interactive?.button_reply?.title || 
                  message.interactive?.list_reply?.title || "";
      } else if (["image", "video", "audio", "document", "sticker"].includes(messageType)) {
        // Extract media info from the message
        const mediaObj = message[messageType];
        content = mediaObj?.caption || `[${messageType}]`;
        mediaMimeType = mediaObj?.mime_type || null;
        
        // Download media URL from Meta Graph API
        if (mediaObj?.id) {
          try {
            const accessToken = account.meta_access_token || Deno.env.get("WHATSAPP_META_ACCESS_TOKEN");
            const mediaRes = await fetch(`https://graph.facebook.com/v22.0/${mediaObj.id}`, {
              headers: { "Authorization": `Bearer ${accessToken}` },
            });
            const mediaData = await mediaRes.json();
            if (mediaData.url) {
              // Fetch the actual media binary and upload to storage
              const mediaDownload = await fetch(mediaData.url, {
                headers: { "Authorization": `Bearer ${accessToken}` },
              });
              if (mediaDownload.ok) {
                const blob = await mediaDownload.blob();
                const ext = mediaMimeType?.split("/")?.[1]?.replace("jpeg", "jpg") || "bin";
                const filePath = `whatsapp-media/${account.id}/${mediaObj.id}.${ext}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from("documents")
                  .upload(filePath, blob, { contentType: mediaMimeType || "application/octet-stream", upsert: true });
                
                if (!uploadError && uploadData) {
                  // Private bucket: generate a long-lived signed URL (7 days) for storage in messages.
                  // Admin UI should re-sign on demand for stricter expiry.
                  const { data: signed } = await supabase.storage
                    .from("documents")
                    .createSignedUrl(filePath, 60 * 60 * 24 * 7);
                  mediaUrl = signed?.signedUrl || null;
                } else {
                  console.error("[whatsapp-webhook] Media upload error:", uploadError);
                  // Fallback: store the direct Meta URL (expires in ~5 min)
                  mediaUrl = mediaData.url;
                }
              }
            }
          } catch (mediaErr) {
            console.error("[whatsapp-webhook] Media download error:", mediaErr);
          }
        }
      } else {
        content = `[${messageType}]`;
      }

      // Get contact name from contacts array
      const contact = value.contacts?.find((c: any) => c.wa_id === senderPhone);
      const contactName = contact?.profile?.name || null;

      // Try to find linked lead
      const cleanPhone = senderPhone.replace(/^91/, "");
      let leadQuery = supabase
        .from("leads")
        .select("id, full_name, assigned_to, company_id")
        .or(`phone.eq.${cleanPhone},phone.eq.${senderPhone}`);

      if (account.company_id) {
        leadQuery = leadQuery.eq("company_id", account.company_id);
      }

      const { data: lead } = await leadQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // ---- STOP keyword handling ----
      const lowerContent = content.toLowerCase().trim();
      const isStopRequest = ["stop", "unsubscribe", "opt out", "optout", "cancel"].includes(lowerContent);
      
      // Check if this number is on DND list
      const cleanPhoneForDnd = senderPhone.replace(/^91/, "");
      const { data: dndEntry } = await supabase
        .from("whatsapp_dnd")
        .select("id")
        .or(`phone.eq.${cleanPhoneForDnd},phone.eq.${senderPhone}`)
        .maybeSingle();
      
      const isOnDnd = !!dndEntry;
      
      if (isStopRequest) {
        console.log(`[whatsapp-webhook] STOP request from ${senderPhone}, adding to DND and cancelling automations`);
        
        // Add to DND list (upsert to avoid duplicates)
        await supabase
          .from("whatsapp_dnd")
          .upsert({
            phone: cleanPhoneForDnd,
            reason: "customer_stop",
            lead_id: lead?.id || null,
          }, { onConflict: "phone" });

        // Cancel all pending scheduled workflow actions for this lead
        if (lead?.id) {
          await supabase
            .from("workflow_scheduled_actions")
            .update({ status: "cancelled" })
            .eq("lead_id", lead.id)
            .eq("status", "pending");

          // Stop any active remarketing cycles
          await supabase
            .from("remarketing_cycles")
            .update({ status: "stopped" })
            .eq("lead_id", lead.id)
            .eq("status", "active");

          // Stop WhatsApp remarketing cycles if table exists
          try {
            await supabase
              .from("whatsapp_remarketing_cycles")
              .update({ status: "stopped" })
              .eq("lead_id", lead.id)
              .eq("status", "active");
          } catch {
            // Table may not exist
          }

          // Log the opt-out
          await supabase.from("activity_logs").insert({
            lead_id: lead.id,
            action: "whatsapp_opt_out",
            details: { phone: senderPhone, message: content },
          });
        }

        // Send confirmation reply
        try {
          await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                account_id: account.id,
                phone_number: senderPhone,
                message: "You have been unsubscribed from all automated messages. You will not receive any more marketing or AI messages. If you need help in future, please visit credit.hariox.com 🙏",
                contact_name: contactName || lead?.full_name,
                lead_id: lead?.id,
                message_source: "system",
              }),
            }
          );
        } catch (replyErr) {
          console.error("[whatsapp-webhook] Stop reply error:", replyErr);
        }
      }

      // Store incoming message
      const { data: insertedMessage, error: insertError } = await supabase
        .from("whatsapp_messages")
        .insert({
          account_id: account.id,
          phone_number: senderPhone,
          contact_name: contactName || lead?.full_name,
          content,
          direction: "incoming",
          status: "received",
          message_type: messageType,
          lead_id: lead?.id || null,
          wamid: message.id,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting message:", insertError);
      }

      // Update account last_connected_at
      await supabase
        .from("whatsapp_accounts")
        .update({ last_connected_at: new Date().toISOString() })
        .eq("id", account.id);

      // Trigger workflow automations for button clicks and messages (skip if STOP or DND)
      if (lead?.id && !isStopRequest && !isOnDnd) {
        let triggerType = "whatsapp_message_received";
        const triggerMeta: Record<string, string> = { message_type: messageType, content };
        
        if (messageType === "button" || messageType === "interactive") {
          triggerType = "whatsapp_button_click";
          triggerMeta.button_text = content;
        }

        try {
          await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                trigger_type: triggerType,
                lead_id: lead.id,
                company_id: (lead as any).company_id,
                button_text: content,
                message_type: messageType,
              }),
            }
          );
          console.log(`[whatsapp-webhook] Triggered workflow: ${triggerType} for lead ${lead.id}`);
        } catch (wfError) {
          console.error("[whatsapp-webhook] Workflow trigger error:", wfError);
        }
      }

      // Check if chatbot is enabled for this account
      if (account.chatbot_enabled && content && !isStopRequest && !isOnDnd) {
        // Get conversation history for context
        const { data: history } = await supabase
          .from("whatsapp_messages")
          .select("content, direction")
          .eq("account_id", account.id)
          .eq("phone_number", senderPhone)
          .order("created_at", { ascending: false })
          .limit(10);

        const conversationHistory = (history || [])
          .reverse()
          .map(m => ({
            role: m.direction === "incoming" ? "user" : "assistant",
            content: m.content
          }));

        // Call chatbot function
        try {
          const chatbotResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-chatbot`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: content,
                phone_number: senderPhone,
                account_id: account.id,
                conversation_history: conversationHistory,
              }),
            }
          );

          const chatbotData = await chatbotResponse.json();

          if (chatbotData.reply) {
            // Send text reply first
            await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  account_id: account.id,
                  phone_number: senderPhone,
                  message: chatbotData.reply,
                  contact_name: contactName || lead?.full_name,
                  lead_id: chatbotData.lead_id || lead?.id,
                  message_source: "chatbot",
                }),
              }
            );

            // Send interactive buttons if present
            if (chatbotData.interactive_buttons && chatbotData.interactive_buttons.length > 0) {
              for (const btnGroup of chatbotData.interactive_buttons) {
                await sendInteractiveButtons(
                  account,
                  senderPhone,
                  btnGroup.title,
                  btnGroup.options,
                  chatbotData.lead_id || lead?.id,
                  contactName || lead?.full_name,
                  supabase
                );
              }
            }

            // If chatbot detected agent escalation, flag the conversation
            if (chatbotData.agent_requested) {
              // Mark the incoming message as needing agent
              if (insertedMessage?.id) {
                await supabase.from("whatsapp_messages")
                  .update({ needs_agent: true })
                  .eq("id", insertedMessage.id);
              }
              console.log(`[whatsapp-webhook] Agent escalation flagged for ${senderPhone}`);
            }
          }
        } catch (chatbotError) {
          console.error("Chatbot error:", chatbotError);
        }
      }

      // Detect live agent / human support requests
      const liveAgentKeywords = ["human", "agent", "real person", "live agent", "talk to someone", "customer care", "support", "help me", "operator", "executive"];
      const isLiveAgentRequest = liveAgentKeywords.some(kw => lowerContent.includes(kw));

      if (isLiveAgentRequest) {
        // Notify all admins and assigned staff
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "staff"]);

        const notifyUserIds = new Set<string>();
        if (lead?.assigned_to) notifyUserIds.add(lead.assigned_to);
        (adminRoles || []).forEach((r: any) => notifyUserIds.add(r.user_id));

        const notifications = Array.from(notifyUserIds).map(uid => ({
          user_id: uid,
          type: "live_agent_request",
          title: "🆘 Live Agent Requested",
          message: `${contactName || lead?.full_name || senderPhone} needs human support: "${content.substring(0, 80)}"`,
          link: "/admin/dashboard/inbox",
          metadata: { lead_id: lead?.id, phone: senderPhone, account_id: account.id },
        }));

        if (notifications.length > 0) {
          await supabase.from("staff_notifications").insert(notifications);
        }
      }

      // Create notification for assigned telecaller
      if (lead?.assigned_to && !isLiveAgentRequest) {
        await supabase.from("staff_notifications").insert({
          user_id: lead.assigned_to,
          type: "whatsapp_message",
          title: "New WhatsApp Message",
          message: `${contactName || lead.full_name || senderPhone}: ${content.substring(0, 100)}`,
          link: "/admin/dashboard/inbox",
          metadata: { lead_id: lead.id, phone: senderPhone },
        });
      }
    }

    // Handle message status updates
    const statuses = value.statuses || [];
    for (const status of statuses) {
      const wamid = status.id;
      const newStatus = status.status; // sent, delivered, read, failed

      const updateData: any = { status: newStatus };
      if (newStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      } else if (newStatus === "read") {
        updateData.read_at = new Date().toISOString();
      } else if (newStatus === "failed") {
        // Capture Meta's error details for debugging
        const errors = status.errors;
        if (errors && errors.length > 0) {
          const errDetail = errors[0];
          const errorInfo = `[${errDetail.code}] ${errDetail.title || ""}: ${errDetail.message || errDetail.error_data?.details || "Unknown"}`;
          console.error(`[whatsapp-webhook] Delivery failed for ${wamid}:`, errorInfo);
          // Store error in a metadata-friendly way
          updateData.error_details = errorInfo;
        }
      }

      await supabase
        .from("whatsapp_messages")
        .update(updateData)
        .eq("wamid", wamid);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
