import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ChannelStats {
  channel: string;
  total: number;
  delivered: number;
  pageViews: number;
  failed: number;
  leads: number;
  paid: number;
  revenue: number;
  expense: number;
}

interface ChannelBreakdownProps {
  dateFilter: string;
  dateEndFilter: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  SMS: "#3B82F6",
  WhatsApp: "#25D366",
  Telecaller: "#F59E0B",
  RCS: "#4285F4",
  "Website (Direct)": "#8B5CF6",
};

const toISTDate = (isoStr: string): string => {
  const d = new Date(isoStr);
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
};

const ChannelBreakdown = ({ dateFilter, dateEndFilter }: ChannelBreakdownProps) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data: channelStats = [], isLoading: loading } = useQuery({
    queryKey: ["channel-breakdown", dateFilter, dateEndFilter, companyId],
    staleTime: 300_000, // 5 min cache
    refetchInterval: 300_000,
    retry: 1,
    queryFn: async (): Promise<ChannelStats[]> => {
      const entryDateStart = toISTDate(dateFilter);
      const entryDateEnd = toISTDate(dateEndFilter);

      // BATCH 1: Fetch all leads and payments in 2 queries instead of 10+ HEAD counts
      const [leadsRes, paymentsRes, smsRpcRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads")
            .select("id, source")
            .gte("created_at", dateFilter)
            .lte("created_at", dateEndFilter)
        ),
        applyCompanyFilter(
          supabase.from("payments")
            .select("total_amount, payment_source")
            .in("status", ["completed", "captured"])
            .gte("created_at", dateFilter)
            .lte("created_at", dateEndFilter)
        ),
        supabase.rpc("get_sms_stats", {
          start_date: dateFilter,
          end_date: dateEndFilter,
          p_company_id: companyId || null,
        }),
      ]);

      const allLeads = leadsRes.data || [];
      const allPayments = paymentsRes.data || [];
      const smsRpc: any = smsRpcRes.data?.[0] || {};

      // Count leads by source in memory (instead of 5 HEAD requests)
      const countLeadsBySource = (matcher: (s: string | null) => boolean) =>
        allLeads.filter(l => matcher(l.source)).length;

      const smsLeads = countLeadsBySource(s => s === "sms" || s === "marketing");
      const waLeads = countLeadsBySource(s => s === "whatsapp" || (s || "").startsWith("whatsapp"));
      const telecallerLeads = countLeadsBySource(s => s === "telecaller");
      const rcsLeads = countLeadsBySource(s => s === "rcs");
      const directLeads = countLeadsBySource(s => !s || s === "website" || s === "direct" || (s || "").startsWith("website"));

      // Count payments by source in memory (instead of 5 HEAD requests)
      const paymentsBySource = (source: string) => {
        const filtered = allPayments.filter(p => p.payment_source === source);
        return { count: filtered.length, revenue: filtered.reduce((s, p) => s + (p.total_amount || 0), 0) };
      };

      const smsPaid = paymentsBySource("marketing");
      const waPaid = paymentsBySource("whatsapp");
      const telecallerPaid = paymentsBySource("telecaller");
      const directPaid = paymentsBySource("direct");

      // BATCH 2: Only fetch what we can't derive from batch 1
      // Expenses + WhatsApp message stats (reduced from 10+ to 3 queries)
      let waAccountIds: string[] = [];
      if (companyId) {
        const { data: accs } = await supabase.from("whatsapp_accounts").select("id").eq("company_id", companyId);
        waAccountIds = (accs || []).map(a => a.id);
      }

      const applyWaFilter = (q: any) => {
        if (!companyId) return q;
        if (waAccountIds.length === 0) return q.eq("account_id", "00000000-0000-0000-0000-000000000000");
        return q.in("account_id", waAccountIds);
      };

      const [accountingRes, waMessagesRes] = await Promise.all([
        (() => {
          let q = supabase.from("accounting_entries").select("amount, category")
            .eq("entry_type", "expense")
            .in("category", ["WhatsApp Meta", "PG Charges", "Marketing Meta", "SMS Charges", "Ads", "Outside"])
            .gte("entry_date", entryDateStart)
            .lte("entry_date", entryDateEnd).limit(10000);
          if (companyId) q = q.eq("company_id", companyId);
          return q;
        })(),
        // Single query for all WA messages instead of 5 separate HEAD counts
        applyWaFilter(
          supabase.from("whatsapp_messages")
            .select("status, content")
            .eq("direction", "outgoing")
            .eq("message_type", "template")
            .gte("created_at", dateFilter)
            .lte("created_at", dateEndFilter)
        ),
      ]);

      const expenses = accountingRes.data || [];
      const waMessages = waMessagesRes.data || [];

      // Compute WA stats in memory (instead of 5 HEAD requests)
      const waTotal = waMessages.length;
      const waDelivered = waMessages.filter(m => m.status === "delivered" || m.status === "read").length;
      const waFailed = waMessages.filter(m => m.status === "failed").length;

      // WA cost calculation
      const MARKETING_RATE = 0.8631;
      const UTILITY_RATE = 0.1150;
      const utilityMessages = waMessages.filter(m =>
        (m.status === "delivered" || m.status === "read") &&
        (m.content || "").match(/otp|verification|payment_confirm|status_update/i)
      ).length;
      const deliveredTemplates = waDelivered;
      const marketingTemplates = deliveredTemplates - utilityMessages;
      const liveWaCost = (marketingTemplates * MARKETING_RATE) + (utilityMessages * UTILITY_RATE);

      // Expense calculations
      const smsRpcCost = Number(smsRpc.total_cost) || 0;
      const smsAccountingCost = expenses.filter(e => e.category === "SMS Charges").reduce((s, e) => s + e.amount, 0);
      const smsExpense = smsRpcCost > 0 ? smsRpcCost : smsAccountingCost;
      const websiteExpense = expenses.filter(e => e.category === "PG Charges" || e.category === "Marketing Meta").reduce((s, e) => s + e.amount, 0);
      const waAccountingExpense = expenses.filter(e => e.category === "WhatsApp Meta").reduce((s, e) => s + e.amount, 0);
      const waExpense = Math.max(waAccountingExpense, liveWaCost);

      // SMS counts from RPC
      const smsTotal = Number(smsRpc.total_count) || 0;
      const smsDelivered = Number(smsRpc.delivered_count) || 0;
      const smsFailed = Number(smsRpc.failed_count) || 0;

      return [
        { channel: "SMS", total: smsTotal, delivered: smsDelivered, pageViews: 0, failed: smsFailed, leads: smsLeads, paid: smsPaid.count, revenue: smsPaid.revenue, expense: smsExpense },
        { channel: "WhatsApp", total: waTotal, delivered: waDelivered, pageViews: 0, failed: waFailed, leads: waLeads, paid: waPaid.count, revenue: waPaid.revenue, expense: waExpense },
        { channel: "Telecaller", total: 0, delivered: 0, pageViews: 0, failed: 0, leads: telecallerLeads, paid: telecallerPaid.count, revenue: telecallerPaid.revenue, expense: 0 },
        { channel: "RCS", total: 0, delivered: 0, pageViews: 0, failed: 0, leads: rcsLeads, paid: 0, revenue: 0, expense: 0 },
        { channel: "Website (Direct)", total: 0, delivered: 0, pageViews: 0, failed: 0, leads: directLeads, paid: directPaid.count, revenue: directPaid.revenue, expense: websiteExpense },
      ];
    },
  });

  const totalLeads = useMemo(() => channelStats.reduce((s, c) => s + c.leads, 0), [channelStats]);
  const totalPaid = useMemo(() => channelStats.reduce((s, c) => s + c.paid, 0), [channelStats]);
  const totalRevenue = useMemo(() => channelStats.reduce((s, c) => s + c.revenue, 0), [channelStats]);
  const totalSpend = useMemo(() => channelStats.reduce((s, c) => s + c.expense, 0), [channelStats]);
  const overallROI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend * 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            Channel-wise Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-center text-xs text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          Channel-wise Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-2.5 font-semibold">Channel</th>
                <th className="text-right p-2.5 font-semibold">Total</th>
                <th className="text-right p-2.5 font-semibold">Delivered</th>
                <th className="text-right p-2.5 font-semibold">Failed</th>
                <th className="text-right p-2.5 font-semibold">Leads</th>
                <th className="text-right p-2.5 font-semibold">Paid</th>
                <th className="text-right p-2.5 font-semibold">Revenue</th>
                <th className="text-right p-2.5 font-semibold">Expense</th>
                <th className="text-right p-2.5 font-semibold">Net P/L</th>
                <th className="text-right p-2.5 font-semibold">ROI</th>
                <th className="text-right p-2.5 font-semibold">Conv %</th>
              </tr>
            </thead>
            <tbody>
              {channelStats.map((ch) => {
                const chROI = ch.expense > 0 && isFinite(ch.revenue) ? ((ch.revenue - ch.expense) / ch.expense * 100) : 0;
                const chProfit = ch.revenue - ch.expense;
                return (
                  <tr key={ch.channel} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-medium flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[ch.channel] }} />
                      {ch.channel}
                    </td>
                    <td className="text-right p-2.5 font-mono">{ch.total > 0 ? ch.total.toLocaleString("en-IN") : "—"}</td>
                    <td className="text-right p-2.5 font-mono text-green-600">{ch.delivered > 0 ? ch.delivered.toLocaleString("en-IN") : "—"}</td>
                    <td className="text-right p-2.5 font-mono text-red-500">{ch.failed > 0 ? ch.failed.toLocaleString("en-IN") : "—"}</td>
                    <td className="text-right p-2.5 font-mono font-semibold">{ch.leads > 0 ? ch.leads.toLocaleString("en-IN") : "—"}</td>
                    <td className="text-right p-2.5 font-mono text-green-600 font-semibold">{ch.paid > 0 ? ch.paid.toLocaleString("en-IN") : "—"}</td>
                    <td className="text-right p-2.5 font-mono text-emerald-600">
                      {ch.revenue > 0 ? `₹${ch.revenue.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="text-right p-2.5 font-mono text-red-500">
                      {ch.expense > 0 ? `₹${Math.round(ch.expense).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className={`text-right p-2.5 font-mono font-semibold ${chProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(ch.revenue > 0 || ch.expense > 0) ? `${chProfit < 0 ? "-" : ""}₹${Math.abs(Math.round(chProfit)).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className={`text-right p-2.5 font-mono text-xs ${chROI >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {ch.expense > 0 ? `${chROI >= 0 ? "+" : ""}${Math.round(chROI)}%` : "—"}
                    </td>
                    <td className="text-right p-2.5 font-mono">
                      {ch.leads > 0 ? `${Math.round((ch.paid / ch.leads) * 100)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold border-t-2 border-border">
                <td className="p-2.5">Total</td>
                <td className="text-right p-2.5 font-mono">—</td>
                <td className="text-right p-2.5 font-mono">—</td>
                <td className="text-right p-2.5 font-mono">—</td>
                <td className="text-right p-2.5 font-mono">{totalLeads}</td>
                <td className="text-right p-2.5 font-mono text-green-600">{totalPaid}</td>
                <td className="text-right p-2.5 font-mono text-emerald-600">₹{totalRevenue.toLocaleString("en-IN")}</td>
                <td className="text-right p-2.5 font-mono text-red-500">₹{Math.round(totalSpend).toLocaleString("en-IN")}</td>
                <td className={`text-right p-2.5 font-mono ${(totalRevenue - totalSpend) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {(totalRevenue - totalSpend) < 0 ? "-" : ""}₹{Math.abs(Math.round(totalRevenue - totalSpend)).toLocaleString("en-IN")}
                </td>
                <td className={`text-right p-2.5 font-mono ${overallROI >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {totalSpend > 0 ? `${overallROI >= 0 ? "+" : ""}${Math.round(overallROI)}%` : "—"}
                </td>
                <td className="text-right p-2.5 font-mono">
                  {totalLeads > 0 ? `${Math.round((totalPaid / totalLeads) * 100)}%` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChannelBreakdown;
