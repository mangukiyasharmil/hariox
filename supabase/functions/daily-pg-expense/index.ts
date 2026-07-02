import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PG_RATE = 0.0236; // 2.36% inclusive of GST

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    
    let entryDateStr: string;
    let startUTC: string;
    let endUTC: string;
    
    if (dateParam) {
      entryDateStr = dateParam;
      const [year, month, day] = dateParam.split('-').map(Number);
      const dayStartIST = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - istOffset);
      const dayEndIST = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) - istOffset);
      startUTC = dayStartIST.toISOString();
      endUTC = dayEndIST.toISOString();
    } else {
      const istNow = new Date(now.getTime() + istOffset);
      entryDateStr = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${String(istNow.getDate()).padStart(2, '0')}`;
      const dayStartIST = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
      const dayEndIST = new Date(dayStartIST.getTime() + 24 * 60 * 60 * 1000);
      startUTC = new Date(dayStartIST.getTime() - istOffset).toISOString();
      endUTC = new Date(dayEndIST.getTime() - istOffset).toISOString();
    }

    console.log(`Processing PG expense for date: ${entryDateStr}`);

    // Get all active companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true);

    const allCompanyIds = (companies || []).map(c => c.id);
    const companyCount = allCompanyIds.length || 1;

    // Get completed payments for the target date with company info
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, total_amount, company_id, lead_id, leads!inner(company_id)')
      .in('status', ['completed', 'captured'])
      .gte('payment_date', startUTC)
      .lt('payment_date', endUTC);

    if (paymentsError) throw paymentsError;

    if (!payments || payments.length === 0) {
      console.log('No payments on this date, skipping expense entries');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No payments on this date',
        date: entryDateStr,
        payment_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group payments by company_id (use lead's company_id as fallback)
    const companyPayments: Record<string, { count: number; total: number }> = {};
    let unattributedCount = 0;
    let unattributedTotal = 0;

    for (const p of payments) {
      const cid = p.company_id || (p.leads as any)?.company_id || null;
      const amount = p.total_amount || 0;

      if (cid && allCompanyIds.includes(cid)) {
        if (!companyPayments[cid]) companyPayments[cid] = { count: 0, total: 0 };
        companyPayments[cid].count++;
        companyPayments[cid].total += amount;
      } else {
        unattributedCount++;
        unattributedTotal += amount;
      }
    }

    // Split unattributed equally
    const splitCount = Math.ceil(unattributedCount / companyCount);
    const splitTotal = unattributedTotal / companyCount;

    const results: string[] = [];

    for (const company of (companies || [])) {
      const stats = companyPayments[company.id] || { count: 0, total: 0 };
      const totalPaymentAmount = stats.total + splitTotal;
      const paymentCount = stats.count + splitCount;
      const pgCharges = totalPaymentAmount * PG_RATE;

      if (paymentCount === 0) {
        results.push(`${company.name}: No payments, skipped`);
        continue;
      }

      const amountRounded = Math.round(pgCharges * 100) / 100;
      const description = `PG charges - ${stats.count} payments @ 2.36% of ₹${stats.total.toLocaleString('en-IN')}${splitCount > 0 ? ` +${splitCount} shared (₹${Math.round(splitTotal).toLocaleString('en-IN')})` : ''} (incl. GST)`;

      // Check existing entry
      const { data: existing } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('company_id', company.id)
        .eq('category', 'PG Charges')
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
        results.push(`${company.name}: Updated ₹${amountRounded.toFixed(2)} (${paymentCount} payments)`);
      } else {
        await supabase
          .from('accounting_entries')
          .insert({
            entry_type: 'expense',
            category: 'PG Charges',
            amount: amountRounded,
            description,
            entry_date: entryDateStr,
            gst_included: true,
            gst_rate: 18,
            company_id: company.id,
          });
        results.push(`${company.name}: Added ₹${amountRounded.toFixed(2)} (${paymentCount} payments)`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      date: entryDateStr,
      companies_processed: (companies || []).length,
      total_payments: payments.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating PG expense entries:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
