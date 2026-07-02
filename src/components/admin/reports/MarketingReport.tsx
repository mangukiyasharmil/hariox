import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { MessageSquare, Send, CheckCircle, XCircle, Clock, AlertTriangle, IndianRupee, TrendingUp, Eye, Users, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketingReportProps {
  dateFilter: string;
  dateEndFilter: string;
  dateLabel: string;
}

interface ChannelStats {
  channel: string;
  total: number;
  delivered: number;
  submitted: number;
  failed: number;
  rejected: number;
  pending: number;
  linkVisited: number;
  cost: number;
  revenue: number;
  leads: number;
  paid: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  SMS: "#3B82F6",
  WhatsApp: "#25D366",
  Telecaller: "#F59E0B",
  "Website (Direct)": "#8B5CF6",
  "Meta Ads": "#E1306C",
  "RCS": "#4285F4",
};

const STATUS_CARDS = [
  { key: "total", label: "Total Sent", icon: MessageSquare, color: "text-primary", bg: "bg-primary/10", border: "border-l-primary" },
  { key: "delivered", label: "Delivered", icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", border: "border-l-green-500" },
  { key: "submitted", label: "Submitted", icon: Send, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-l-blue-500" },
  { key: "failed", label: "Failed", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-l-red-500" },
  { key: "rejected", label: "Rejected", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-l-amber-500" },
  { key: "pending", label: "Pending", icon: Clock, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-l-muted-foreground" },
  { key: "linkVisited", label: "Link Visited", icon: Eye, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-l-cyan-500" },
];

const MarketingReport = ({ dateFilter, dateEndFilter, dateLabel }: MarketingReportProps) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const [isLoading, setIsLoading] = useState(true);
  const [channelStats, setChannelStats] = useState<ChannelStats[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [exactTotals, setExactTotals] = useState({ leads: 0, paid: 0, pageViews: 0, revenue: 0 });

  useEffect(() => {
    fetchMarketingData();
  }, [dateFilter, dateEndFilter, companyId]);

  const toISTDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
    const ist = new Date(istMs);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
  };

  const fetchMarketingData = async () => {
    setIsLoading(true);
    const entryDateStart = toISTDate(dateFilter);
    const entryDateEnd = toISTDate(dateEndFilter);
    try {
      // Get WhatsApp account IDs for current company
      let waAccountIds: string[] = [];
      if (companyId) {
        const { data: accs } = await supabase.from("whatsapp_accounts").select("id").eq("company_id", companyId);
        waAccountIds = (accs || []).map(a => a.id);
      }

      const applyWaFilter = (q: any) => {
        if (!companyId || waAccountIds.length === 0) return q;
        return q.in("account_id", waAccountIds);
      };

      const applyAnalyticsFilter = (q: any) => {
        if (!companyId) return q;
        return q.eq("company_id", companyId);
      };

      const [
        smsRpcRes,
        // Global exact counts using RPC for page views (handles both pageview/page_view)
        analyticsRpcRes,
        leadsCountRes, paymentsCountRes,
        // Per-source lead exact counts
        smsLeadsCountRes, waLeadsCountRes, telecallerLeadsCountRes, rcsLeadsCountRes, directLeadsCountRes,
        // Per-source paid exact counts
        smsPaidCountRes, waPaidCountRes, telecallerPaidCountRes, rcsPaidCountRes, directPaidCountRes,
        // Per-channel page views using page_path fallback (UTM often missing)
        smsPageViewsRes, waPageViewsRes, telecallerPageViewsRes, rcsPageViewsRes, websitePageViewsRes,
        // Expenses
        accountingRes,
        // Payments for revenue (all statuses for attempted count)
        paymentsAllRes,
        // Paid payments for revenue sum
        paidPaymentsRes,
        // SMS logs for daily trend
        smsLogsForTrendRes,
        // WhatsApp messages for trend
        waMessagesRes,
        // Leads for daily trend
        leadsForTrendRes,
        // Live WhatsApp template messages
        waTemplateMsgsRes,
      ] = await Promise.all([
        supabase.rpc("get_sms_stats", { start_date: dateFilter, end_date: dateEndFilter, p_company_id: companyId || null }),
        // Use RPC for accurate page view counts (handles both event types, excludes /admin)
        supabase.rpc("get_analytics_counts", { p_start: dateFilter, p_end: dateEndFilter, p_company_id: companyId || null }),
        // Leads exact count (with company filter)
        applyCompanyFilter(supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)),
        // Paid exact count (with company filter)
        applyCompanyFilter(supabase.from("payments").select("id", { count: "exact", head: true })
          .in("status", ["completed", "captured"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)),
        // Per-source leads (with company filter)
        applyCompanyFilter(supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("source.eq.sms,source.eq.marketing")),
        applyCompanyFilter(supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("source.eq.whatsapp,source.like.whatsapp%")),
        applyCompanyFilter(supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .eq("source", "telecaller")),
        applyCompanyFilter(supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .eq("source", "rcs")),
        applyCompanyFilter(supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("source.is.null,source.eq.website,source.eq.direct,source.like.website%")),
        // Per-source paid (with company filter)
        applyCompanyFilter(supabase.from("payments").select("id", { count: "exact", head: true })
          .in("status", ["completed", "captured"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .eq("payment_source", "marketing")),
        applyCompanyFilter(supabase.from("payments").select("id", { count: "exact", head: true })
          .in("status", ["completed", "captured"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .eq("payment_source", "whatsapp")),
        applyCompanyFilter(supabase.from("payments").select("id", { count: "exact", head: true })
          .in("status", ["completed", "captured"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .eq("payment_source", "telecaller")),
        applyCompanyFilter(supabase.from("payments").select("id", { count: "exact", head: true })
          .in("status", ["completed", "captured"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .eq("payment_source", "rcs" as any)),
        applyCompanyFilter(supabase.from("payments").select("id", { count: "exact", head: true })
          .in("status", ["completed", "captured"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .eq("payment_source", "direct")),
        // Page views per channel (with company filter on analytics_events)
        applyAnalyticsFilter(supabase.from("analytics_events").select("id", { count: "exact", head: true })
          .in("event_type", ["pageview", "page_view"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("utm_source.eq.sms,utm_medium.eq.sms,page_path.like./pay/marketing%,page_path.like./pay/sms%,page_path.like./marketing%")),
        applyAnalyticsFilter(supabase.from("analytics_events").select("id", { count: "exact", head: true })
          .in("event_type", ["pageview", "page_view"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("utm_source.eq.whatsapp,utm_medium.eq.whatsapp,page_path.like./pay/whatsapp%,page_path.like./pay/w%,page_path.like./whatsapp%")),
        applyAnalyticsFilter(supabase.from("analytics_events").select("id", { count: "exact", head: true })
          .in("event_type", ["pageview", "page_view"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("utm_source.eq.telecaller,utm_medium.eq.telecaller,page_path.like./pay/telecaller%,page_path.like./telecaller%")),
        applyAnalyticsFilter(supabase.from("analytics_events").select("id", { count: "exact", head: true })
          .in("event_type", ["pageview", "page_view"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("utm_source.eq.rcs,utm_medium.eq.rcs,page_path.like./pay/rcs%,page_path.like./rcs%")),
        // Website (direct) page views
        applyAnalyticsFilter(supabase.from("analytics_events").select("id", { count: "exact", head: true })
          .in("event_type", ["pageview", "page_view"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
          .or("page_path.eq./,page_path.like./payment%,page_path.like./pay/direct%")),
        // Expenses (with company filter)
        (() => {
          let q = supabase.from("accounting_entries").select("amount, category, entry_date")
            .eq("entry_type", "expense")
            .in("category", ["WhatsApp Meta", "PG Charges", "Marketing Meta", "SMS Charges"])
            .gte("entry_date", entryDateStart)
            .lte("entry_date", entryDateEnd).limit(10000);
          if (companyId) q = q.eq("company_id", companyId);
          return q;
        })(),
        // ALL payments for attempted count (with company filter)
        applyCompanyFilter(supabase.from("payments").select("id, created_at, status", { count: "exact", head: false })
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter).limit(50000)),
        // Paid payments with amounts for revenue (with company filter)
        applyCompanyFilter(supabase.from("payments").select("total_amount, payment_source, created_at")
          .in("status", ["completed", "captured"])
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter).limit(50000)),
        // SMS logs for daily trend (date + status only)
        supabase.from("sms_logs").select("created_at, status")
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter).limit(50000),
        // WhatsApp unified messages for trend (with company account filter)
        (() => {
          let q = supabase.from("unified_messages").select("created_at, direction, status, platform")
            .eq("platform", "whatsapp").eq("direction", "outgoing")
            .gte("created_at", dateFilter).lte("created_at", dateEndFilter).limit(50000);
          if (companyId && waAccountIds.length > 0) q = q.in("account_id", waAccountIds);
          return q;
        })(),
        // Leads for daily trend (with company filter)
        applyCompanyFilter(supabase.from("leads").select("created_at")
          .gte("created_at", dateFilter).lte("created_at", dateEndFilter).limit(50000)),
        // Live WhatsApp template messages for real-time cost (with company account filter)
        (() => {
          let q = supabase.from("whatsapp_messages").select("message_type, content, status")
            .eq("direction", "outgoing")
            .in("status", ["sent", "delivered", "read"])
            .gte("created_at", dateFilter).lte("created_at", dateEndFilter)
            .limit(50000);
          if (companyId && waAccountIds.length > 0) q = q.in("account_id", waAccountIds);
          return q;
        })(),
      ]);

      const smsRpc: any = smsRpcRes.data?.[0] || {};
      const analyticsRpc: any = analyticsRpcRes.data?.[0] || {};
      const paidPayments = paidPaymentsRes.data || [];
      const expenses = accountingRes.data || [];
      const smsLogsForTrend = smsLogsForTrendRes.data || [];
      const waMessages = waMessagesRes.data || [];
      const leadsForTrend = leadsForTrendRes.data || [];
      const allPayments = paymentsAllRes.data || [];
      const waTemplateMsgs = waTemplateMsgsRes.data || [];

      // Exact server-side counts
      const serverTotalLeads = leadsCountRes.count || 0;
      const serverTotalPaid = paymentsCountRes.count || 0;
      const serverTotalPageViews = Number(analyticsRpc.pageviews) || 0;
      const serverTotalRevenue = paidPayments.reduce((s, p) => s + (p.total_amount || 0), 0);
      setExactTotals({ leads: serverTotalLeads, paid: serverTotalPaid, pageViews: serverTotalPageViews, revenue: serverTotalRevenue });

      // Per-channel exact counts
      const smsPageViews = smsPageViewsRes.count ?? 0;
      const waPageViews = waPageViewsRes.count ?? 0;
      const telecallerPageViews = telecallerPageViewsRes.count ?? 0;
      const rcsPageViews = rcsPageViewsRes.count ?? 0;
      const websitePageViews = websitePageViewsRes.count ?? 0;

      const smsLeadsExact = smsLeadsCountRes.count ?? 0;
      const waLeadsExact = waLeadsCountRes.count ?? 0;
      const telecallerLeadsExact = telecallerLeadsCountRes.count ?? 0;
      const rcsLeadsExact = rcsLeadsCountRes.count ?? 0;
      const directLeadsExact = directLeadsCountRes.count ?? 0;

      const smsPaidExact = smsPaidCountRes.count ?? 0;
      const waPaidExact = waPaidCountRes.count ?? 0;
      const telecallerPaidExact = telecallerPaidCountRes.count ?? 0;
      const rcsPaidExact = rcsPaidCountRes.count ?? 0;
      const directPaidExact = directPaidCountRes.count ?? 0;

      // Revenue by source
      const revenueBySource = (source: string) => paidPayments.filter(p => p.payment_source === source).reduce((s, p) => s + (p.total_amount || 0), 0);

      // SMS expense
      const smsExpense = expenses.filter(e => e.category === "SMS Charges").reduce((s, e) => s + e.amount, 0) || Number(smsRpc.total_cost) || 0;

      // SMS Channel
      const smsStats: ChannelStats = {
        channel: "SMS",
        total: Number(smsRpc.total_count) || 0,
        delivered: Number(smsRpc.delivered_count) || 0,
        submitted: (Number(smsRpc.sent_count) || 0) + (Number(smsRpc.submitted_count) || 0),
        failed: Number(smsRpc.failed_count) || 0,
        rejected: Number(smsRpc.rejected_count) || 0,
        pending: Number(smsRpc.pending_count) || 0,
        linkVisited: smsPageViews,
        cost: smsExpense,
        revenue: revenueBySource("marketing"),
        leads: smsLeadsExact,
        paid: smsPaidExact,
      };

      // WhatsApp Channel — linkVisited is page views, NOT message count
      const waStats: ChannelStats = {
        channel: "WhatsApp",
        total: waMessages.length,
        delivered: waMessages.filter(m => m.status === "delivered" || m.status === "read").length,
        submitted: waMessages.filter(m => m.status === "sent").length,
        failed: waMessages.filter(m => m.status === "failed").length,
        rejected: 0,
        pending: waMessages.filter(m => m.status === "pending" || m.status === "queued").length,
        linkVisited: waPageViews,
        cost: (() => {
          const waAccountingExp = expenses.filter(e => e.category === "WhatsApp Meta").reduce((s, e) => s + e.amount, 0);
          const MARKETING_RATE = 0.8631;
          let liveCost = 0;
          waTemplateMsgs.forEach(m => { if (m.message_type === "template") liveCost += MARKETING_RATE; });
          return Math.max(waAccountingExp, liveCost);
        })(),
        revenue: revenueBySource("whatsapp"),
        leads: waLeadsExact,
        paid: waPaidExact,
      };

      // Telecaller Channel — total = leads sourced from telecaller (not leads + paid which double-counts)
      const telecallerStats: ChannelStats = {
        channel: "Telecaller",
        total: telecallerLeadsExact,
        delivered: telecallerLeadsExact,
        submitted: 0, failed: 0, rejected: 0, pending: 0,
        linkVisited: telecallerPageViews,
        cost: 0,
        revenue: revenueBySource("telecaller"),
        leads: telecallerLeadsExact,
        paid: telecallerPaidExact,
      };

      // RCS Channel
      const rcsStats: ChannelStats = {
        channel: "RCS",
        total: rcsLeadsExact,
        delivered: rcsLeadsExact,
        submitted: 0, failed: 0, rejected: 0, pending: 0,
        linkVisited: rcsPageViews,
        cost: 0,
        revenue: revenueBySource("rcs"),
        leads: rcsLeadsExact,
        paid: rcsPaidExact,
      };

      // Website (Direct)
      const websiteExpense = expenses.filter(e => e.category === "PG Charges" || e.category === "Marketing Meta").reduce((s, e) => s + e.amount, 0);
      const websiteStats: ChannelStats = {
        channel: "Website (Direct)",
        total: 0,
        delivered: 0,
        submitted: 0, failed: 0, rejected: 0, pending: 0,
        linkVisited: websitePageViews,
        cost: websiteExpense,
        revenue: revenueBySource("direct"),
        leads: directLeadsExact,
        paid: directPaidExact,
      };

      const allStats = [smsStats, waStats, telecallerStats, rcsStats, websiteStats];
      setChannelStats(allStats);

      // Payments attempted count
      const paymentsAttempted = allPayments.length;

      // Funnel uses exact server counts
      setFunnelData([
        { name: "Page Views", value: serverTotalPageViews, fill: "#8B5CF6" },
        { name: "Leads Created", value: serverTotalLeads, fill: "#3B82F6" },
        { name: "Payments Attempted", value: paymentsAttempted, fill: "#F59E0B" },
        { name: "Paid Customers", value: serverTotalPaid, fill: "#22C55E" },
      ]);

      // Daily trend with SMS + WhatsApp + Leads + Paid (IST dates)
      const dayMap: Record<string, Record<string, number>> = {};
      const allDates = new Set<string>();

      // Add SMS logs to trend (IST)
      smsLogsForTrend.forEach(m => {
        const d = toISTDate(m.created_at);
        allDates.add(d);
        if (!dayMap[d]) dayMap[d] = {};
        dayMap[d]["SMS"] = (dayMap[d]["SMS"] || 0) + 1;
      });

      // Add WhatsApp to trend (IST)
      waMessages.forEach(m => {
        const d = toISTDate(m.created_at);
        allDates.add(d);
        if (!dayMap[d]) dayMap[d] = {};
        dayMap[d]["WhatsApp"] = (dayMap[d]["WhatsApp"] || 0) + 1;
      });

      // Add leads to trend (IST)
      leadsForTrend.forEach(l => {
        const d = toISTDate(l.created_at);
        allDates.add(d);
        if (!dayMap[d]) dayMap[d] = {};
        dayMap[d]["Leads"] = (dayMap[d]["Leads"] || 0) + 1;
      });

      // Add paid conversions to trend (IST)
      paidPayments.forEach(p => {
        const d = toISTDate(p.created_at);
        allDates.add(d);
        if (!dayMap[d]) dayMap[d] = {};
        dayMap[d]["Paid"] = (dayMap[d]["Paid"] || 0) + 1;
      });

      const sortedDates = Array.from(allDates).sort();
      setTrendData(sortedDates.map(date => ({
        date: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        SMS: dayMap[date]?.["SMS"] || 0,
        WhatsApp: dayMap[date]?.["WhatsApp"] || 0,
        Leads: dayMap[date]?.["Leads"] || 0,
        Paid: dayMap[date]?.["Paid"] || 0,
      })));

    } catch (error) {
      console.error("Marketing report error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Aggregated totals
  const totals = useMemo(() => {
    const filtered = selectedChannel
      ? channelStats.filter(c => c.channel === selectedChannel)
      : channelStats;
    return {
      total: filtered.reduce((s, c) => s + c.total, 0),
      delivered: filtered.reduce((s, c) => s + c.delivered, 0),
      submitted: filtered.reduce((s, c) => s + c.submitted, 0),
      failed: filtered.reduce((s, c) => s + c.failed, 0),
      rejected: filtered.reduce((s, c) => s + c.rejected, 0),
      pending: filtered.reduce((s, c) => s + c.pending, 0),
      linkVisited: filtered.reduce((s, c) => s + c.linkVisited, 0),
    };
  }, [channelStats, selectedChannel]);

  const totalSpend = channelStats.reduce((s, c) => s + c.cost, 0);
  const totalRevenue = exactTotals.revenue || channelStats.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = exactTotals.leads || channelStats.reduce((s, c) => s + c.leads, 0);
  const totalPaid = exactTotals.paid || channelStats.reduce((s, c) => s + c.paid, 0);
  const netProfit = totalRevenue - totalSpend;
  const overallROI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend * 100) : 0;

  const revenuePieData = channelStats
    .filter(c => c.revenue > 0)
    .map(c => ({ name: c.channel, value: c.revenue, fill: CHANNEL_COLORS[c.channel] || "#888" }));

  const spendPieData = channelStats
    .filter(c => c.cost > 0)
    .map(c => ({ name: c.channel, value: c.cost, fill: CHANNEL_COLORS[c.channel] || "#888" }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Revenue Highlight Banner — 5 cards including Profit/Loss */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-500/10 to-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">{totalPaid} paid customers</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-500/10 to-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Spend</p>
            <p className="text-2xl font-bold text-red-500">₹{totalSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
          </CardContent>
        </Card>
        {/* Profit / Loss card */}
        <Card className={`border-l-4 ${netProfit >= 0 ? "border-l-emerald-500 bg-gradient-to-r from-emerald-500/10" : "border-l-rose-500 bg-gradient-to-r from-rose-500/10"} to-transparent`}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Net Profit / Loss</p>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
              {netProfit >= 0 ? "+" : ""}₹{Math.abs(netProfit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Margin: {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0"}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/10 to-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Leads</p>
            <p className="text-2xl font-bold text-blue-600">{totalLeads.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">CPL: ₹{totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "0"}</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${overallROI >= 0 ? "border-l-green-500 bg-gradient-to-r from-green-500/10" : "border-l-red-500 bg-gradient-to-r from-red-500/10"} to-transparent`}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Overall ROI</p>
            <p className={`text-2xl font-bold ${overallROI >= 0 ? "text-green-600" : "text-red-500"}`}>
              {overallROI > 0 ? "+" : ""}{overallROI.toFixed(0)}%
            </p>
            <p className="text-[10px] text-muted-foreground">Page Views: {exactTotals.pageViews.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Selector Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedChannel(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !selectedChannel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All Channels
        </button>
        {channelStats.map(ch => (
          <button
            key={ch.channel}
            onClick={() => setSelectedChannel(ch.channel === selectedChannel ? null : ch.channel)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
              selectedChannel === ch.channel ? "text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            style={selectedChannel === ch.channel ? { backgroundColor: CHANNEL_COLORS[ch.channel] } : {}}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[ch.channel] }} />
            {ch.channel}
          </button>
        ))}
      </div>

      {/* Delivery Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {STATUS_CARDS.map(card => {
          const Icon = card.icon;
          const value = totals[card.key as keyof typeof totals];
          return (
            <Card key={card.key} className={`border-l-4 ${card.border} bg-card`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{card.label}</span>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold">{value.toLocaleString("en-IN")}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Funnel moved to Leads tab — see Full Funnel Trend Chart */}

      {/* Per-Channel Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Channel-wise Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-2.5 font-semibold">Channel</th>
                  <th className="text-right p-2.5 font-semibold">Total</th>
                  <th className="text-right p-2.5 font-semibold">Delivered</th>
                  <th className="text-right p-2.5 font-semibold">Page Views</th>
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
                {channelStats.map(ch => {
                  const chROI = ch.cost > 0 && isFinite(ch.revenue) ? ((ch.revenue - ch.cost) / ch.cost * 100) : 0;
                  const chProfit = ch.revenue - ch.cost;
                  return (
                    <tr key={ch.channel} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-2.5 font-medium flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[ch.channel] }} />
                        {ch.channel}
                      </td>
                      <td className="text-right p-2.5 font-mono">{ch.total > 0 ? ch.total.toLocaleString("en-IN") : "—"}</td>
                      <td className="text-right p-2.5 font-mono text-green-600">{ch.delivered > 0 ? ch.delivered.toLocaleString("en-IN") : "—"}</td>
                      <td className="text-right p-2.5 font-mono text-cyan-500">{(ch.linkVisited || 0) > 0 ? (ch.linkVisited || 0).toLocaleString("en-IN") : "—"}</td>
                      <td className="text-right p-2.5 font-mono text-red-500">{ch.failed > 0 ? ch.failed.toLocaleString("en-IN") : "—"}</td>
                      <td className="text-right p-2.5 font-mono">{ch.leads.toLocaleString("en-IN")}</td>
                      <td className="text-right p-2.5 font-mono text-green-600 font-bold">{ch.paid.toLocaleString("en-IN")}</td>
                      <td className="text-right p-2.5 font-mono text-green-600 font-bold">₹{ch.revenue.toLocaleString("en-IN")}</td>
                      <td className="text-right p-2.5 font-mono text-red-500">₹{ch.cost > 0 ? ch.cost.toFixed(2) : "0"}</td>
                      <td className={`text-right p-2.5 font-mono font-bold ${chProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {chProfit >= 0 ? "+" : ""}₹{Math.abs(chProfit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`text-right p-2.5 font-mono font-bold ${chROI >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {ch.cost > 0 ? `${chROI > 0 ? "+" : ""}${chROI.toFixed(0)}%` : "—"}
                      </td>
                      <td className="text-right p-2.5 font-mono font-bold">
                        {ch.leads > 0 ? ((ch.paid / ch.leads) * 100).toFixed(1) : ch.paid > 0 ? "100.0" : "0.0"}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-muted/40 font-semibold">
                  <td className="p-2.5">Total</td>
                  <td className="text-right p-2.5 font-mono">{channelStats.reduce((s,c)=>s+c.total,0).toLocaleString("en-IN")}</td>
                  <td className="text-right p-2.5 font-mono text-green-600">{channelStats.reduce((s,c)=>s+c.delivered,0).toLocaleString("en-IN")}</td>
                  <td className="text-right p-2.5 font-mono text-cyan-500">{exactTotals.pageViews.toLocaleString("en-IN")}</td>
                  <td className="text-right p-2.5 font-mono text-red-500">{channelStats.reduce((s,c)=>s+c.failed,0).toLocaleString("en-IN")}</td>
                  <td className="text-right p-2.5 font-mono">{totalLeads.toLocaleString("en-IN")}</td>
                  <td className="text-right p-2.5 font-mono text-green-600 font-bold">{totalPaid.toLocaleString("en-IN")}</td>
                  <td className="text-right p-2.5 font-mono text-green-600 font-bold">₹{totalRevenue.toLocaleString("en-IN")}</td>
                  <td className="text-right p-2.5 font-mono text-red-500">₹{totalSpend.toFixed(2)}</td>
                  <td className={`text-right p-2.5 font-mono font-bold ${(totalRevenue - totalSpend) >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {(totalRevenue - totalSpend) >= 0 ? "+" : ""}₹{Math.abs(totalRevenue - totalSpend).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className={`text-right p-2.5 font-mono font-bold ${overallROI >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {totalSpend > 0 ? `${overallROI > 0 ? "+" : ""}${overallROI.toFixed(0)}%` : "—"}
                  </td>
                  <td className="text-right p-2.5 font-mono font-bold">
                    {totalLeads > 0 ? ((totalPaid / totalLeads) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ROI & Spend Analysis — show ALL sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <IndianRupee className="w-4 h-4" />
              Marketing Spend & ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {channelStats.map(ch => {
                const roi = ch.cost > 0 ? ((ch.revenue - ch.cost) / ch.cost * 100) : 0;
                const costPerLead = ch.leads > 0 ? ch.cost / ch.leads : 0;
                const channelProfit = ch.revenue - ch.cost;
                return (
                  <div key={ch.channel} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[ch.channel] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{ch.channel}</p>
                      <div className="flex gap-4 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                        <span>Spend: ₹{ch.cost > 0 ? ch.cost.toFixed(2) : "0"}</span>
                        <span className="text-green-600 font-medium">Revenue: ₹{ch.revenue.toLocaleString("en-IN")}</span>
                        <span>CPL: ₹{costPerLead > 0 ? costPerLead.toFixed(2) : "0"}</span>
                        <span className={channelProfit >= 0 ? "text-emerald-600 font-medium" : "text-rose-500 font-medium"}>
                          P/L: {channelProfit >= 0 ? "+" : ""}₹{Math.abs(channelProfit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${roi >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {ch.cost > 0 ? `${roi > 0 ? "+" : ""}${roi.toFixed(0)}%` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">ROI</p>
                    </div>
                  </div>
                );
              })}
              {/* Summary */}
              <div className="border-t pt-3 mt-3 flex justify-between text-xs font-semibold">
                <div>
                  <p className="text-muted-foreground">Total Spend</p>
                  <p className="text-base text-red-500">₹{totalSpend.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Total Revenue</p>
                  <p className="text-base text-green-600">₹{totalRevenue.toLocaleString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Net Profit</p>
                  <p className={`text-base font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {netProfit >= 0 ? "+" : ""}₹{Math.abs(netProfit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue + Spend Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Revenue & Spend Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-semibold text-center text-green-600 mb-1">Revenue</p>
                {revenuePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={revenuePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: "8px" }}>
                        {revenuePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[160px] flex items-center justify-center text-[10px] text-muted-foreground">No revenue</div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-center text-red-500 mb-1">Spend</p>
                {spendPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={spendPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: "8px" }}>
                        {spendPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[160px] flex items-center justify-center text-[10px] text-muted-foreground">No spend data</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default MarketingReport;
