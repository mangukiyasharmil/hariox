import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  startISO: string;
  endISO: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

const PeakHourHeatmap = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["peak-hour-heatmap", startISO, endISO, companyId],
    queryFn: async () => {
      const [leadsRes, paymentsRes, callsRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("created_at")
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        applyCompanyFilter(
          supabase.from("payments").select("created_at")
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        (() => {
          let q = supabase.from("call_logs").select("created_at, outcome")
            .gte("created_at", startISO).lte("created_at", endISO);
          if (companyId) q = q.eq("company_id", companyId);
          return q.limit(5000);
        })(),
      ]);

      const leads = leadsRes.data || [];
      const payments = paymentsRes.data || [];
      const calls = callsRes.data || [];

      const leadGrid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0));
      const paymentGrid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0));

      const toIST = (d: Date) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000);

      leads.forEach(l => {
        const ist = toIST(new Date(l.created_at));
        const day = (ist.getUTCDay() + 6) % 7;
        const hour = ist.getUTCHours();
        if (hour >= 8 && hour <= 21) leadGrid[day][hour - 8]++;
      });

      payments.forEach(p => {
        const ist = toIST(new Date(p.created_at));
        const day = (ist.getUTCDay() + 6) % 7;
        const hour = ist.getUTCHours();
        if (hour >= 8 && hour <= 21) paymentGrid[day][hour - 8]++;
      });

      let peakLeadHour = { day: 0, hour: 0, count: 0 };
      let peakPaymentHour = { day: 0, hour: 0, count: 0 };
      leadGrid.forEach((row, d) => row.forEach((v, h) => { if (v > peakLeadHour.count) peakLeadHour = { day: d, hour: h + 8, count: v }; }));
      paymentGrid.forEach((row, d) => row.forEach((v, h) => { if (v > peakPaymentHour.count) peakPaymentHour = { day: d, hour: h + 8, count: v }; }));

      const maxLead = Math.max(...leadGrid.flat(), 1);
      const maxPayment = Math.max(...paymentGrid.flat(), 1);

      return { leadGrid, paymentGrid, maxLead, maxPayment, peakLeadHour, peakPaymentHour };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  const getColor = (value: number, max: number, type: "lead" | "payment") => {
    if (value === 0) return "hsl(var(--muted))";
    const intensity = value / max;
    if (type === "lead") return `hsla(142, 76%, 36%, ${0.15 + intensity * 0.85})`;
    return `hsla(217, 91%, 60%, ${0.15 + intensity * 0.85})`;
  };

  const HeatmapGrid = ({ grid, max, type, title }: { grid: number[][]; max: number; type: "lead" | "payment"; title: string }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="flex gap-0.5 mb-1">
            <div className="w-10" />
            {HOURS.map(h => (
              <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                {h > 12 ? `${h - 12}P` : h === 12 ? "12P" : `${h}A`}
              </div>
            ))}
          </div>
          {DAYS.map((day, d) => (
            <div key={day} className="flex gap-0.5 mb-0.5">
              <div className="w-10 text-[10px] font-medium flex items-center">{day}</div>
              {HOURS.map((_, h) => (
                <div
                  key={h}
                  className="flex-1 aspect-square rounded-sm flex items-center justify-center text-[8px] font-medium cursor-default transition-transform hover:scale-110"
                  style={{ backgroundColor: getColor(grid[d][h], max, type), color: grid[d][h] > max * 0.5 ? "white" : "inherit" }}
                  title={`${day} ${HOURS[h]}:00 — ${grid[d][h]} ${type === "lead" ? "leads" : "payments"}`}
                >
                  {grid[d][h] > 0 ? grid[d][h] : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">🔥 Peak Lead Generation</p>
            <p className="text-sm font-bold mt-1">
              {DAYS[data.peakLeadHour.day]} at {data.peakLeadHour.hour > 12 ? data.peakLeadHour.hour - 12 : data.peakLeadHour.hour}:00 {data.peakLeadHour.hour >= 12 ? "PM" : "AM"}
            </p>
            <p className="text-xs text-muted-foreground">{data.peakLeadHour.count} leads</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">💰 Peak Payment Hour</p>
            <p className="text-sm font-bold mt-1">
              {DAYS[data.peakPaymentHour.day]} at {data.peakPaymentHour.hour > 12 ? data.peakPaymentHour.hour - 12 : data.peakPaymentHour.hour}:00 {data.peakPaymentHour.hour >= 12 ? "PM" : "AM"}
            </p>
            <p className="text-xs text-muted-foreground">{data.peakPaymentHour.count} payments</p>
          </CardContent>
        </Card>
      </div>
      <HeatmapGrid grid={data.leadGrid} max={data.maxLead} type="lead" title="Lead Generation Heatmap (8 AM – 9 PM)" />
      <HeatmapGrid grid={data.paymentGrid} max={data.maxPayment} type="payment" title="Payment Heatmap (8 AM – 9 PM)" />
    </div>
  );
};

export default PeakHourHeatmap;
