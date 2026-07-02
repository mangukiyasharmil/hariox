import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RECIPIENTS = ['918460191818', '917041409801'];

// Company → WhatsApp account mapping
const COMPANY_WA_MAP: Record<string, string> = {
  // Credit Hariox & Capital Hariox → Hariox account
  "0a817e57-9c31-4aba-b709-3647958b917e": "14695e74-2978-492a-9d22-43a5237da840",
  "bbe9fc5c-0caf-458e-aada-fa33143c4ff4": "14695e74-2978-492a-9d22-43a5237da840",
  // Finance Hariox → Finance Hariox account
  "e00c26fa-d874-4977-9fc6-bdf6e6b66344": "a91e64ce-86b8-49de-b949-ac260bb9163b",
  // Finance Fundkredit → Finance Fundkredit account
  "e6b82169-19d7-4e93-a0c0-304b89bcab71": "80f1b467-5229-497a-9e5c-0c3516963816",
};

const PAID_STATUSES = ['paid', 'verification', 'documents_pending', 'documents_uploaded', 'verified', 'processing', 'approved', 'disbursed'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // IST date boundaries
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const startUTC = new Date(todayStart.getTime() - istOffset).toISOString();
    const endUTC = new Date(todayEnd.getTime() - istOffset).toISOString();
    const yStartUTC = new Date(yesterdayStart.getTime() - istOffset).toISOString();

    const dateStr = istNow.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Fetch companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('is_active', true);

    // Pre-fetch WhatsApp accounts
    const { data: waAccounts } = await supabase
      .from('whatsapp_accounts')
      .select('id, meta_access_token, meta_phone_id')
      .eq('connection_type', 'meta_api')
      .eq('status', 'connected');

    const waMap = new Map((waAccounts || []).map(a => [a.id, a]));

    // Fetch all data in parallel
    const [
      { data: todayLeads },
      { data: yesterdayLeads },
      { data: todayPayments },
      { data: yesterdayPayments },
      { data: todayCalls },
      { data: yesterdayCalls },
      { data: todayWAMessages },
      { data: todayExpenses },
      { data: todaySMS },
      { data: yesterdaySMS },
      { data: assignmentHistory },
      { data: userRoles },
      { data: profiles },
    ] = await Promise.all([
      supabase.from('leads').select('id, status, company_id').gte('created_at', startUTC).lt('created_at', endUTC),
      supabase.from('leads').select('id, status, company_id').gte('created_at', yStartUTC).lt('created_at', startUTC),
      supabase.from('payments').select('amount, total_amount, payment_source, status, company_id').in('status', ['captured', 'completed']).gte('created_at', startUTC).lt('created_at', endUTC),
      supabase.from('payments').select('amount, total_amount, payment_source, status, company_id').in('status', ['captured', 'completed']).gte('created_at', yStartUTC).lt('created_at', startUTC),
      supabase.from('call_logs').select('id, call_duration, company_id').gte('created_at', startUTC).lt('created_at', endUTC),
      supabase.from('call_logs').select('id, company_id').gte('created_at', yStartUTC).lt('created_at', startUTC),
      supabase.from('whatsapp_messages').select('id, status, account_id').gte('created_at', startUTC).lt('created_at', endUTC).limit(50000),
      supabase.from('accounting_entries').select('amount, category, company_id, entry_type').eq('entry_type', 'expense').gte('entry_date', todayStart.toISOString().split('T')[0]).lte('entry_date', istNow.toISOString().split('T')[0]),
      supabase.from('sms_logs').select('id, status, sms_type').gte('created_at', startUTC).lt('created_at', endUTC).limit(50000),
      supabase.from('sms_logs').select('id, status').gte('created_at', yStartUTC).lt('created_at', startUTC).limit(50000),
      // Get today's paid lead assignments for telecaller ranking
      supabase.from('lead_assignment_history').select('assigned_to, lead_id').gte('created_at', startUTC).lt('created_at', endUTC),
      supabase.from('user_roles').select('user_id, role').eq('role', 'telecaller'),
      supabase.from('profiles').select('user_id, full_name'),
    ]);

    // Get paid lead IDs today for telecaller attribution
    const paidLeadIds = new Set(
      (todayLeads || []).filter(l => PAID_STATUSES.includes(l.status)).map(l => l.id)
    );

    // Count paid leads per telecaller (deduplicate by lead_id per telecaller)
    const telecallerLeadSets: Record<string, Set<string>> = {};
    for (const ah of (assignmentHistory || [])) {
      if (ah.assigned_to && paidLeadIds.has(ah.lead_id)) {
        const isTelecaller = (userRoles || []).some(r => r.user_id === ah.assigned_to && r.role === 'telecaller');
        if (isTelecaller) {
          if (!telecallerLeadSets[ah.assigned_to]) telecallerLeadSets[ah.assigned_to] = new Set();
          telecallerLeadSets[ah.assigned_to].add(ah.lead_id);
        }
      }
    }

    // Sort telecallers by paid count
    const topTelecallers = Object.entries(telecallerLeadSets)
      .map(([userId, leadSet]) => ({ userId, count: leadSet.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ userId, count }) => {
        const profile = (profiles || []).find(p => p.user_id === userId);
        return { name: profile?.full_name || 'Unknown', count };
      });

    const waResponses: any[] = [];

    for (const company of (companies || [])) {
      const cId = company.id;

      // Today's stats
      const cLeads = (todayLeads || []).filter(l => l.company_id === cId);
      const cPaid = cLeads.filter(l => PAID_STATUSES.includes(l.status));
      const cVerified = cLeads.filter(l => l.status === 'verified');
      const cDisbursed = cLeads.filter(l => l.status === 'disbursed');

      // Yesterday's stats for comparison
      const yLeads = (yesterdayLeads || []).filter(l => l.company_id === cId);
      const yPaid = yLeads.filter(l => PAID_STATUSES.includes(l.status));

      // Payments
      const cPayments = (todayPayments || []).filter(p => p.company_id === cId);
      const yPayments = (yesterdayPayments || []).filter(p => p.company_id === cId);
      const totalRevenue = cPayments.reduce((s, p) => s + (p.total_amount || 0), 0);
      const yRevenue = yPayments.reduce((s, p) => s + (p.total_amount || 0), 0);

      // Payment by source
      const bySource: Record<string, { count: number; amount: number }> = {};
      for (const p of cPayments) {
        const src = p.payment_source || 'direct';
        if (!bySource[src]) bySource[src] = { count: 0, amount: 0 };
        bySource[src].count++;
        bySource[src].amount += p.total_amount || 0;
      }

      // Calls
      const cCalls = (todayCalls || []).filter(c => c.company_id === cId);
      const yCalls = (yesterdayCalls || []).filter(c => c.company_id === cId);
      const totalDuration = cCalls.reduce((s, c) => s + (c.call_duration || 0), 0);

      // WhatsApp stats for this company's account
      const waAccountId = COMPANY_WA_MAP[cId];
      const cWA = (todayWAMessages || []).filter(m => m.account_id === waAccountId);
      const waSent = cWA.filter(m => m.status === 'sent').length;
      const waDelivered = cWA.filter(m => m.status === 'delivered').length;
      const waRead = cWA.filter(m => m.status === 'read').length;
      const waFailed = cWA.filter(m => m.status === 'failed').length;
      const waPending = cWA.filter(m => m.status === 'pending' || m.status === 'queued').length;
      const waBySource: Record<string, number> = {};
      for (const m of cWA) {
        const src = m.message_source || 'manual';
        waBySource[src] = (waBySource[src] || 0) + 1;
      }

      // Expenses
      const cExpenses = (todayExpenses || []).filter(e => e.company_id === cId);
      const totalExpense = cExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const expenseByCategory: Record<string, number> = {};
      for (const e of cExpenses) {
        expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
      }

      // Day-over-day comparison
      const leadDiff = cLeads.length - yLeads.length;
      const paidDiff = cPaid.length - yPaid.length;
      const revDiff = totalRevenue - yRevenue;
      const callDiff = cCalls.length - yCalls.length;

      const arrow = (diff: number) => diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '→0';
      const pctChange = (today: number, yesterday: number) => {
        if (yesterday === 0) return today > 0 ? '+∞%' : '0%';
        const pct = ((today - yesterday) / yesterday * 100).toFixed(0);
        return `${Number(pct) > 0 ? '+' : ''}${pct}%`;
      };

      const totalMin = Math.floor(totalDuration / 60);
      const totalSec = totalDuration % 60;

      const paymentLines = Object.entries(bySource)
        .filter(([_, d]) => d.count > 0)
        .map(([src, d]) => `  • ${src}: ${d.count} (₹${d.amount.toLocaleString('en-IN')})`)
        .join('\n');

      const expenseLines = Object.entries(expenseByCategory)
        .filter(([_, amt]) => amt > 0)
        .map(([cat, amt]) => `  • ${cat}: ₹${amt.toLocaleString('en-IN')}`)
        .join('\n');

      const waSourceLines = Object.entries(waBySource)
        .filter(([_, cnt]) => cnt > 0)
        .map(([src, cnt]) => `  • ${src}: ${cnt}`)
        .join('\n');

      // Build message
      let msg = `📊 *${company.name}*\n📅 *${dateStr}*\n\n`;

      // Leads
      msg += `📋 *Leads* (${arrow(leadDiff)} ${pctChange(cLeads.length, yLeads.length)})\n`;
      msg += `  Total: ${cLeads.length} | Paid: ${cPaid.length} (${arrow(paidDiff)})\n`;
      msg += `  Verified: ${cVerified.length} | Disbursed: ${cDisbursed.length}\n`;
      msg += `  Conv: ${cLeads.length > 0 ? ((cPaid.length / cLeads.length) * 100).toFixed(1) : 0}%\n\n`;

      // Payments
      msg += `💰 *Revenue: ₹${totalRevenue.toLocaleString('en-IN')}* (${arrow(revDiff > 0 ? 1 : revDiff < 0 ? -1 : 0)} ${pctChange(totalRevenue, yRevenue)})\n`;
      if (paymentLines) msg += `${paymentLines}\n`;
      msg += `  Total: ${cPayments.length} payments\n\n`;

      // Calls
      msg += `📞 *Calls: ${cCalls.length}* (${arrow(callDiff)}) | ${totalMin}m ${totalSec}s\n\n`;

      // WhatsApp
      if (cWA.length > 0) {
        msg += `📱 *WhatsApp* (Total: ${cWA.length})\n`;
        msg += `  Sent: ${waSent} | Delivered: ${waDelivered} | Read: ${waRead}\n`;
        msg += `  Failed: ${waFailed} | Pending: ${waPending}\n\n`;
      }

      // SMS stats (global — show once with Credit)
      const smsSent = (todaySMS || []).filter(s => s.status === 'sent' || s.status === 'delivered' || s.status === 'submitted').length;
      const smsDelivered = (todaySMS || []).filter(s => s.status === 'delivered').length;
      const smsFailed = (todaySMS || []).filter(s => s.status === 'failed').length;
      const ySMSTotal = (yesterdaySMS || []).length;
      const smsByType: Record<string, number> = {};
      for (const s of (todaySMS || [])) {
        smsByType[s.sms_type] = (smsByType[s.sms_type] || 0) + 1;
      }
      if (company.slug === 'hariox' && (todaySMS || []).length > 0) {
        const smsTypeLines = Object.entries(smsByType)
          .filter(([_, cnt]) => cnt > 0)
          .map(([t, cnt]) => `  • ${t}: ${cnt}`)
          .join('\n');
        msg += `📩 *SMS* (${arrow((todaySMS || []).length - ySMSTotal)})\n`;
        msg += `  Sent: ${smsSent} | Delivered: ${smsDelivered} | Failed: ${smsFailed}\n`;
        if (smsTypeLines) msg += `${smsTypeLines}\n`;
        msg += `\n`;
      }

      // Expenses
      if (totalExpense > 0) {
        msg += `💸 *Expenses: ₹${totalExpense.toLocaleString('en-IN')}*\n`;
        if (expenseLines) msg += `${expenseLines}\n`;
        msg += `  *Net P/L: ₹${(totalRevenue - totalExpense).toLocaleString('en-IN')}*\n\n`;
      }

      // Top telecallers (show for all companies combined, only once with Credit)
      if (company.slug === 'hariox' && topTelecallers.length > 0) {
        msg += `🏆 *Top Telecallers*\n`;
        topTelecallers.forEach((tc, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          msg += `  ${medal} ${tc.name}: ${tc.count} paid\n`;
        });
      }

      // Send via correct WhatsApp account
      const waAccount = waMap.get(waAccountId);
      if (waAccount?.meta_access_token && waAccount?.meta_phone_id) {
        for (const phone of RECIPIENTS) {
          try {
            const resp = await fetch(
              `https://graph.facebook.com/v22.0/${waAccount.meta_phone_id}/messages`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${waAccount.meta_access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: phone,
                  type: 'text',
                  text: { body: msg },
                }),
              }
            );
            const result = await resp.json();
            waResponses.push({ company: company.name, phone, success: !!result?.messages });
          } catch (e) {
            console.error(`[send-daily-report] Error sending to ${phone}:`, e);
            waResponses.push({ company: company.name, phone, error: String(e) });
          }
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        // Fallback: use send-whatsapp edge function
        for (const phone of RECIPIENTS) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
                'apikey': serviceKey,
              },
              body: JSON.stringify({
                account_id: waAccountId,
                phone_number: phone,
                message: msg,
                message_source: 'system',
              }),
            });
          } catch (e) {
            console.error(`[send-daily-report] Fallback error for ${phone}:`, e);
          }
        }
      }

      console.log(`[send-daily-report] Sent report for ${company.name} via WA account ${waAccountId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Reports sent for ${companies?.length || 0} companies`,
      responses: waResponses,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[send-daily-report] Error:', error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
