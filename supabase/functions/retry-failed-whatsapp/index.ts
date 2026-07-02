import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 2;
const BATCH_SIZE = 10;
const DELAY_MS = 1500;

// Errors that should NOT be retried (permanent failures)
const NON_RETRYABLE_ERRORS = [
  "130472", // User's number is part of an experiment
  "131026", // Message undeliverable (number not on WhatsApp)
  "131051", // Unsupported message type
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Fetch failed messages eligible for retry (failed >1h ago, max retries not exceeded)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 50_000; // 50s guard (edge fn limit ~60s)

    const { data: failedMessages, error: fetchErr } = await supabase
      .from("whatsapp_messages")
      .select("id, account_id, phone_number, contact_name, content, message_type, message_source, lead_id, error_details, retry_count, created_at")
      .eq("status", "failed")
      .eq("retry_eligible", true)
      .lt("retry_count", MAX_RETRIES)
      .lt("created_at", oneHourAgo)
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchErr) {
      console.error("[retry-failed-whatsapp] Fetch error:", fetchErr);
      throw fetchErr;
    }

    if (!failedMessages || failedMessages.length === 0) {
      console.log("[retry-failed-whatsapp] No failed messages to retry");
      // Still send report if there were recent failures
      await sendReport(supabase, SUPABASE_URL, SERVICE_KEY, [], 0, 0, 0);
      return new Response(JSON.stringify({ success: true, message: "No messages to retry" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out non-retryable errors
    const retryable: typeof failedMessages = [];
    const permanent: typeof failedMessages = [];

    for (const msg of failedMessages) {
      const isNonRetryable = NON_RETRYABLE_ERRORS.some(code => 
        msg.error_details?.includes(code)
      );
      if (isNonRetryable) {
        permanent.push(msg);
      } else {
        retryable.push(msg);
      }
    }

    // Mark permanent failures as not eligible for retry
    if (permanent.length > 0) {
      const permIds = permanent.map(m => m.id);
      await supabase
        .from("whatsapp_messages")
        .update({ retry_eligible: false })
        .in("id", permIds);
    }

    console.log(`[retry-failed-whatsapp] Found ${failedMessages.length} failed, ${retryable.length} retryable, ${permanent.length} permanent`);

    let successCount = 0;
    let failCount = 0;

    // Retry in batches with timeout guard
    for (let i = 0; i < retryable.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[retry-failed-whatsapp] Timeout guard hit after ${i} messages`);
        break;
      }
      const batch = retryable.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (msg) => {
          // Extract template info from the original message content
          // Re-send using the send-whatsapp function
          const body: Record<string, unknown> = {
            account_id: msg.account_id,
            phone_number: msg.phone_number,
            contact_name: msg.contact_name,
            lead_id: msg.lead_id,
            message_source: "retry",
          };

          // If it was a template message, try to resend as template
          if (msg.message_type === "template") {
            // We'll send the content as a regular message since we don't have template details stored
            body.message = msg.content;
          } else {
            body.message = msg.content;
          }

          const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SERVICE_KEY}`,
              "apikey": SERVICE_KEY,
            },
            body: JSON.stringify(body),
          });

          const result = await resp.json();
          return { msgId: msg.id, success: result?.success === true };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          successCount++;
          // Update original message retry count
          await supabase
            .from("whatsapp_messages")
            .update({
              retry_count: retryable.find(m => m.id === result.value.msgId)!.retry_count + 1,
              last_retry_at: new Date().toISOString(),
              retry_eligible: false, // Success, no more retries needed
            })
            .eq("id", result.value.msgId);
        } else {
          failCount++;
          const msgId = result.status === "fulfilled" ? result.value.msgId : null;
          if (msgId) {
            const msg = retryable.find(m => m.id === msgId)!;
            const newRetryCount = msg.retry_count + 1;
            await supabase
              .from("whatsapp_messages")
              .update({
                retry_count: newRetryCount,
                last_retry_at: new Date().toISOString(),
                retry_eligible: newRetryCount < MAX_RETRIES,
              })
              .eq("id", msgId);
          }
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < retryable.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    console.log(`[retry-failed-whatsapp] Retry complete: ${successCount} success, ${failCount} failed`);

    // Send summary report
    await sendReport(supabase, SUPABASE_URL, SERVICE_KEY, failedMessages, retryable.length, successCount, failCount);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_failed: failedMessages.length,
        retried: retryable.length,
        permanent_failures: permanent.length,
        retry_success: successCount,
        retry_failed: failCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[retry-failed-whatsapp] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendReport(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  failedMessages: any[],
  retriedCount: number,
  successCount: number,
  failCount: number,
) {
  // Get yesterday's total failure stats by source
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayBefore = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const { data: yesterdayFails } = await supabase
    .from("whatsapp_messages")
    .select("message_source, error_details")
    .eq("status", "failed")
    .gte("created_at", dayBefore.toISOString())
    .lt("created_at", yesterday.toISOString());

  // Group by source
  const bySource: Record<string, number> = {};
  const byError: Record<string, number> = {};
  for (const msg of (yesterdayFails || [])) {
    const src = msg.message_source || "unknown";
    bySource[src] = (bySource[src] || 0) + 1;

    // Extract error code
    const match = msg.error_details?.match(/\[(\d+)\]/);
    const errCode = match ? match[1] : "unknown";
    byError[errCode] = (byError[errCode] || 0) + 1;
  }

  const totalYesterdayFails = yesterdayFails?.length || 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  let report = `📊 *WhatsApp Delivery Report*\n📅 ${dateStr}\n\n`;
  
  report += `❌ *Failed Messages (24h):* ${totalYesterdayFails}\n\n`;

  if (totalYesterdayFails > 0) {
    report += `📌 *By Source:*\n`;
    for (const [src, count] of Object.entries(bySource)) {
      const emoji = src === "campaign" ? "📢" : src === "workflow" ? "⚙️" : src === "chatbot" ? "🤖" : "📨";
      report += `${emoji} ${src}: ${count}\n`;
    }

    report += `\n🔍 *By Error:*\n`;
    for (const [code, count] of Object.entries(byError)) {
      report += `• Error #${code}: ${count}\n`;
    }
  }

  report += `\n🔄 *Retry Summary:*\n`;
  report += `• Eligible for retry: ${retriedCount}\n`;
  report += `• ✅ Retry success: ${successCount}\n`;
  report += `• ❌ Retry failed: ${failCount}\n`;
  report += `• 🚫 Permanent (not retryable): ${failedMessages.length - retriedCount}\n`;

  // Send to admin numbers
  const recipients = ["+918460191818", "+917041409801"];

  // Get any active WhatsApp account
  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!account) {
    console.log("[retry-failed-whatsapp] No active WhatsApp account for report");
    return;
  }

  for (const phone of recipients) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          account_id: account.id,
          phone_number: phone,
          message: report,
          message_source: "system",
        }),
      });
    } catch (e) {
      console.error(`[retry-failed-whatsapp] Failed to send report to ${phone}:`, e);
    }
  }
}
