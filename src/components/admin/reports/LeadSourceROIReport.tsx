import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DollarSign, TrendingUp, Users, Target } from "lucide-react";

interface Props {
  startISO: string;
  endISO: string;
}

const SOURCE_COLORS: Record<string, string> = {
  "Website": "hsl(var(--primary))",
  "WhatsApp": "#25D366",
  "Telecaller": "#F59E0B",
  "SMS": "#8B5CF6",
  "Meta Ads": "#1877F2",
  "Direct": "#6B7280",
  "Other": "#EC4899",
};

const LeadSourceROIReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["lead-source-roi", startISO, endISO, companyId],
    queryFn: async () => {
      const [leadsRes, paymentsRes, expensesRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("id, source, status, created_at")
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        applyCompanyFilter(
          supabase.from("payments").select("lead_id, total_amount, created_at")
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        (() => {
          let q = supabase.from("accounting_entries")
            .select("amount, category, description")
            .eq("entry_type", "expense")
            .in("category", ["Meta Ads", "Google Ads", "Marketing", "SMS Marketing", "WhatsApp Marketing"])
            .gte("entry_date", startISO.split("T")[0])
            .lte("entry_date", endISO.split("T")[0]);
          if (companyId) q = q.eq("company_id", companyId);
          return q.limit(5000);
        })(),
      ]);

      const leads = leadsRes.data || [];
      const payments = paymentsRes.data || [];
      const expenses = expensesRes.data || [];

      const paymentByLead = new Map<string, number>();
      payments.forEach(p => {
        paymentByLead.set(p.lead_id, (paymentByLead.get(p.lead_id) || 0) + Number(p.total_amount));
      });

      const normalizeSource = (source: string | null): string => {
        if (!source) return "Direct";
        const s = source.toLowerCase();
        if (s.includes("website") || s.includes("otp")) return "Website";
        if (s.includes("whatsapp")) return "WhatsApp";
        if (s.includes("telecaller")) return "Telecaller";
        if (s.includes("sms")) return "SMS";
        if (s.includes("meta") || s.includes("facebook") || s.includes("instagram")) return "Meta Ads";
        if (s === "direct" || s === "manual") return "Direct";
        return "Other";
      };

      const sourceMap = new Map<string, { leads: number; paid: number; revenue: number }>();
      const paidStatuses = ["paid", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"];

      leads.forEach(l => {
        const src = normalizeSource(l.source);
        const entry = sourceMap.get(src) || { leads: 0, paid: 0, revenue: 0 };
        entry.leads++;
        if (paidStatuses.includes(l.status)) {
          entry.paid++;
          entry.revenue += paymentByLead.get(l.id) || 0;
        }
        sourceMap.set(src, entry);
      });

      const expenseBySource = new Map<string, number>();
      expenses.forEach(e => {
        const cat = e.category || "";
        let src = "Other";
        if (cat.includes("Meta") || cat.includes("Facebook")) src = "Meta Ads";
        else if (cat.includes("SMS")) src = "SMS";
        else if (cat.includes("WhatsApp")) src = "WhatsApp";
        else if (cat.includes("Google")) src = "Website";
        expenseBySource.set(src, (expenseBySource.get(src) || 0) + Number(e.amount));
      });

      const sourceData = Array.from(sourceMap.entries()).map(([source, d]) => {
        const spend = expenseBySource.get(source) || 0;
        const roi = spend > 0 ? ((d.revenue - spend) / spend) * 100 : d.revenue > 0 ? 999 : 0;
        const cpa = d.paid > 0 ? spend / d.paid : 0;
        const convRate = d.leads > 0 ? (d.paid / d.leads) * 100 : 0;
        return { source, leads: d.leads, paid: d.paid, revenue: d.revenue, spend, roi, cpa, convRate, color: SOURCE_COLORS[source] || "#6B7280" };
      }).sort((a, b) => b.revenue - a.revenue);

      const totals = sourceData.reduce(
        (acc, s) => ({ leads: acc.leads + s.leads, paid: acc.paid + s.paid, revenue: acc.revenue + s.revenue, spend: acc.spend + s.spend }),
        { leads: 0, paid: 0, revenue: 0, spend: 0 }
      );

      return { sourceData, totals };
    },
    staleTime: 2 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="w-4 h-4" /><span className="text-xs">Total Leads</span></div>
          <p className="text-xl font-bold">{data.totals.leads}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Target className="w-4 h-4" /><span className="text-xs">Paid Leads</span></div>
          <p className="text-xl font-bold">{data.totals.paid}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="w-4 h-4" /><span className="text-xs">Total Revenue</span></div>
          <p className="text-xl font-bold">₹{(data.totals.revenue / 1000).toFixed(1)}K</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><TrendingUp className="w-4 h-4" /><span className="text-xs">Total Spend</span></div>
          <p className="text-xl font-bold">₹{(data.totals.spend / 1000).toFixed(1)}K</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by Source</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {data.sourceData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Source Performance Breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium">Source</th>
                <th className="text-right py-2 font-medium">Leads</th>
                <th className="text-right py-2 font-medium">Paid</th>
                <th className="text-right py-2 font-medium">Conv%</th>
                <th className="text-right py-2 font-medium">Revenue</th>
                <th className="text-right py-2 font-medium">Spend</th>
                <th className="text-right py-2 font-medium">CPA</th>
                <th className="text-right py-2 font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.sourceData.map(s => (
                <tr key={s.source} className="border-b border-border/50">
                  <td className="py-2 font-medium flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.source}
                  </td>
                  <td className="text-right py-2">{s.leads}</td>
                  <td className="text-right py-2">{s.paid}</td>
                  <td className="text-right py-2">{s.convRate.toFixed(1)}%</td>
                  <td className="text-right py-2 font-semibold">₹{s.revenue.toLocaleString("en-IN")}</td>
                  <td className="text-right py-2">₹{s.spend.toLocaleString("en-IN")}</td>
                  <td className="text-right py-2">₹{s.cpa.toFixed(0)}</td>
                  <td className={`text-right py-2 font-bold ${s.roi >= 100 ? "text-green-600" : s.roi >= 0 ? "text-yellow-600" : "text-red-500"}`}>
                    {s.roi >= 999 ? "∞" : `${s.roi.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadSourceROIReport;
