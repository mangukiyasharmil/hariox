import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertCircle, PhoneOff, IndianRupee, UserX } from "lucide-react";

interface Props {
  startISO: string;
  endISO: string;
}

const LOSS_COLORS = ["#EF4444", "#F97316", "#EAB308", "#6366F1", "#8B5CF6", "#EC4899"];

const LostLeadAnalysis = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["lost-lead-analysis", startISO, endISO, companyId],
    queryFn: async () => {
      const [lostRes, allLeadsRes, callsRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("id, full_name, phone, city, loan_amount, monthly_income, cibil_score_range, source, created_at, follow_up_notes, employment_type")
            .eq("status", "lost")
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        applyCompanyFilter(
          supabase.from("leads").select("id, status")
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        (() => {
          let q = supabase.from("call_logs").select("lead_id, outcome")
            .gte("created_at", startISO).lte("created_at", endISO);
          if (companyId) q = q.eq("company_id", companyId);
          return q.limit(5000);
        })(),
      ]);

      const lost = lostRes.data || [];
      const allLeads = allLeadsRes.data || [];
      const calls = callsRes.data || [];

      const lostRate = allLeads.length > 0 ? (lost.length / allLeads.length) * 100 : 0;

      const callsByLead = new Map<string, string[]>();
      calls.forEach(c => {
        const list = callsByLead.get(c.lead_id) || [];
        list.push(c.outcome || "unknown");
        callsByLead.set(c.lead_id, list);
      });

      const reasons = new Map<string, number>();
      lost.forEach(l => {
        const leadCalls = callsByLead.get(l.id) || [];
        let reason = "Unknown";
        
        if (leadCalls.length === 0) reason = "No Contact Attempted";
        else if (leadCalls.every(o => ["no_answer", "busy", "switched_off"].includes(o))) reason = "Unreachable";
        else if (l.cibil_score_range && ["below-550", "no-cibil"].includes(l.cibil_score_range)) reason = "Low CIBIL Score";
        else if (Number(l.monthly_income) < 15000) reason = "Low Income";
        else if (l.follow_up_notes?.toLowerCase().includes("not interested")) reason = "Not Interested";
        else if (leadCalls.some(o => o === "connected")) reason = "Connected but Lost";
        else reason = "Other";

        reasons.set(reason, (reasons.get(reason) || 0) + 1);
      });

      const reasonData = Array.from(reasons.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const cityLost = new Map<string, number>();
      lost.forEach(l => {
        const city = l.city || "Unknown";
        cityLost.set(city, (cityLost.get(city) || 0) + 1);
      });
      const topLostCities = Array.from(cityLost.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const recoverableCount = lost.filter(l => {
        const lCalls = callsByLead.get(l.id) || [];
        const income = Number(l.monthly_income);
        return income >= 25000 && lCalls.length <= 1;
      }).length;

      return { lost: lost.length, lostRate, reasonData, topLostCities, recoverableCount };
    },
    staleTime: 2 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-red-500/30"><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><UserX className="w-4 h-4" /><span className="text-xs">Lost Leads</span></div>
          <p className="text-xl font-bold text-red-500">{data.lost}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><AlertCircle className="w-4 h-4" /><span className="text-xs">Loss Rate</span></div>
          <p className="text-xl font-bold">{data.lostRate.toFixed(1)}%</p>
        </CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><PhoneOff className="w-4 h-4" /><span className="text-xs">Recoverable</span></div>
          <p className="text-xl font-bold text-green-600">{data.recoverableCount}</p>
          <p className="text-[10px] text-muted-foreground">Good profile, minimal contact</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><IndianRupee className="w-4 h-4" /><span className="text-xs">#1 Loss Reason</span></div>
          <p className="text-sm font-bold">{data.reasonData[0]?.name || "N/A"}</p>
          <p className="text-[10px] text-muted-foreground">{data.reasonData[0]?.value || 0} leads</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Loss Reasons Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={data.reasonData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {data.reasonData.map((_, i) => <Cell key={i} fill={LOSS_COLORS[i % LOSS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {data.reasonData.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: LOSS_COLORS[i % LOSS_COLORS.length] }} />
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="font-bold">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Lost Lead Cities</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topLostCities} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="city" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" name="Lost" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LostLeadAnalysis;
