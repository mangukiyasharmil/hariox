import { useState, useEffect, useMemo } from "react";
import { startOfDayIST, endOfDayIST, formatISTDate, getISTDateNDaysAgo } from "@/lib/dateUtils";
import {
  Megaphone, Eye, Users, Target, IndianRupee, RefreshCw,
  TrendingUp, BarChart3, PieChart as PieChartIcon, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

interface CampaignRow {
  campaign: string;
  sources: string[];
  mediums: string[];
  visitors: number;
  leads: number;
  paid: number;
  revenue: number;
  conversionRate: number;
}

type DateRange = "today" | "yesterday" | "7d" | "28d" | "90d";

const DATE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7D" },
  { key: "28d", label: "28D" },
  { key: "90d", label: "90D" },
];

const MetaAdsPerformance = () => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [rawData, setRawData] = useState<{
    leads: any[];
    payments: any[];
    events: any[];
    prevLeads: any[];
    prevPayments: any[];
    prevEvents: any[];
    paymentLeadUtms: Record<string, { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }>;
  }>({ leads: [], payments: [], events: [], prevLeads: [], prevPayments: [], prevEvents: [], paymentLeadUtms: {} });

  useEffect(() => {
    fetchData();
  }, [dateRange, currentCompany?.id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const todayIST = formatISTDate(now);
      let startIso: string;
      let endIso: string = endOfDayIST(todayIST).toISOString();
      let prevStartIso: string;
      let prevEndIso: string;

      if (dateRange === "today") {
        startIso = startOfDayIST(todayIST).toISOString();
        const yest = getISTDateNDaysAgo(1);
        prevStartIso = startOfDayIST(yest).toISOString();
        prevEndIso = endOfDayIST(yest).toISOString();
      } else if (dateRange === "yesterday") {
        const yest = getISTDateNDaysAgo(1);
        startIso = startOfDayIST(yest).toISOString();
        endIso = endOfDayIST(yest).toISOString();
        const dayBefore = getISTDateNDaysAgo(2);
        prevStartIso = startOfDayIST(dayBefore).toISOString();
        prevEndIso = endOfDayIST(dayBefore).toISOString();
      } else {
        const days = parseInt(dateRange.replace("d", ""));
        startIso = startOfDayIST(getISTDateNDaysAgo(days)).toISOString();
        prevStartIso = startOfDayIST(getISTDateNDaysAgo(days * 2)).toISOString();
        prevEndIso = startIso;
      }

      const companyId = getCompanyFilter();

      // Current period
      let leadsQuery = supabase
        .from("leads")
        .select("id, utm_source, utm_medium, utm_campaign, status, created_at")
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .limit(5000);
      if (companyId) leadsQuery = leadsQuery.eq("company_id", companyId);

      let eventsQuery = supabase
        .from("analytics_events")
        .select("visitor_id, utm_source, utm_medium, utm_campaign")
        .eq("event_type", "pageview")
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .limit(5000);
      if (companyId) eventsQuery = eventsQuery.eq("company_id", companyId);

      // Fetch payments by PAYMENT DATE (not lead creation date)
      // This ensures telecaller/whatsapp/sms payments are attributed to original UTM campaign
      let paymentsQuery = supabase
        .from("payments")
        .select("lead_id, total_amount, status, created_at")
        .in("status", ["completed", "captured"])
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .limit(5000);
      if (companyId) paymentsQuery = paymentsQuery.eq("company_id", companyId);

      // Previous period
      let prevLeadsQuery = supabase
        .from("leads")
        .select("id, utm_source, utm_medium, utm_campaign, status, created_at")
        .gte("created_at", prevStartIso)
        .lte("created_at", prevEndIso)
        .limit(5000);
      if (companyId) prevLeadsQuery = prevLeadsQuery.eq("company_id", companyId);

      let prevEventsQuery = supabase
        .from("analytics_events")
        .select("visitor_id, utm_source, utm_medium, utm_campaign")
        .eq("event_type", "pageview")
        .gte("created_at", prevStartIso)
        .lte("created_at", prevEndIso)
        .limit(5000);
      if (companyId) prevEventsQuery = prevEventsQuery.eq("company_id", companyId);

      let prevPaymentsQuery = supabase
        .from("payments")
        .select("lead_id, total_amount, status, created_at")
        .in("status", ["completed", "captured"])
        .gte("created_at", prevStartIso)
        .lte("created_at", prevEndIso)
        .limit(5000);
      if (companyId) prevPaymentsQuery = prevPaymentsQuery.eq("company_id", companyId);

      const [{ data: leads }, { data: events }, { data: payments }, { data: prevLeads }, { data: prevEvents }, { data: prevPayments }] = await Promise.all([
        leadsQuery, eventsQuery, paymentsQuery, prevLeadsQuery, prevEventsQuery, prevPaymentsQuery,
      ]);

      // For payments, fetch the UTM data from their associated leads
      const paymentLeadIds = [...new Set((payments || []).map(p => p.lead_id))];
      let paymentLeadUtms: Record<string, { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }> = {};
      if (paymentLeadIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < paymentLeadIds.length; i += 200) chunks.push(paymentLeadIds.slice(i, i + 200));
        const results = await Promise.all(
          chunks.map(chunk =>
            supabase.from("leads").select("id, utm_source, utm_medium, utm_campaign").in("id", chunk)
          )
        );
        results.flatMap(r => r.data || []).forEach(l => {
          paymentLeadUtms[l.id] = { utm_source: l.utm_source, utm_medium: l.utm_medium, utm_campaign: l.utm_campaign };
        });
      }

      // Same for previous period payments
      const prevPaymentLeadIds = [...new Set((prevPayments || []).map(p => p.lead_id))];
      if (prevPaymentLeadIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < prevPaymentLeadIds.length; i += 200) chunks.push(prevPaymentLeadIds.slice(i, i + 200));
        const results = await Promise.all(
          chunks.map(chunk =>
            supabase.from("leads").select("id, utm_source, utm_medium, utm_campaign").in("id", chunk)
          )
        );
        results.flatMap(r => r.data || []).forEach(l => {
          if (!paymentLeadUtms[l.id]) {
            paymentLeadUtms[l.id] = { utm_source: l.utm_source, utm_medium: l.utm_medium, utm_campaign: l.utm_campaign };
          }
        });
      }

      setRawData({
        leads: leads || [], payments: payments || [], events: events || [],
        prevLeads: prevLeads || [], prevPayments: prevPayments || [], prevEvents: prevEvents || [],
        paymentLeadUtms,
      });
    } catch (err) {
      console.error("Meta ads fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const { campaigns, summary, sourceDistribution, platformBreakdown, utmHealth, barChartData, prevSummary } = useMemo(() => {
    const { leads, payments, events, prevLeads, prevPayments, prevEvents, paymentLeadUtms } = rawData;

    // Build payment lookup keyed by lead_id (from payments in date range)
    const revenueByLead: Record<string, number> = {};
    const paidLeadIds = new Set<string>();
    payments.forEach(p => {
      paidLeadIds.add(p.lead_id);
      revenueByLead[p.lead_id] = (revenueByLead[p.lead_id] || 0) + (p.total_amount || 0);
    });

    // Build campaign map from analytics events (visitors)
    const campaignMap: Record<string, {
      sources: Set<string>; mediums: Set<string>;
      visitors: Set<string>; leads: number; paid: number; revenue: number;
    }> = {};

    const normalize = (val: string | null) => (val || "").trim().toLowerCase();
    const getCampaignKey = (c: string | null) => normalize(c) || "direct";

    const ensureKey = (key: string) => {
      if (!campaignMap[key]) campaignMap[key] = { sources: new Set(), mediums: new Set(), visitors: new Set(), leads: 0, paid: 0, revenue: 0 };
    };

    events.forEach(e => {
      const key = getCampaignKey(e.utm_campaign);
      ensureKey(key);
      if (e.utm_source) campaignMap[key].sources.add(normalize(e.utm_source));
      if (e.utm_medium) campaignMap[key].mediums.add(normalize(e.utm_medium));
      if (e.visitor_id) campaignMap[key].visitors.add(e.visitor_id);
    });

    // Add leads to their campaign bucket
    let withUtm = 0, withoutUtm = 0;
    leads.forEach(l => {
      const key = getCampaignKey(l.utm_campaign);
      ensureKey(key);
      if (l.utm_source) campaignMap[key].sources.add(normalize(l.utm_source));
      if (l.utm_medium) campaignMap[key].mediums.add(normalize(l.utm_medium));
      campaignMap[key].leads++;
      if (l.utm_source || l.utm_medium || l.utm_campaign) withUtm++;
      else withoutUtm++;
    });

    // Attribute paid conversions using PAYMENT DATE data + lead UTM lookup
    // This ensures telecaller/whatsapp/sms payments are attributed to original UTM campaign
    payments.forEach(p => {
      const leadUtm = paymentLeadUtms[p.lead_id];
      const key = getCampaignKey(leadUtm?.utm_campaign || null);
      ensureKey(key);
      if (leadUtm?.utm_source) campaignMap[key].sources.add(normalize(leadUtm.utm_source));
      if (leadUtm?.utm_medium) campaignMap[key].mediums.add(normalize(leadUtm.utm_medium));
    });

    // Now set paid/revenue from payment-date-based data
    // Reset paid/revenue first (was previously set from lead-date logic)
    Object.values(campaignMap).forEach(v => { v.paid = 0; v.revenue = 0; });
    const countedPaymentLeads = new Set<string>();
    payments.forEach(p => {
      if (countedPaymentLeads.has(p.lead_id)) return;
      countedPaymentLeads.add(p.lead_id);
      const leadUtm = paymentLeadUtms[p.lead_id];
      const key = getCampaignKey(leadUtm?.utm_campaign || null);
      ensureKey(key);
      campaignMap[key].paid++;
      campaignMap[key].revenue += revenueByLead[p.lead_id] || 0;
    });

    const rows: CampaignRow[] = Object.entries(campaignMap)
      .map(([campaign, data]) => ({
        campaign,
        sources: Array.from(data.sources),
        mediums: Array.from(data.mediums),
        visitors: data.visitors.size,
        leads: data.leads,
        paid: data.paid,
        revenue: data.revenue,
        conversionRate: data.leads > 0 ? (data.paid / data.leads) * 100 : 0,
      }))
      .sort((a, b) => {
        if (a.campaign === "direct") return 1;
        if (b.campaign === "direct") return -1;
        return b.leads - a.leads || b.visitors - a.visitors;
      });

     // Source distribution for pie chart
     const sourceMap: Record<string, number> = {};
     leads.forEach(l => {
       const src = normalize(l.utm_source) || "direct";
       sourceMap[src] = (sourceMap[src] || 0) + 1;
     });
     const SOURCE_LABELS: Record<string, string> = {
       direct: "⚠️ Missing UTM",
       facebook: "Facebook",
       fb: "Facebook",
       instagram: "Instagram",
       ig: "Instagram",
       google: "Google Ads",
     };
     const mergedSourceMap: Record<string, number> = {};
     Object.entries(sourceMap).forEach(([src, count]) => {
       const label = SOURCE_LABELS[src] || src.toUpperCase();
       mergedSourceMap[label] = (mergedSourceMap[label] || 0) + count;
     });
     const sourceDistribution = Object.entries(mergedSourceMap)
       .map(([name, value]) => ({ name, value }))
       .sort((a, b) => b.value - a.value)
       .slice(0, 8);

     // Platform breakdown
     const platformMap: Record<string, { visitors: number; leads: number; paid: number; revenue: number }> = {};
     const getPlatform = (src: string | null) => {
       const s = normalize(src);
       if (s === "facebook" || s === "fb") return "Facebook";
       if (s === "instagram" || s === "ig") return "Instagram";
       if (s === "google") return "Google Ads";
       if (!s) return "Unknown";
       return s.toUpperCase();
     };
     events.forEach(e => {
       const p = getPlatform(e.utm_source);
       if (!platformMap[p]) platformMap[p] = { visitors: 0, leads: 0, paid: 0, revenue: 0 };
       if (e.visitor_id) platformMap[p].visitors++;
     });
     leads.forEach(l => {
       const p = getPlatform(l.utm_source);
       if (!platformMap[p]) platformMap[p] = { visitors: 0, leads: 0, paid: 0, revenue: 0 };
       platformMap[p].leads++;
     });
     // Attribute platform paid/revenue from payment-date data
     countedPaymentLeads.forEach(leadId => {
       const leadUtm = paymentLeadUtms[leadId];
       const p = getPlatform(leadUtm?.utm_source || null);
       if (!platformMap[p]) platformMap[p] = { visitors: 0, leads: 0, paid: 0, revenue: 0 };
       platformMap[p].paid++;
       platformMap[p].revenue += revenueByLead[leadId] || 0;
     });
     const platformBreakdown = Object.entries(platformMap)
       .map(([platform, data]) => ({ platform, ...data, conversionRate: data.leads > 0 ? (data.paid / data.leads) * 100 : 0 }))
       .sort((a, b) => b.leads - a.leads);

    const totalLeads = leads.length;
    const totalPaid = new Set(payments.map(p => p.lead_id)).size;
    const totalRevenue = Object.values(revenueByLead).reduce((a, b) => a + b, 0);
    const totalVisitors = new Set(events.filter(e => e.visitor_id).map(e => e.visitor_id)).size;
    const utmHealth = totalLeads > 0 ? Math.round((withUtm / totalLeads) * 100) : 0;

    // Previous period summary
    const prevPaidSet = new Set(prevPayments.map(p => p.lead_id));
    const prevRevenue = prevPayments.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
    const prevVisitors = new Set(prevEvents.filter(e => e.visitor_id).map(e => e.visitor_id)).size;
    const prevSummary = {
      totalLeads: prevLeads.length,
      totalPaid: prevPaidSet.size,
      totalRevenue: prevRevenue,
      totalVisitors: prevVisitors,
    };

    // Bar chart data
    const barChartData = rows
      .filter(c => c.leads > 0 && c.campaign !== "direct")
      .slice(0, 6)
      .map(c => ({
        name: formatCampaignLabel(c.campaign),
        Leads: c.leads,
        Paid: c.paid,
      }));

     return {
       campaigns: rows,
       summary: { totalLeads, totalPaid, totalRevenue, totalVisitors, withUtm, withoutUtm },
       sourceDistribution,
       platformBreakdown,
       utmHealth,
       barChartData,
       prevSummary,
     };
  }, [rawData]);

  const getDodPct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };
  const dodLabel = dateRange === "today" ? "vs Yesterday" : dateRange === "yesterday" ? "vs Day Before" : `vs Prev ${dateRange.toUpperCase()}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Ads Performance</h2>
            <p className="text-xs text-muted-foreground">Track Facebook, Instagram & Google ads</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
          {DATE_OPTIONS.map(({ key, label }) => (
            <Button
              key={key}
              size="sm"
              variant={dateRange === key ? "default" : "ghost"}
              className={`h-7 px-3 text-xs ${dateRange === key ? "" : "text-muted-foreground"}`}
              onClick={() => setDateRange(key)}
            >
              {label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fetchData}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* UTM Health Alert */}
      {summary.totalLeads > 0 && utmHealth < 50 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-600">Only {utmHealth}% leads have UTM tracking</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.withoutUtm} leads missing attribution. Add UTM params to your ad URLs.
            </p>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">{utmHealth}%</Badge>
        </div>
      )}

      {/* Summary Cards with DoD trends */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Visitors", value: summary.totalVisitors, prev: prevSummary.totalVisitors, icon: Eye, color: "text-blue-500", bgColor: "bg-blue-500/10" },
          { label: "Leads", value: summary.totalLeads, prev: prevSummary.totalLeads, icon: Users, color: "text-violet-500", bgColor: "bg-violet-500/10" },
          { label: "Conversions", value: summary.totalPaid, prev: prevSummary.totalPaid, icon: Target, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
          { label: "Revenue", value: summary.totalRevenue, prev: prevSummary.totalRevenue, icon: IndianRupee, color: "text-amber-500", bgColor: "bg-amber-500/10", isCurrency: true },
        ].map(card => {
          const dodPct = getDodPct(card.value, card.prev);
          return (
            <Card key={card.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-md ${card.bgColor}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  {card.label === "Conversions" && summary.totalLeads > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {((summary.totalPaid / summary.totalLeads) * 100).toFixed(1)}% CR
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight">
                  {(card as any).isCurrency ? `₹${card.value.toLocaleString("en-IN")}` : card.value.toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-[11px] text-muted-foreground">{card.label}</p>
                  {(card.value > 0 || card.prev > 0) && (
                    <span className={`text-[10px] font-semibold ${dodPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {dodPct >= 0 ? "↑" : "↓"}{Math.abs(dodPct).toFixed(0)}%
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Insights Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-muted-foreground mb-1">Cost Per Lead</p>
            <p className="text-lg font-bold">—</p>
            <p className="text-[10px] text-muted-foreground">Connect ad spend for CPL</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-muted-foreground mb-1">Avg Revenue / Lead</p>
            <p className="text-lg font-bold">
              {summary.totalPaid > 0 ? `₹${Math.round(summary.totalRevenue / summary.totalPaid).toLocaleString("en-IN")}` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Per conversion</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-muted-foreground mb-1">Visitor → Lead %</p>
            <p className="text-lg font-bold">
              {summary.totalVisitors > 0 ? `${((summary.totalLeads / summary.totalVisitors) * 100).toFixed(1)}%` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Landing page conv.</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-muted-foreground mb-1">{dodLabel}</p>
            <div className="flex items-center gap-2">
              {[
                { label: "Leads", curr: summary.totalLeads, prev: prevSummary.totalLeads },
                { label: "Revenue", curr: summary.totalRevenue, prev: prevSummary.totalRevenue },
              ].map(m => {
                const pct = getDodPct(m.curr, m.prev);
                return (
                  <div key={m.label} className="flex-1">
                    <p className={`text-sm font-bold ${pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {pct >= 0 ? "+" : ""}{pct.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Campaign Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {barChartData.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No campaign data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Lead Sources</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {sourceDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-56 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                        {sourceDistribution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 min-w-[120px]">
                  {sourceDistribution.slice(0, 5).map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{s.name}</span>
                      <span className="font-semibold ml-auto">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown (FB vs IG vs Google) */}
      {platformBreakdown.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Platform Breakdown</CardTitle>
              <Badge variant="secondary" className="text-[10px] h-5">{platformBreakdown.filter(p => p.platform !== "Unknown").length} platforms</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {platformBreakdown.filter(p => p.platform !== "Unknown").map(p => (
                <div key={p.platform} className="rounded-xl border border-border/50 p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.platform === "Facebook" ? "📘" : p.platform === "Instagram" ? "📸" : p.platform === "Google Ads" ? "🔍" : "📊"}</span>
                    <span className="font-semibold text-sm">{p.platform}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Visitors</p>
                      <p className="font-bold text-base">{p.visitors.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Leads</p>
                      <p className="font-bold text-base">{p.leads.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Paid</p>
                      <p className="font-bold text-base text-emerald-600">{p.paid}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conv %</p>
                      <p className="font-bold text-base">{p.conversionRate.toFixed(1)}%</p>
                    </div>
                  </div>
                  {p.revenue > 0 && (
                    <div className="pt-1 border-t border-border/30 text-xs">
                      <span className="text-muted-foreground">Revenue: </span>
                      <span className="font-semibold">₹{p.revenue.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Campaigns Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">All Campaigns</CardTitle>
              <Badge variant="secondary" className="text-[10px] h-5">{campaigns.filter(c => c.campaign !== "direct").length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2.5 text-left text-xs font-medium text-muted-foreground">Campaign</th>
                  <th className="pb-2.5 text-left text-xs font-medium text-muted-foreground">Source</th>
                  <th className="pb-2.5 text-left text-xs font-medium text-muted-foreground">Medium</th>
                  <th className="pb-2.5 text-right text-xs font-medium text-muted-foreground">Visitors</th>
                  <th className="pb-2.5 text-right text-xs font-medium text-muted-foreground">Leads</th>
                  <th className="pb-2.5 text-right text-xs font-medium text-muted-foreground">Paid</th>
                  <th className="pb-2.5 text-right text-xs font-medium text-muted-foreground">Revenue</th>
                  <th className="pb-2.5 text-right text-xs font-medium text-muted-foreground">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 25).map((c, i) => (
                  <tr key={i} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${c.campaign === "direct" ? "opacity-60 bg-amber-500/5" : ""}`}>
                    <td className="py-2.5 font-medium max-w-[180px]">
                      <span className="truncate block" title={c.campaign}>{formatCampaignLabel(c.campaign)}</span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {c.sources.length > 0
                          ? c.sources.map(s => (
                              <Badge key={s} variant="outline" className="text-[10px] h-4 px-1.5">{s}</Badge>
                            ))
                          : <span className="text-muted-foreground text-xs">-</span>
                        }
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {c.mediums.length > 0
                          ? c.mediums.map(m => (
                              <Badge key={m} variant="secondary" className="text-[10px] h-4 px-1.5">{m}</Badge>
                            ))
                          : <span className="text-muted-foreground text-xs">-</span>
                        }
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{c.visitors || "-"}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{c.leads || "-"}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-emerald-600">{c.paid || "-"}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {c.revenue > 0 ? `₹${c.revenue.toLocaleString("en-IN")}` : "-"}
                    </td>
                    <td className="py-2.5 text-right">
                      {c.conversionRate > 0 ? (
                        <Badge
                          variant={c.conversionRate > 20 ? "default" : "secondary"}
                          className="text-[10px] h-5 tabular-nums"
                        >
                          {c.conversionRate.toFixed(1)}%
                        </Badge>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium">No campaign data found</p>
                          <p className="text-xs mt-1">Add UTM parameters to your ad URLs</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* UTM Health */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">UTM Attribution Health</span>
            </div>
            <span className={`text-lg font-bold ${utmHealth > 70 ? "text-emerald-600" : utmHealth > 30 ? "text-amber-600" : "text-red-600"}`}>
              {utmHealth}%
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                utmHealth > 70 ? "bg-emerald-500" : utmHealth > 30 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${utmHealth}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>✅ {summary.withUtm} with UTM</span>
            <span>❌ {summary.withoutUtm} without UTM</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** Format long Meta campaign IDs into readable labels */
function formatCampaignLabel(name: string): string {
  if (name === "direct") return "⚠️ Missing UTM (likely Meta)";
  if (/^\d{10,}$/.test(name)) return `Meta #...${name.slice(-6)}`;
  return name;
}

export default MetaAdsPerformance;
