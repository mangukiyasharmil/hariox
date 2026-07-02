import { useState, useEffect, useMemo, useCallback } from "react";
import { TrendingUp, CalendarDays } from "lucide-react";
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
import { formatISTDate, startOfDayIST, endOfDayIST } from "@/lib/dateUtils";

interface TrendBucket {
  label: string;
  pageviews: number;
  visitors: number;
  leads: number;
  paid: number;
  verified: number;
  disbursed: number;
}

interface StatusTrendChartProps {
  dateFilter: string;
  dateEndFilter: string;
  onLocalDateChange?: (start: string, end: string) => void;
}

const SERIES = [
  { key: "pageviews", color: "#a855f7", label: "Page Views" },
  { key: "visitors", color: "#f97316", label: "Visitors" },
  { key: "leads", color: "#3b82f6", label: "Leads" },
  { key: "paid", color: "#22c55e", label: "Paid" },
  { key: "verified", color: "#eab308", label: "Verified" },
  { key: "disbursed", color: "#ef4444", label: "Disbursed" },
] as const;

const QUICK_RANGES = [
  { label: "Today", days: 0 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: -1 },
] as const;

const StatusTrendChart = ({ dateFilter, dateEndFilter, onLocalDateChange }: StatusTrendChartProps) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const [data, setData] = useState<TrendBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<string>("7 Days");

  const getRange = useCallback((label: string) => {
    const now = new Date();
    const todayIST = formatISTDate(now);
    const endISO = endOfDayIST(todayIST).toISOString();
    if (label === "Today") {
      return { start: startOfDayIST(todayIST).toISOString(), end: endISO };
    }
    if (label === "All") {
      return { start: "2024-01-01T00:00:00.000Z", end: endISO };
    }
    const range = QUICK_RANGES.find(r => r.label === label);
    const days = range?.days || 7;
    const startD = new Date(now);
    startD.setDate(startD.getDate() - days);
    const startIST = formatISTDate(startD);
    return { start: startOfDayIST(startIST).toISOString(), end: endISO };
  }, []);

  const [localStart, setLocalStart] = useState(() => {
    const r = getRange("7 Days");
    return r.start;
  });
  const [localEnd, setLocalEnd] = useState(() => {
    const r = getRange("7 Days");
    return r.end;
  });

  // Sync parent on mount
  useEffect(() => {
    const r = getRange("7 Days");
    onLocalDateChange?.(r.start, r.end);
  }, []);

  const handleRangeClick = (label: string) => {
    setActiveRange(label);
    const { start, end } = getRange(label);
    setLocalStart(start);
    setLocalEnd(end);
    onLocalDateChange?.(start, end);
  };

  const startDate = useMemo(() => new Date(localStart), [localStart]);
  const endDate = useMemo(() => new Date(localEnd), [localEnd]);

  const rangeDays = useMemo(() => {
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  const isMonthWise = rangeDays >= 60;

  useEffect(() => {
    fetchTrendData();
  }, [localStart, localEnd, companyId]);

  const fetchDayBucket = async (startISO: string, endISO: string): Promise<Omit<TrendBucket, "label">> => {
    const [analyticsRes, leadsRes, paidRes, verifiedRes, disbursedRes] = await Promise.all([
      supabase.rpc("get_analytics_counts", {
        p_start: startISO,
        p_end: endISO,
        p_company_id: companyId || null,
      }),
      applyCompanyFilter(
        supabase.from("leads").select("id", { count: "exact", head: true })
          .gte("created_at", startISO).lte("created_at", endISO)
      ),
      applyCompanyFilter(
        supabase.from("payments").select("id", { count: "exact", head: true })
          .in("status", ["completed", "captured"])
          .gte("created_at", startISO).lte("created_at", endISO)
      ),
      applyCompanyFilter(
        supabase.from("leads").select("id", { count: "exact", head: true })
          .in("status", ["verified", "processing", "approved", "disbursed"])
          .gte("created_at", startISO).lte("created_at", endISO)
      ),
      applyCompanyFilter(
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("status", "disbursed")
          .gte("created_at", startISO).lte("created_at", endISO)
      ),
    ]);

    const analyticsData = analyticsRes.data?.[0] || { pageviews: 0, visitors: 0 };
    return {
      pageviews: Number(analyticsData.pageviews) || 0,
      visitors: Number(analyticsData.visitors) || 0,
      leads: leadsRes.count || 0,
      paid: paidRes.count || 0,
      verified: verifiedRes.count || 0,
      disbursed: disbursedRes.count || 0,
    };
  };

  const fetchTrendData = async () => {
    setIsLoading(true);
    try {
      if (isMonthWise) {
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
          months.map(async (m) => ({
            label: m.label,
            ...(await fetchDayBucket(m.startISO, m.endISO)),
          }))
        );
        setData(results);
      } else {
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

        const batchSize = 7;
        const results: TrendBucket[] = [];
        for (let i = 0; i < days.length; i += batchSize) {
          const batch = days.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (d) => ({
              label: d.label,
              ...(await fetchDayBucket(d.startISO, d.endISO)),
            }))
          );
          results.push(...batchResults);
        }
        setData(results);
      }
    } catch (err) {
      console.error("StatusTrendChart error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = useMemo(() => {
    return data.reduce(
      (acc, d) => ({
        pageviews: acc.pageviews + d.pageviews,
        visitors: acc.visitors + d.visitors,
        leads: acc.leads + d.leads,
        paid: acc.paid + d.paid,
        verified: acc.verified + d.verified,
        disbursed: acc.disbursed + d.disbursed,
      }),
      { pageviews: 0, visitors: 0, leads: 0, paid: 0, verified: 0, disbursed: 0 }
    );
  }, [data]);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          {isMonthWise ? "Monthly" : "Daily"} Status Trend
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          {QUICK_RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => handleRangeClick(r.label)}
              className={`px-2.5 py-1 text-[10px] sm:text-xs rounded-md font-medium transition-colors ${
                activeRange === r.label
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-4">
        {SERIES.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
            <span className="font-medium">{totals[s.key as keyof typeof totals].toLocaleString("en-IN")}</span>
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map(s => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} name={s.label} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatusTrendChart;
