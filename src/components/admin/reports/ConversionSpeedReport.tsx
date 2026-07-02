import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Clock, Zap, AlertTriangle, Timer } from "lucide-react";

interface Props {
  startISO: string;
  endISO: string;
}

const ConversionSpeedReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["conversion-speed", startISO, endISO, companyId],
    queryFn: async () => {
      const [leadsRes, paymentsRes, profilesRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("id, status, created_at, assigned_to, city, loan_type")
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        applyCompanyFilter(
          supabase.from("payments").select("lead_id, created_at")
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        supabase.from("profiles").select("user_id, full_name").limit(500),
      ]);

      const leads = leadsRes.data || [];
      const payments = paymentsRes.data || [];
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.full_name]));

      // Time to first payment
      const paymentMap = new Map<string, Date>();
      payments.forEach(p => {
        const existing = paymentMap.get(p.lead_id);
        const d = new Date(p.created_at);
        if (!existing || d < existing) paymentMap.set(p.lead_id, d);
      });

      const leadToPaymentTimes: number[] = [];
      leads.forEach(l => {
        const paymentDate = paymentMap.get(l.id);
        if (paymentDate) {
          const hours = (paymentDate.getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60);
          if (hours > 0 && hours < 720) leadToPaymentTimes.push(hours);
        }
      });

      const avgLeadToPayment = leadToPaymentTimes.length > 0
        ? leadToPaymentTimes.reduce((a, b) => a + b, 0) / leadToPaymentTimes.length
        : 0;

      const timeBuckets = [
        { label: "< 2 hrs", max: 2, count: 0 },
        { label: "2-12 hrs", max: 12, count: 0 },
        { label: "12-24 hrs", max: 24, count: 0 },
        { label: "1-3 days", max: 72, count: 0 },
        { label: "3-7 days", max: 168, count: 0 },
        { label: "7+ days", max: Infinity, count: 0 },
      ];

      leadToPaymentTimes.forEach(hrs => {
        const bucket = timeBuckets.find(b => hrs < b.max);
        if (bucket) bucket.count++;
      });

      // Speed by staff
      const staffSpeed = new Map<string, { total: number; count: number }>();
      leads.forEach(l => {
        if (!l.assigned_to) return;
        const paymentDate = paymentMap.get(l.id);
        if (!paymentDate) return;
        const hours = (paymentDate.getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60);
        if (hours <= 0 || hours > 720) return;
        const entry = staffSpeed.get(l.assigned_to) || { total: 0, count: 0 };
        entry.total += hours;
        entry.count++;
        staffSpeed.set(l.assigned_to, entry);
      });

      const staffData = Array.from(staffSpeed.entries())
        .map(([userId, d]) => ({
          name: profileMap.get(userId) || "Unknown",
          avgHours: d.total / d.count,
          conversions: d.count,
        }))
        .sort((a, b) => a.avgHours - b.avgHours);

      const fastConversions = leadToPaymentTimes.filter(h => h < 2).length;
      const fastPercent = leadToPaymentTimes.length > 0 ? (fastConversions / leadToPaymentTimes.length) * 100 : 0;

      const stuckLeads = leads.filter(l => {
        const age = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60);
        return l.status === "unpaid" && age > 48;
      }).length;

      return { avgLeadToPayment, timeBuckets, staffData, fastPercent, stuckLeads, totalConversions: leadToPaymentTimes.length };
    },
    staleTime: 2 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  const formatHours = (hrs: number) => {
    if (hrs < 1) return `${Math.round(hrs * 60)}m`;
    if (hrs < 24) return `${hrs.toFixed(1)}h`;
    return `${(hrs / 24).toFixed(1)}d`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Timer className="w-4 h-4" /><span className="text-xs">Avg Lead→Payment</span></div>
          <p className="text-xl font-bold">{formatHours(data.avgLeadToPayment)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Zap className="w-4 h-4" /><span className="text-xs">Fast Conversions (&lt;2h)</span></div>
          <p className="text-xl font-bold">{data.fastPercent.toFixed(0)}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="w-4 h-4" /><span className="text-xs">Total Conversions</span></div>
          <p className="text-xl font-bold">{data.totalConversions}</p>
        </CardContent></Card>
        <Card className={data.stuckLeads > 10 ? "border-red-500/30" : ""}><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs">Stuck &gt;48h (Unpaid)</span></div>
          <p className={`text-xl font-bold ${data.stuckLeads > 10 ? "text-red-500" : ""}`}>{data.stuckLeads}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Time to Conversion Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.timeBuckets}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {data.staffData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Staff Conversion Speed (Fastest First)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.staffData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 ${i === 0 ? "text-green-600" : ""}`}>#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.conversions} conversions</span>
                    </div>
                    <div className="mt-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (1 - s.avgHours / Math.max(...data.staffData.map(x => x.avgHours))) * 100 + 20)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold w-12 text-right">{formatHours(s.avgHours)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConversionSpeedReport;
