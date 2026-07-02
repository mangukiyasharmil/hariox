import { useEffect, useState } from "react";
import { CreditCard, Send, CheckCircle, Clock, TrendingUp, IndianRupee, RotateCcw } from "lucide-react";
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

const PaymentRecoveryReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAbandoned: 0,
    remindersSent: 0,
    recovered: 0,
    recoveredRevenue: 0,
    recoveryRate: 0,
    pendingRetry: 0,
  });
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);

  const toISTDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
    const ist = new Date(istMs);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    fetchData();
  }, [startISO, endISO, companyId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Get WhatsApp account IDs for current company
      let waAccountIds: string[] = [];
      if (companyId) {
        const { data: accs } = await supabase.from("whatsapp_accounts").select("id").eq("company_id", companyId);
        waAccountIds = (accs || []).map(a => a.id);
      }

      const [
        abandonedCountRes, failedCountRes,
        reminderSmsCountRes, reminderWaCountRes,
        recoveredPaymentsRes, pendingCountRes,
      ] = await Promise.all([
        // Abandoned: created orders that were never completed (status=created/pending)
        applyCompanyFilter(
          supabase.from("payments").select("id", { count: "exact", head: true })
            .in("status", ["created", "pending"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        // Failed payments
        applyCompanyFilter(
          supabase.from("payments").select("id", { count: "exact", head: true })
            .eq("status", "failed")
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        // SMS reminders sent for payment recovery
        supabase.from("sms_logs").select("id", { count: "exact", head: true })
          .in("sms_type", ["payment_reminder", "payment_retry", "second", "remarketing"])
          .gte("created_at", startISO).lte("created_at", endISO),
        // WhatsApp payment follow-ups (with company account filter)
        (() => {
          let q = supabase.from("unified_messages").select("id", { count: "exact", head: true })
            .eq("platform", "whatsapp").eq("direction", "outgoing")
            .gte("created_at", startISO).lte("created_at", endISO);
          if (companyId && waAccountIds.length > 0) q = q.in("account_id", waAccountIds);
          return q;
        })(),
        // Recovered payments (completed from marketing/whatsapp/telecaller sources - retry channels)
        applyCompanyFilter(
          supabase.from("payments").select("id, total_amount, created_at")
            .in("status", ["completed", "captured"])
            .in("payment_source", ["marketing", "whatsapp", "telecaller"])
            .gte("created_at", startISO).lte("created_at", endISO)
            .limit(50000)
        ),
        // Still pending (current state, not date-filtered)
        applyCompanyFilter(
          supabase.from("payments").select("id", { count: "exact", head: true })
            .in("status", ["created", "pending"])
        ),
      ]);

      const recoveredPayments = recoveredPaymentsRes.data || [];
      const recoveredRevenue = recoveredPayments.reduce((s, p) => s + (p.total_amount || 0), 0);
      const totalAbandoned = (abandonedCountRes.count || 0) + (failedCountRes.count || 0);
      const remindersSent = (reminderSmsCountRes.count || 0) + (reminderWaCountRes.count || 0);

      setStats({
        totalAbandoned,
        remindersSent,
        recovered: recoveredPayments.length,
        recoveredRevenue,
        recoveryRate: totalAbandoned + recoveredPayments.length > 0
          ? Math.round((recoveredPayments.length / (totalAbandoned + recoveredPayments.length)) * 100)
          : 0,
        pendingRetry: pendingCountRes.count || 0,
      });

      // Daily trend from recovered payments + SMS reminders
      const { data: reminderRows } = await supabase.from("sms_logs")
        .select("created_at")
        .in("sms_type", ["payment_reminder", "payment_retry", "second"])
        .gte("created_at", startISO).lte("created_at", endISO)
        .limit(50000);

      const dayMap: Record<string, { reminders: number; recovered: number; revenue: number }> = {};
      (reminderRows || []).forEach(s => {
        const d = toISTDate(s.created_at);
        if (!dayMap[d]) dayMap[d] = { reminders: 0, recovered: 0, revenue: 0 };
        dayMap[d].reminders++;
      });
      recoveredPayments.forEach(p => {
        const d = toISTDate(p.created_at);
        if (!dayMap[d]) dayMap[d] = { reminders: 0, recovered: 0, revenue: 0 };
        dayMap[d].recovered++;
        dayMap[d].revenue += p.total_amount || 0;
      });

      setDailyTrend(
        Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({
            date: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
            ...v,
          }))
      );
    } catch (err) {
      console.error("PaymentRecoveryReport error:", err);
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

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Abandoned", value: stats.totalAbandoned, icon: Clock, color: "text-amber-600" },
          { label: "Reminders Sent", value: stats.remindersSent, icon: Send, color: "text-blue-600" },
          { label: "Recovered", value: stats.recovered, icon: CheckCircle, color: "text-green-600" },
          { label: "Recovered ₹", value: `₹${stats.recoveredRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-600" },
          { label: "Recovery Rate", value: `${stats.recoveryRate}%`, icon: TrendingUp, color: "text-purple-600" },
          { label: "Still Pending", value: stats.pendingRetry, icon: RotateCcw, color: "text-red-500" },
        ].map(card => (
          <Card key={card.label} className="border-l-4 border-l-current">
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

      {/* Daily Trend */}
      {dailyTrend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Daily Payment Recovery Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar yAxisId="left" dataKey="reminders" fill="#f59e0b" name="Reminders" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="recovered" fill="#22c55e" name="Recovered" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="right" dataKey="revenue" fill="#8b5cf6" name="Revenue (₹)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentRecoveryReport;
