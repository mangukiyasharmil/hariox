import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMS_COST_PER_SEGMENT = 0.11; // ₹0.11 per segment (GST inclusive)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional manual date override (?date=YYYY-MM-DD in IST)
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;

    let entryDateStr: string;
    let startUTC: string;
    let endUTC: string;

    if (dateParam) {
      entryDateStr = dateParam;
      const [year, month, day] = dateParam.split("-").map(Number);
      const dayStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - istOffset);
      const dayEndUTC = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) - istOffset);
      startUTC = dayStartUTC.toISOString();
      endUTC = dayEndUTC.toISOString();
    } else {
      const istNow = new Date(now.getTime() + istOffset);
      entryDateStr = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, "0")}-${String(istNow.getDate()).padStart(2, "0")}`;
      const todayStartIST = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
      const todayEndIST = new Date(todayStartIST.getTime() + 24 * 60 * 60 * 1000);
      startUTC = new Date(todayStartIST.getTime() - istOffset).toISOString();
      endUTC = new Date(todayEndIST.getTime() - istOffset).toISOString();
    }

    // Get all active companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true);

    const allCompanyIds = (companies || []).map(c => c.id);
    const companyCount = allCompanyIds.length || 1;

    // Get per-company SMS stats using the new RPC
    const { data: statsResult, error: smsError } = await supabase
      .rpc('get_sms_stats_by_company', { start_date: startUTC, end_date: endUTC });

    if (smsError) throw smsError;

    // Build per-company cost map
    const companyCosts: Record<string, { segments: number; delivered: number; otp: number; remarketing: number; other: number }> = {};
    let unattributedSegments = 0;
    let unattributedDelivered = 0;

    for (const row of (statsResult || [])) {
      if (row.company_id && allCompanyIds.includes(row.company_id)) {
        companyCosts[row.company_id] = {
          segments: Number(row.delivered_segments),
          delivered: Number(row.delivered_count),
          otp: Number(row.otp_count),
          remarketing: Number(row.remarketing_count),
          other: Number(row.other_count),
        };
      } else {
        // Null company_id or unknown company → split equally
        unattributedSegments += Number(row.delivered_segments);
        unattributedDelivered += Number(row.delivered_count);
      }
    }

    // Split unattributed equally across all companies
    const splitSegments = Math.ceil(unattributedSegments / companyCount);
    const splitDelivered = Math.ceil(unattributedDelivered / companyCount);

    const results: string[] = [];

    for (const company of (companies || [])) {
      const stats = companyCosts[company.id] || { segments: 0, delivered: 0, otp: 0, remarketing: 0, other: 0 };
      const totalSegments = stats.segments + splitSegments;
      const totalDelivered = stats.delivered + splitDelivered;
      const totalCost = totalSegments * SMS_COST_PER_SEGMENT;

      if (totalDelivered === 0) {
        results.push(`${company.name}: No delivered SMS, skipped`);
        continue;
      }

      const amountRounded = Math.round(totalCost * 100) / 100;
      const description = `SMS: ${totalDelivered} delivered (${totalSegments} seg) | OTP: ${stats.otp}, Remarketing: ${stats.remarketing}, Other: ${stats.other}${splitDelivered > 0 ? ` +${splitDelivered} shared` : ''} @ ₹${SMS_COST_PER_SEGMENT}/seg`;

      // Check existing entry for this company + date
      const { data: existing } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('company_id', company.id)
        .eq('category', 'SMS Charges')
        .eq('entry_type', 'expense')
        .eq('entry_date', entryDateStr)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from('accounting_entries')
          .update({
            amount: amountRounded,
            description,
            gst_included: true,
            gst_rate: 18,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
        results.push(`${company.name}: Updated ₹${amountRounded.toFixed(2)} (${totalDelivered} SMS)`);
      } else {
        await supabase
          .from('accounting_entries')
          .insert({
            entry_type: 'expense',
            category: 'SMS Charges',
            amount: amountRounded,
            description,
            entry_date: entryDateStr,
            gst_included: true,
            gst_rate: 18,
            company_id: company.id,
          });
        results.push(`${company.name}: Added ₹${amountRounded.toFixed(2)} (${totalDelivered} SMS)`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: entryDateStr,
      companies_processed: (companies || []).length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating SMS expense entries:', error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
