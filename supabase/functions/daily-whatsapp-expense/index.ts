import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meta India rates per message (approx)
const MARKETING_RATE = 0.8631;
const UTILITY_RATE = 0.1150;

// Map WhatsApp account IDs to company IDs
const ACCOUNT_COMPANY_MAP: Record<string, string> = {
  "14695e74-2978-492a-9d22-43a5237da840": "0a817e57-9c31-4aba-b709-3647958b917e", // Hariox -> Credit Hariox
  "a91e64ce-86b8-49de-b949-ac260bb9163b": "e00c26fa-d874-4977-9fc6-bdf6e6b66344", // Finance Hariox
  "80f1b467-5229-497a-9e5c-0c3516963816": "e6b82169-19d7-4e93-a0c0-304b89bcab71", // Finance Fundkredit
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

    // Calculate today IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayIST = istNow.toISOString().split("T")[0];

    const startISO = new Date(`${todayIST}T00:00:00+05:30`).toISOString();
    const endISO = new Date(`${todayIST}T23:59:59+05:30`).toISOString();

    // Get all templates for category mapping
    const { data: templates } = await supabase
      .from("whatsapp_templates")
      .select("name, category, account_id");

    const results: string[] = [];

    for (const [accountId, companyId] of Object.entries(ACCOUNT_COMPANY_MAP)) {
      // Build template category map for this account
      const templateCategoryMap = new Map<string, string>();
      (templates || [])
        .filter(t => t.account_id === accountId)
        .forEach(t => templateCategoryMap.set(t.name.toLowerCase(), t.category || "UTILITY"));

      // Fetch outgoing delivered/read/sent template messages for today
      const { data: outMsgs } = await supabase
        .from("whatsapp_messages")
        .select("message_type, content")
        .eq("account_id", accountId)
        .eq("direction", "outgoing")
        .in("status", ["sent", "delivered", "read"])
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      let marketing = 0, utility = 0;
      (outMsgs || []).forEach(m => {
        if (m.message_type === "template") {
          const content = (m.content || "").toLowerCase();
          let category = "MARKETING";
          for (const [name, cat] of templateCategoryMap) {
            const nameWithSpaces = name.replace(/_/g, " ");
            if (content.includes(name) || content.includes(nameWithSpaces)) {
              category = cat;
              break;
            }
          }
          if (category === "MARKETING") marketing++;
          else utility++;
        }
      });

      const totalCost = (marketing * MARKETING_RATE) + (utility * UTILITY_RATE);

      if (totalCost <= 0) {
        results.push(`${accountId}: No paid messages, skipped`);
        continue;
      }

      const description = `WhatsApp Meta: ${marketing} marketing (₹${(marketing * MARKETING_RATE).toFixed(2)}) + ${utility} utility (₹${(utility * UTILITY_RATE).toFixed(2)})`;

      // Check if entry already exists for today + this company
      const { data: existing } = await supabase
        .from("accounting_entries")
        .select("id")
        .eq("company_id", companyId)
        .eq("category", "WhatsApp Meta")
        .eq("entry_date", todayIST)
        .eq("entry_type", "expense")
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from("accounting_entries")
          .update({
            amount: totalCost,
            description,
            gst_included: true,
            gst_rate: 18,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id);
        results.push(`Company ${companyId}: Updated ₹${totalCost.toFixed(2)}`);
      } else {
        await supabase
          .from("accounting_entries")
          .insert({
            amount: totalCost,
            category: "WhatsApp Meta",
            entry_type: "expense",
            entry_date: todayIST,
            description,
            company_id: companyId,
            gst_included: true,
            gst_rate: 18,
          });
        results.push(`Company ${companyId}: Added ₹${totalCost.toFixed(2)}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: todayIST, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp expense error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
