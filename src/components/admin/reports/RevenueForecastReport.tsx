import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, ArrowUpRight, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  startISO: string;
  endISO: string;
}

const RevenueForecastReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-forecast", companyId],
    queryFn: async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [leadsRes, paymentsRes, pipelineRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("id, status, loan_amount, created_at, source")
            .gte("created_at", ninetyDaysAgo.toISOString())
        ).limit(5000),
        applyCompanyFilter(
          supabase.from("payments").select("total_amount, created_at, lead_id")
            .in("status", ["completed", "captured"])
            .gte("created_at", ninetyDaysAgo.toISOString())
        ).limit(5000),
        applyCompanyFilter(
          supabase.from("leads").select("id, status, loan_amount, created_at, source")
            .in("status", ["unpaid", "paid", "documents_pending", "documents_uploaded", "verified", "processing"])
        ).limit(5000),
      ]);

      const leads = leadsRes.data || [];
      const payments = paymentsRes.data || [];
      const pipeline = pipelineRes.data || [];

      // Calculate historical conversion rates
      const totalHistoricalLeads = leads.length;
      const paidStatuses = ["paid", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"];
      const paidLeads = leads.filter(l => paidStatuses.includes(l.status)).length;
      const conversionRate = totalHistoricalLeads > 0 ? paidLeads / totalHistoricalLeads : 0;

      // Average payment amount
      const avgPayment = payments.length > 0
        ? payments.reduce((sum, p) => sum + Number(p.total_amount), 0) / payments.length
        : 0;

      // Weekly revenue trend (last 12 weeks)
      const weeklyRevenue: { week: string; revenue: number; leads: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        
        const weekPayments = payments.filter(p => {
          const d = new Date(p.created_at);
          return d >= weekStart && d < weekEnd;
        });
        const weekLeads = leads.filter(l => {
          const d = new Date(l.created_at);
          return d >= weekStart && d < weekEnd;
        });

        weeklyRevenue.push({
          week: `W${12 - i}`,
          revenue: weekPayments.reduce((s, p) => s + Number(p.total_amount), 0),
          leads: weekLeads.length,
        });
      }

      // Pipeline forecast
      const statusProbability: Record<string, number> = {
        unpaid: 0.15,
        paid: 0.65,
        documents_pending: 0.70,
        documents_uploaded: 0.80,
        verified: 0.90,
        processing: 0.95,
      };

      const pipelineByStage = Object.entries(statusProbability).map(([status, prob]) => {
        const stageLeads = pipeline.filter(l => l.status === status);
        const expectedRevenue = stageLeads.length * avgPayment * prob;
        return {
          stage: status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          count: stageLeads.length,
          probability: Math.round(prob * 100),
          expectedRevenue,
        };
      }).filter(s => s.count > 0);

      const totalForecast = pipelineByStage.reduce((s, p) => s + p.expectedRevenue, 0);

      // 30-day projection based on trend
      const recentWeeks = weeklyRevenue.slice(-4);
      const avgWeeklyRevenue = recentWeeks.reduce((s, w) => s + w.revenue, 0) / recentWeeks.length;
      const projectedMonthly = avgWeeklyRevenue * 4.3;

      // Growth trend
      const firstHalf = weeklyRevenue.slice(0, 6).reduce((s, w) => s + w.revenue, 0);
      const secondHalf = weeklyRevenue.slice(6).reduce((s, w) => s + w.revenue, 0);
      const growthPercent = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

      return {
        conversionRate,
        avgPayment,
        weeklyRevenue,
        pipelineByStage,
        totalForecast,
        projectedMonthly,
        growthPercent,
        pipelineCount: pipeline.length,
      };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs">30-Day Projection</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">₹{(data.projectedMonthly / 1000).toFixed(1)}K</p>
            <p className="text-[10px] text-muted-foreground">Based on 4-week avg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Pipeline Value</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">₹{(data.totalForecast / 1000).toFixed(1)}K</p>
            <p className="text-[10px] text-muted-foreground">{data.pipelineCount} active leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-xs">Growth Trend</span>
            </div>
            <p className={`text-lg sm:text-xl font-bold ${data.growthPercent >= 0 ? "text-green-600" : "text-red-500"}`}>
              {data.growthPercent >= 0 ? "+" : ""}{data.growthPercent.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">vs previous 6 weeks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Conversion Rate</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">{(data.conversionRate * 100).toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">Avg: ₹{data.avgPayment.toFixed(0)}/payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Revenue Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weekly Revenue Trend (12 Weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyRevenue}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline by Stage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pipeline Forecast by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.pipelineByStage.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <div className="w-28 text-xs font-medium truncate">{stage.stage}</div>
                <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-primary/80 rounded-full flex items-center px-2"
                    style={{ width: `${stage.probability}%` }}
                  >
                    <span className="text-[10px] text-primary-foreground font-medium whitespace-nowrap">
                      {stage.count} leads · {stage.probability}%
                    </span>
                  </div>
                </div>
                <div className="w-20 text-right text-xs font-semibold">
                  ₹{(stage.expectedRevenue / 1000).toFixed(1)}K
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueForecastReport;
