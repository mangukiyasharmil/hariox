import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
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
import { useCompany } from "@/contexts/CompanyContext";

interface TimeWiseData {
  hour: string;
  leads: number;
  paid: number;
}

interface TimeWiseLeadsChartProps {
  dateFilter: string;
  dateEndFilter?: string;
}

const TimeWiseLeadsChart = ({ dateFilter, dateEndFilter }: TimeWiseLeadsChartProps) => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [data, setData] = useState<TimeWiseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [dateFilter, dateEndFilter, currentCompany?.id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const companyId = getCompanyFilter();
      const isHariox = currentCompany?.slug === "hariox";

      const applyFilter = (query: any) => {
        if (!companyId) return query;
        return isHariox
          ? query.or(`company_id.eq.${companyId},company_id.is.null`)
          : query.eq("company_id", companyId);
      };

      let leadsQuery = supabase
        .from("leads")
        .select("created_at")
        .gte("created_at", dateFilter);
      if (dateEndFilter) leadsQuery = leadsQuery.lte("created_at", dateEndFilter);
      leadsQuery = applyFilter(leadsQuery);

      let paymentsQuery = supabase
        .from("payments")
        .select("created_at")
        .in("status", ["completed", "captured"])
        .gte("created_at", dateFilter);
      if (dateEndFilter) paymentsQuery = paymentsQuery.lte("created_at", dateEndFilter);
      paymentsQuery = applyFilter(paymentsQuery);

      const [leadsRes, paymentsRes] = await Promise.all([leadsQuery, paymentsQuery]);

      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const hourBuckets: Record<number, { leads: number; paid: number }> = {};
      for (let h = 0; h < 24; h++) {
        hourBuckets[h] = { leads: 0, paid: 0 };
      }

      (leadsRes.data || []).forEach(l => {
        const istDate = new Date(new Date(l.created_at).getTime() + IST_OFFSET_MS);
        hourBuckets[istDate.getUTCHours()].leads++;
      });

      (paymentsRes.data || []).forEach(p => {
        const istDate = new Date(new Date(p.created_at).getTime() + IST_OFFSET_MS);
        hourBuckets[istDate.getUTCHours()].paid++;
      });

      const chartData: TimeWiseData[] = Object.entries(hourBuckets).map(([h, v]) => ({
        hour: `${String(h).padStart(2, "0")}:00`,
        leads: v.leads,
        paid: v.paid,
      }));

      setData(chartData);
    } catch (err) {
      console.error("TimeWiseLeadsChart error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        Hourly Lead Submissions vs Payments (IST)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={0}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="hour" 
              tick={{ fontSize: 10 }} 
              interval={2}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="leads" fill="#8b5cf6" name="Leads Submitted" radius={[3, 3, 0, 0]} />
            <Bar dataKey="paid" fill="#22c55e" name="Payments" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TimeWiseLeadsChart;
