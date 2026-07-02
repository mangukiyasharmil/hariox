import { useState, useEffect, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { formatISTDate, startOfDayIST, endOfDayIST } from "@/lib/dateUtils";

interface FullFunnelTrendChartProps {
  dateFilter: string;
  dateEndFilter?: string;
}

interface TrendDataPoint {
  label: string;
  pageviews: number;
  visitors: number;
  leads: number;
  paid: number;
  verified: number;
  disbursed: number;
}

const SERIES = [
  { key: "pageviews", color: "#a855f7", label: "Page Views" },
  { key: "visitors", color: "#f97316", label: "Visitors" },
  { key: "leads", color: "#3b82f6", label: "Leads" },
  { key: "paid", color: "#22c55e", label: "Paid" },
  { key: "verified", color: "#eab308", label: "Verified" },
  { key: "disbursed", color: "#ef4444", label: "Disbursed" },
] as const;

const FullFunnelTrendChart = ({ dateFilter, dateEndFilter }: FullFunnelTrendChartProps) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const grouping = useMemo(() => {
    const start = new Date(dateFilter);
    const end = dateEndFilter ? new Date(dateEndFilter) : new Date();
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 60 ? "monthly" : "daily";
  }, [dateFilter, dateEndFilter]);

  useEffect(() => {
    fetchData();
  }, [dateFilter, dateEndFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(dateFilter);
      const endDate = dateEndFilter ? new Date(dateEndFilter) : new Date();

      if (grouping === "monthly") {
        await fetchMonthly(startDate, endDate);
      } else {
        await fetchDaily(startDate, endDate);
      }
    } catch (err) {
      console.error("FullFunnelTrendChart:error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDaily = async (startDate: Date, endDate: Date) => {
    // Build day buckets using IST date utils (same as StatusTrendChart)
    const days: { label: string; startISO: string; endISO: string }[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dayStr = formatISTDate(cursor);
      const dayStart = startOfDayIST(dayStr);
      const dayEnd = endOfDayIST(dayStr);
      days.push({
        label: new Date(cursor).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        startISO: dayStart.toISOString(),
        endISO: dayEnd.toISOString(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Batch in groups of 7 to avoid too many parallel requests
    const batchSize = 7;
    const results: TrendDataPoint[] = [];

    for (let i = 0; i < days.length; i += batchSize) {
      const batch = days.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (d) => {
          const [analyticsRes, leadsRes, paidRes, verifiedRes, disbursedRes] = await Promise.all([
            supabase.rpc("get_analytics_counts", {
              p_start: d.startISO,
              p_end: d.endISO,
              p_company_id: companyId || null,
            }),
            applyCompanyFilter(
              supabase.from("leads").select("id", { count: "exact", head: true })
                .gte("created_at", d.startISO).lte("created_at", d.endISO)
            ),
            applyCompanyFilter(
              supabase.from("payments").select("id", { count: "exact", head: true })
                .in("status", ["completed", "captured"])
                .gte("created_at", d.startISO).lte("created_at", d.endISO)
            ),
            applyCompanyFilter(
              supabase.from("leads").select("id", { count: "exact", head: true })
                .in("status", ["verified", "processing", "approved", "disbursed"])
                .gte("created_at", d.startISO).lte("created_at", d.endISO)
            ),
            applyCompanyFilter(
              supabase.from("leads").select("id", { count: "exact", head: true })
                .eq("status", "disbursed")
                .gte("created_at", d.startISO).lte("created_at", d.endISO)
            ),
          ]);

          const analyticsData = analyticsRes.data?.[0] || { pageviews: 0, visitors: 0 };
          return {
            label: d.label,
            pageviews: Number(analyticsData.pageviews) || 0,
            visitors: Number(analyticsData.visitors) || 0,
            leads: leadsRes.count || 0,
            paid: paidRes.count || 0,
            verified: verifiedRes.count || 0,
            disbursed: disbursedRes.count || 0,
          };
        })
      );
      results.push(...batchResults);
    }
    setData(results);
  };

  const fetchMonthly = async (startDate: Date, endDate: Date) => {
    const months: { label: string; startISO: string; endISO: string }[] = [];
    const cursor = new Date(startDate);
    cursor.setDate(1);

    while (cursor <= endDate) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      months.push({
        label: monthStart.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        startISO: monthStart.toISOString(),
        endISO: monthEnd.toISOString(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const results = await Promise.all(
      months.map(async (m) => {
        const [analyticsRes, leadsRes, paidRes, verifiedRes, disbursedRes] = await Promise.all([
          supabase.rpc("get_analytics_counts", {
            p_start: m.startISO,
            p_end: m.endISO,
            p_company_id: companyId || null,
          }),
          applyCompanyFilter(
            supabase.from("leads").select("id", { count: "exact", head: true })
              .gte("created_at", m.startISO).lt("created_at", m.endISO)
          ),
          applyCompanyFilter(
            supabase.from("payments").select("id", { count: "exact", head: true })
              .in("status", ["completed", "captured"])
              .gte("created_at", m.startISO).lt("created_at", m.endISO)
          ),
          applyCompanyFilter(
            supabase.from("leads").select("id", { count: "exact", head: true })
              .in("status", ["verified", "processing", "approved", "disbursed"])
              .gte("created_at", m.startISO).lt("created_at", m.endISO)
          ),
          applyCompanyFilter(
            supabase.from("leads").select("id", { count: "exact", head: true })
              .eq("status", "disbursed")
              .gte("created_at", m.startISO).lt("created_at", m.endISO)
          ),
        ]);

        const analyticsData = analyticsRes.data?.[0] || { pageviews: 0, visitors: 0 };
        return {
          label: m.label,
          pageviews: Number(analyticsData.pageviews) || 0,
          visitors: Number(analyticsData.visitors) || 0,
          leads: leadsRes.count || 0,
          paid: paidRes.count || 0,
          verified: verifiedRes.count || 0,
          disbursed: disbursedRes.count || 0,
        };
      })
    );
    setData(results);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        Full Funnel Trend ({grouping === "monthly" ? "Monthly" : "Daily"})
      </h3>
      {data.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                interval={data.length > 15 ? Math.floor(data.length / 10) : 0}
                angle={data.length > 10 ? -45 : 0}
                textAnchor={data.length > 10 ? "end" : "middle"}
                height={data.length > 10 ? 60 : 30}
              />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {SERIES.map(s => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-72 flex items-center justify-center text-muted-foreground">
          No data for selected period
        </div>
      )}
    </div>
  );
};

export default FullFunnelTrendChart;
