import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MapPin, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  startISO: string;
  endISO: string;
}

const CityPnLReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["city-pnl", startISO, endISO, companyId],
    queryFn: async () => {
      const [leadsRes, paymentsRes, expensesRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("id, city, status, utm_source, utm_campaign, created_at")
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        applyCompanyFilter(
          supabase.from("payments").select("lead_id, total_amount")
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ).limit(5000),
        (() => {
          let q = supabase.from("accounting_entries")
            .select("amount, description, category")
            .eq("entry_type", "expense")
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

      const paidStatuses = ["paid", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"];
      const cityMap = new Map<string, { leads: number; paid: number; revenue: number; adSpend: number }>();

      leads.forEach(l => {
        const city = (l.city || "Unknown").trim();
        const entry = cityMap.get(city) || { leads: 0, paid: 0, revenue: 0, adSpend: 0 };
        entry.leads++;
        if (paidStatuses.includes(l.status)) {
          entry.paid++;
          entry.revenue += paymentByLead.get(l.id) || 0;
        }
        cityMap.set(city, entry);
      });

      const totalAdSpend = expenses
        .filter(e => ["Meta Ads", "Google Ads", "Marketing"].includes(e.category))
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const totalLeads = leads.length || 1;
      cityMap.forEach((v) => {
        v.adSpend = (v.leads / totalLeads) * totalAdSpend;
      });

      const cities = Array.from(cityMap.entries())
        .map(([city, d]) => ({
          city, leads: d.leads, paid: d.paid, revenue: d.revenue, spend: d.adSpend,
          profit: d.revenue - d.adSpend,
          convRate: d.leads > 0 ? (d.paid / d.leads) * 100 : 0,
          cpa: d.paid > 0 ? d.adSpend / d.paid : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const topProfitable = [...cities].sort((a, b) => b.profit - a.profit).slice(0, 5);
      const bottomProfitable = [...cities].filter(c => c.leads >= 3).sort((a, b) => a.profit - b.profit).slice(0, 5);

      return { cities: cities.slice(0, 20), topProfitable, bottomProfitable };
    },
    staleTime: 2 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="border-green-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> Top Profitable Cities</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topProfitable.map((c, i) => (
                <div key={c.city} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-600">#{i + 1}</span>
                    <MapPin className="w-3 h-3" />
                    <span className="font-medium">{c.city}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{c.paid} paid</span>
                    <span className="font-bold text-green-600">₹{(c.profit / 1000).toFixed(1)}K</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Low Performing Cities</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.bottomProfitable.map((c, i) => (
                <div key={c.city} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-500">#{i + 1}</span>
                    <MapPin className="w-3 h-3" />
                    <span className="font-medium">{c.city}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{c.paid} paid</span>
                    <span className={`font-bold ${c.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      ₹{(c.profit / 1000).toFixed(1)}K
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue vs Spend by City (Top 15)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cities.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="city" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spend" name="Ad Spend" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">City-wise P&L Breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2">City</th>
              <th className="text-right py-2">Leads</th>
              <th className="text-right py-2">Paid</th>
              <th className="text-right py-2">Conv%</th>
              <th className="text-right py-2">Revenue</th>
              <th className="text-right py-2">Spend</th>
              <th className="text-right py-2">Profit</th>
              <th className="text-right py-2">CPA</th>
            </tr></thead>
            <tbody>
              {data.cities.map(c => (
                <tr key={c.city} className="border-b border-border/50">
                  <td className="py-2 font-medium">{c.city}</td>
                  <td className="text-right py-2">{c.leads}</td>
                  <td className="text-right py-2">{c.paid}</td>
                  <td className="text-right py-2">{c.convRate.toFixed(1)}%</td>
                  <td className="text-right py-2">₹{c.revenue.toLocaleString("en-IN")}</td>
                  <td className="text-right py-2">₹{Math.round(c.spend).toLocaleString("en-IN")}</td>
                  <td className={`text-right py-2 font-bold ${c.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                    ₹{Math.round(c.profit).toLocaleString("en-IN")}
                  </td>
                  <td className="text-right py-2">₹{Math.round(c.cpa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CityPnLReport;
