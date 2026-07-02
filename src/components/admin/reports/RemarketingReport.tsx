import { useEffect, useState } from "react";
import { RotateCcw, Send, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  startISO: string;
  endISO: string;
}

const RemarketingReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeCycles: 0, completedCycles: 0, stoppedCycles: 0,
    totalSmsSent: 0, delivered: 0, failed: 0, pending: 0,
    conversions: 0, conversionRate: 0,
  });
  const [cycleProgress, setCycleProgress] = useState<{ smsNumber: string; count: number }[]>([]);
  const [dailyTrend, setDailyTrend] = useState<{ date: string; sent: number; delivered: number; failed: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, [startISO, endISO, companyId]);

  const toISTDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
    const ist = new Date(istMs);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Determine company-specific remarketing sms_type
      let remarkSmsTypes: string[] = ["remarketing"];
      if (companyId) {
        const { data: comp } = await supabase.from("companies").select("slug").eq("id", companyId).single();
        if (comp?.slug) {
          remarkSmsTypes = [`remarketing_${comp.slug}`];
        }
      }

      // Use exact counts with company filter for all queries
      const [activeRes, completedRes, stoppedRes, smsCountRes, smsDeliveredRes, smsFailedRes, smsPendingRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("remarketing_cycles").select("id", { count: "exact", head: true })
            .eq("status", "active")
        ),
        applyCompanyFilter(
          supabase.from("remarketing_cycles").select("id", { count: "exact", head: true })
            .eq("status", "completed")
            .gte("updated_at", startISO).lte("updated_at", endISO)
        ),
        applyCompanyFilter(
          supabase.from("remarketing_cycles").select("id", { count: "exact", head: true })
            .eq("status", "stopped")
            .gte("updated_at", startISO).lte("updated_at", endISO)
        ),
        // SMS exact counts by company-specific sms_type
        supabase.from("sms_logs").select("id", { count: "exact", head: true })
          .in("sms_type", remarkSmsTypes)
          .gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("sms_logs").select("id", { count: "exact", head: true })
          .in("sms_type", remarkSmsTypes)
          .eq("status", "delivered")
          .gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("sms_logs").select("id", { count: "exact", head: true })
          .in("sms_type", remarkSmsTypes)
          .eq("status", "failed")
          .gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("sms_logs").select("id", { count: "exact", head: true })
          .in("sms_type", remarkSmsTypes)
          .in("status", ["pending", "sent", "submitted"])
          .gte("created_at", startISO).lte("created_at", endISO),
      ]);

      const totalSms = smsCountRes.count || 0;
      const delivered = smsDeliveredRes.count || 0;
      const failed = smsFailedRes.count || 0;
      const pending = smsPendingRes.count || 0;

      // Conversions: cycles stopped (lead paid) during period
      const conversions = stoppedRes.count || 0;
      const activeCycles = activeRes.count || 0;
      const completedCycles = completedRes.count || 0;

      // Cycle progress distribution for active cycles
      const { data: cycleData } = await applyCompanyFilter(
        supabase.from("remarketing_cycles")
          .select("sms_sent_count")
          .eq("status", "active")
      );

      const progressMap: Record<number, number> = {};
      (cycleData || []).forEach(c => {
        const count = c.sms_sent_count || 0;
        progressMap[count] = (progressMap[count] || 0) + 1;
      });

      const progress = Array.from({ length: 11 }, (_, i) => ({
        smsNumber: `SMS ${i}`,
        count: progressMap[i] || 0,
      }));

      // Daily trend - fetch actual rows for date grouping (filtered by company sms_type)
      const { data: smsLogs } = await supabase.from("sms_logs")
        .select("created_at, status")
        .in("sms_type", remarkSmsTypes)
        .gte("created_at", startISO).lte("created_at", endISO)
        .limit(50000);

      const dayMap: Record<string, { sent: number; delivered: number; failed: number }> = {};
      (smsLogs || []).forEach(log => {
        const d = toISTDate(log.created_at);
        if (!dayMap[d]) dayMap[d] = { sent: 0, delivered: 0, failed: 0 };
        dayMap[d].sent++;
        if (log.status === "delivered") dayMap[d].delivered++;
        if (log.status === "failed") dayMap[d].failed++;
      });

      const trend = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          ...v,
        }));

      setStats({
        activeCycles,
        completedCycles,
        stoppedCycles: conversions,
        totalSmsSent: totalSms,
        delivered,
        failed,
        pending,
        conversions,
        conversionRate: activeCycles + conversions > 0
          ? Math.round((conversions / (activeCycles + conversions)) * 100)
          : 0,
      });
      setCycleProgress(progress);
      setDailyTrend(trend);
    } catch (err) {
      console.error("RemarketingReport error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const deliveryRate = stats.totalSmsSent > 0 ? Math.round((stats.delivered / stats.totalSmsSent) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: "Active Cycles", value: stats.activeCycles, icon: RotateCcw, color: "text-blue-600", bg: "from-blue-500/10" },
          { label: "SMS Sent", value: stats.totalSmsSent, icon: Send, color: "text-primary", bg: "from-primary/10" },
          { label: "Delivered", value: `${stats.delivered} (${deliveryRate}%)`, icon: CheckCircle, color: "text-green-600", bg: "from-green-500/10" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-500", bg: "from-red-500/10" },
          { label: "Conversions", value: `${stats.conversions} (${stats.conversionRate}%)`, icon: TrendingUp, color: "text-emerald-600", bg: "from-emerald-500/10" },
        ].map(card => (
          <Card key={card.label} className={`border-l-4 border-l-current bg-gradient-to-r ${card.bg} to-transparent`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{card.label}</span>
              </div>
              <p className={`text-xl font-bold ${card.color}`}>
                {typeof card.value === "number" ? card.value.toLocaleString("en-IN") : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cycle Status Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: stats.activeCycles, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
          { label: "Completed (10 SMS)", value: stats.completedCycles, color: "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
          { label: "Stopped (Paid)", value: stats.stoppedCycles, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
        ].map(item => (
          <div key={item.label} className={`rounded-xl p-4 border text-center ${item.color}`}>
            <p className="text-2xl font-bold">{item.value.toLocaleString("en-IN")}</p>
            <p className="text-xs font-medium mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cycle Progress Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Active Cycles by SMS Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cycleProgress}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="smsNumber" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Cycles" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily SMS Trend */}
        {dailyTrend.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Daily Remarketing SMS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="sent" fill="#3b82f6" name="Sent" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="delivered" fill="#22c55e" name="Delivered" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RemarketingReport;
