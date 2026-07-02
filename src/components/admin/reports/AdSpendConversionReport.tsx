import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Area } from "recharts";
import { TrendingUp, TrendingDown, Users, IndianRupee, MousePointerClick, ArrowRightLeft } from "lucide-react";

interface Props {
  startISO: string;
  endISO: string;
}

const AdSpendConversionReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["ad-spend-conversion", startISO, endISO, companyId],
    queryFn: async () => {
      const [visitsRes, leadsRes, paymentsRes] = await Promise.all([
        // Ad visits (utm_source present = from ads)
        applyCompanyFilter(
          supabase
            .from("analytics_events")
            .select("created_at, utm_source, utm_medium, utm_campaign, visitor_id")
            .gte("created_at", startISO)
            .lte("created_at", endISO)
            .not("utm_source", "is", null)
        ).limit(5000),

        applyCompanyFilter(
          supabase
            .from("leads")
            .select("id, created_at, status, source, utm_source, utm_campaign, phone")
            .gte("created_at", startISO)
            .lte("created_at", endISO)
        ).limit(5000),

        applyCompanyFilter(
          supabase
            .from("payments")
            .select("id, created_at, total_amount, status, lead_id")
            .gte("created_at", startISO)
            .lte("created_at", endISO)
            .in("status", ["completed", "captured"])
        ).limit(5000),
      ]);

      return {
        visits: visitsRes.data || [],
        leads: leadsRes.data || [],
        payments: paymentsRes.data || [],
      };
    },
  });

  const analysis = useMemo(() => {
    if (!data) return null;
    const { visits, leads, payments } = data;

    // Group by day (IST)
    const dayMap = new Map<string, { visits: number; uniqueVisitors: Set<string>; leads: number; paidLeads: number; revenue: number; campaigns: Set<string> }>();

    visits.forEach((v: any) => {
      const day = new Date(v.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });
      if (!dayMap.has(day)) dayMap.set(day, { visits: 0, uniqueVisitors: new Set(), leads: 0, paidLeads: 0, revenue: 0, campaigns: new Set() });
      const d = dayMap.get(day)!;
      d.visits++;
      if (v.visitor_id) d.uniqueVisitors.add(v.visitor_id);
      if (v.utm_campaign) d.campaigns.add(v.utm_campaign);
    });

    leads.forEach((l: any) => {
      const day = new Date(l.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });
      if (!dayMap.has(day)) dayMap.set(day, { visits: 0, uniqueVisitors: new Set(), leads: 0, paidLeads: 0, revenue: 0, campaigns: new Set() });
      const d = dayMap.get(day)!;
      d.leads++;
      if (["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"].includes(l.status)) {
        d.paidLeads++;
      }
    });

    const paidLeadIds = new Set(leads.filter((l: any) => ["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"].includes(l.status)).map((l: any) => l.id));

    payments.forEach((p: any) => {
      const day = new Date(p.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });
      if (!dayMap.has(day)) dayMap.set(day, { visits: 0, uniqueVisitors: new Set(), leads: 0, paidLeads: 0, revenue: 0, campaigns: new Set() });
      dayMap.get(day)!.revenue += Number(p.total_amount) || 0;
    });

    // Sort chronologically
    const dailyData = Array.from(dayMap.entries())
      .sort((a, b) => {
        const parseDate = (s: string) => {
          const [d, m] = s.split(" ");
          const monthMap: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
          return new Date(2026, monthMap[m] || 0, parseInt(d)).getTime();
        };
        return parseDate(a[0]) - parseDate(b[0]);
      })
      .map(([day, d]) => ({
        day,
        visits: d.visits,
        uniqueVisitors: d.uniqueVisitors.size,
        leads: d.leads,
        paidLeads: d.paidLeads,
        revenue: d.revenue,
        visitToLead: d.visits > 0 ? Math.round((d.leads / d.visits) * 100) : 0,
        leadToPaid: d.leads > 0 ? Math.round((d.paidLeads / d.leads) * 100) : 0,
        campaigns: d.campaigns.size,
      }));

    // Campaign breakdown
    const campaignMap = new Map<string, { visits: number; leads: number; paidLeads: number; revenue: number }>();
    visits.forEach((v: any) => {
      const campaign = v.utm_campaign || "Direct/Unknown";
      if (!campaignMap.has(campaign)) campaignMap.set(campaign, { visits: 0, leads: 0, paidLeads: 0, revenue: 0 });
      campaignMap.get(campaign)!.visits++;
    });
    leads.forEach((l: any) => {
      const campaign = l.utm_campaign || "Direct/Organic";
      if (!campaignMap.has(campaign)) campaignMap.set(campaign, { visits: 0, leads: 0, paidLeads: 0, revenue: 0 });
      const c = campaignMap.get(campaign)!;
      c.leads++;
      if (paidLeadIds.has(l.id)) c.paidLeads++;
    });
    // Attribute payments to campaigns via lead
    const leadCampaignMap = new Map<string, string>(leads.map((l: any) => [l.id as string, (l.utm_campaign || "Direct/Organic") as string]));
    payments.forEach((p: any) => {
      const campaign = leadCampaignMap.get(p.lead_id as string) || "Direct/Organic";
      if (campaignMap.has(campaign)) {
        campaignMap.get(campaign)!.revenue += Number(p.total_amount) || 0;
      }
    });

    const campaignData = Array.from(campaignMap.entries())
      .map(([name, c]) => ({
        name: name.length > 20 ? name.substring(0, 20) + "…" : name,
        fullName: name,
        ...c,
        convRate: c.visits > 0 ? Math.round((c.leads / c.visits) * 100) : 0,
        paidRate: c.leads > 0 ? Math.round((c.paidLeads / c.leads) * 100) : 0,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    // Totals
    const totalVisits = visits.length;
    const totalLeads = leads.length;
    const totalPaid = leads.filter((l: any) => paidLeadIds.has(l.id)).length;
    const totalRevenue = payments.reduce((s: number, p: any) => s + (Number(p.total_amount) || 0), 0);

    return { dailyData, campaignData, totalVisits, totalLeads, totalPaid, totalRevenue };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!analysis) return null;

  const { dailyData, campaignData, totalVisits, totalLeads, totalPaid, totalRevenue } = analysis;
  const visitToLeadRate = totalVisits > 0 ? ((totalLeads / totalVisits) * 100).toFixed(1) : "0";
  const leadToPaidRate = totalLeads > 0 ? ((totalPaid / totalLeads) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <MousePointerClick className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Ad Clicks</span>
            </div>
            <p className="text-lg font-bold">{totalVisits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Leads</span>
            </div>
            <p className="text-lg font-bold">{totalLeads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Click→Lead</span>
            </div>
            <p className="text-lg font-bold text-primary">{visitToLeadRate}%</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Paid Leads</span>
            </div>
            <p className="text-lg font-bold text-accent-foreground">{totalPaid}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Lead→Paid</span>
            </div>
            <p className="text-lg font-bold text-secondary-foreground">{leadToPaidRate}%</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <IndianRupee className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Revenue</span>
            </div>
            <p className="text-lg font-bold">₹{totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Funnel Chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Ad Traffic vs Lead Conversion</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(value: any, name: string) => {
                    if (name === "visitToLead" || name === "leadToPaid") return [`${value}%`, name === "visitToLead" ? "Click→Lead %" : "Lead→Paid %"];
                    if (name === "revenue") return [`₹${Number(value).toLocaleString()}`, "Revenue"];
                    return [value, name === "visits" ? "Ad Clicks" : name === "leads" ? "Leads" : name === "paidLeads" ? "Paid" : name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="left" dataKey="visits" fill="hsl(var(--primary) / 0.3)" name="Ad Clicks" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="left" dataKey="leads" fill="hsl(var(--primary) / 0.7)" name="Leads" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="left" dataKey="paidLeads" fill="hsl(142 76% 36%)" name="Paid" radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="visitToLead" stroke="#3b82f6" strokeWidth={2} name="Click→Lead %" dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="leadToPaid" stroke="#f59e0b" strokeWidth={2} name="Lead→Paid %" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No ad traffic data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Campaign Breakdown Table */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {campaignData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Campaign</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Clicks</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Leads</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Click→Lead</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Paid</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Lead→Paid</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignData.map((c, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium" title={c.fullName}>{c.name}</td>
                      <td className="text-right py-2 px-2">{c.visits}</td>
                      <td className="text-right py-2 px-2">{c.leads}</td>
                      <td className="text-right py-2 px-2">
                        <Badge variant={c.convRate >= 30 ? "default" : c.convRate >= 15 ? "secondary" : "destructive"} className="text-[10px]">
                          {c.convRate}%
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-2">{c.paidLeads}</td>
                      <td className="text-right py-2 px-2">
                        <Badge variant={c.paidRate >= 20 ? "default" : c.paidRate >= 10 ? "secondary" : "destructive"} className="text-[10px]">
                          {c.paidRate}%
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-2 font-medium">₹{c.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No campaign data available</p>
          )}
        </CardContent>
      </Card>

      {/* Daily Breakdown Table */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ad Clicks</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Leads</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Click→Lead</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Paid</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Lead→Paid</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Campaigns</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{d.day}</td>
                      <td className="text-right py-2 px-2">{d.visits}</td>
                      <td className="text-right py-2 px-2">{d.leads}</td>
                      <td className="text-right py-2 px-2">
                        <Badge variant={d.visitToLead >= 30 ? "default" : d.visitToLead >= 15 ? "secondary" : "destructive"} className="text-[10px]">
                          {d.visitToLead}%
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-2">{d.paidLeads}</td>
                      <td className="text-right py-2 px-2">
                        <Badge variant={d.leadToPaid >= 20 ? "default" : d.leadToPaid >= 10 ? "secondary" : "destructive"} className="text-[10px]">
                          {d.leadToPaid}%
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-2 font-medium">₹{d.revenue.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{d.campaigns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No daily data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdSpendConversionReport;
