import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle webhook verification (GET request from Meta)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("META_VERIFY_TOKEN") || "hariox_meta_verify";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Meta webhook verified successfully");
      return new Response(challenge, { status: 200 });
    } else {
      console.error("Meta webhook verification failed");
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
    console.log("Meta webhook received:", JSON.stringify(body, null, 2));

    const object = body.object;
    const entry = body.entry?.[0];

    if (!entry) {
      return new Response(JSON.stringify({ status: "no_entry" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle Facebook Messenger
    if (object === "page") {
      const messaging = entry.messaging?.[0];
      if (messaging) {
        await handleFacebookMessage(supabase, entry.id, messaging);
      }
    }

    // Handle Instagram
    if (object === "instagram") {
      const messaging = entry.messaging?.[0];
      if (messaging) {
        await handleInstagramMessage(supabase, entry.id, messaging);
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Meta webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleFacebookMessage(supabase: any, pageId: string, messaging: any) {
  const senderId = messaging.sender?.id;
  const recipientId = messaging.recipient?.id;
  const timestamp = messaging.timestamp;
  const message = messaging.message;

  if (!message || !senderId) return;

  // Find the connected page
  const { data: page } = await supabase
    .from("meta_pages")
    .select("*")
    .eq("page_id", pageId)
    .eq("platform", "facebook")
    .single();

  if (!page) {
    console.log("Facebook page not found:", pageId);
    return;
  }

  // Determine direction based on sender
  const direction = senderId === pageId ? "outgoing" : "incoming";

  // Get sender info from Graph API if incoming
  let senderName = null;
  let senderProfilePic = null;
  
  if (direction === "incoming" && page.page_access_token) {
    try {
      const profileRes = await fetch(
        `https://graph.facebook.com/${senderId}?fields=name,profile_pic&access_token=${page.page_access_token}`
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        senderName = profile.name;
        senderProfilePic = profile.profile_pic;
      }
    } catch (e) {
      console.error("Error fetching FB profile:", e);
    }
  }

  // Store message in unified_messages
  const content = message.text || message.attachments?.[0]?.type || "[media]";
  const messageType = message.attachments?.[0]?.type || "text";

  await supabase.from("unified_messages").insert({
    platform: "facebook",
    page_id: page.id,
    sender_id: senderId,
    sender_name: senderName,
    sender_profile_pic: senderProfilePic,
    content,
    direction,
    status: direction === "incoming" ? "received" : "sent",
    message_type: messageType,
    external_id: message.mid,
    metadata: { timestamp, attachments: message.attachments },
  });

  console.log("Facebook message stored:", content.substring(0, 50));
}

async function handleInstagramMessage(supabase: any, igAccountId: string, messaging: any) {
  const senderId = messaging.sender?.id;
  const recipientId = messaging.recipient?.id;
  const timestamp = messaging.timestamp;
  const message = messaging.message;

  if (!message || !senderId) return;

  // Find the connected Instagram account
  const { data: page } = await supabase
    .from("meta_pages")
    .select("*")
    .eq("instagram_account_id", igAccountId)
    .eq("platform", "instagram")
    .single();

  if (!page) {
    console.log("Instagram account not found:", igAccountId);
    return;
  }

  const direction = senderId === igAccountId ? "outgoing" : "incoming";

  // Get sender info from Graph API if incoming
  let senderName = null;
  let senderProfilePic = null;

  if (direction === "incoming" && page.page_access_token) {
    try {
      const profileRes = await fetch(
        `https://graph.facebook.com/${senderId}?fields=name,profile_picture_url&access_token=${page.page_access_token}`
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        senderName = profile.name;
        senderProfilePic = profile.profile_picture_url;
      }
    } catch (e) {
      console.error("Error fetching IG profile:", e);
    }
  }

  // Store message
  const content = message.text || message.attachments?.[0]?.type || "[media]";
  const messageType = message.attachments?.[0]?.type || "text";

  await supabase.from("unified_messages").insert({
    platform: "instagram",
    page_id: page.id,
    sender_id: senderId,
    sender_name: senderName,
    sender_profile_pic: senderProfilePic,
    content,
    direction,
    status: direction === "incoming" ? "received" : "sent",
    message_type: messageType,
    external_id: message.mid,
    metadata: { timestamp, attachments: message.attachments },
  });

  console.log("Instagram message stored:", content.substring(0, 50));
}
