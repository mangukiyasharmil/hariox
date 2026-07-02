import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, TrendingUp, TrendingDown, IndianRupee, Users, Target, ArrowUpRight, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface CityPerformance {
  city: string;
  state: string;
  totalLeads: number;
  paidLeads: number;
  revenue: number;
  conversionRate: number;
  loanTypes: Record<string, { leads: number; paid: number; revenue: number }>;
  sources: Record<string, number>;
  avgLoanAmount: number;
  adSpend: number;
  profit: number;
  cpa: number;
}

interface CityAdPerformanceProps {
  dateFilter: string;
  dateEndFilter?: string;
}

const COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

const CityAdPerformance = ({ dateFilter, dateEndFilter }: CityAdPerformanceProps) => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [cities, setCities] = useState<CityPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"leads" | "revenue" | "conversion">("leads");

  useEffect(() => {
    fetchData();
  }, [dateFilter, dateEndFilter, currentCompany?.id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const companyId = getCompanyFilter();
      const isHariox = currentCompany?.slug === "hariox";

      let leadsQuery = supabase
        .from("leads")
        .select("id, city, state, status, loan_type, loan_amount, utm_source, utm_medium, utm_campaign, source")
        .gte("created_at", dateFilter);

      if (dateEndFilter) leadsQuery = leadsQuery.lte("created_at", dateEndFilter);

      if (companyId) {
        leadsQuery = isHariox
          ? leadsQuery.or(`company_id.eq.${companyId},company_id.is.null`)
          : leadsQuery.eq("company_id", companyId);
      }

      const { data: leads } = await leadsQuery.limit(10000);
      if (!leads || leads.length === 0) { setCities([]); setIsLoading(false); return; }

      const leadIds = leads.map(l => l.id);
      // Batch payment fetch (max 500 per .in())
      const paymentBatches = [];
      for (let i = 0; i < leadIds.length; i += 500) {
        paymentBatches.push(
          supabase.from("payments").select("lead_id, total_amount")
            .in("lead_id", leadIds.slice(i, i + 500))
            .in("status", ["completed", "captured"])
        );
      }
      // Also fetch ad expenses for P&L
      const expenseQuery = supabase.from("accounting_entries")
        .select("amount, category")
        .eq("entry_type", "expense")
        .in("category", ["Meta Ads", "Google Ads", "Marketing"])
        .gte("entry_date", dateFilter.split("T")[0])
        .lte("entry_date", (dateEndFilter || dateFilter).split("T")[0])
        .limit(5000);

      const [paymentResults, expenseResult] = await Promise.all([
        Promise.all(paymentBatches),
        companyId ? expenseQuery.eq("company_id", companyId) : expenseQuery,
      ]);
      const allPayments = paymentResults.flatMap(r => r.data || []);
      const totalAdSpend = (expenseResult.data || []).reduce((s: number, e: any) => s + Number(e.amount), 0);

      const paymentMap = new Map<string, number>();
      allPayments.forEach(p => {
        paymentMap.set(p.lead_id, (paymentMap.get(p.lead_id) || 0) + p.total_amount);
      });
      const paidSet = new Set(allPayments.map(p => p.lead_id));

      // Group by city — skip leads with no city data
      const cityMap = new Map<string, CityPerformance>();
      let noCityCount = 0;

      leads.forEach(lead => {
        const rawCity = (lead.city || "").trim();
        if (!rawCity || rawCity.toLowerCase() === "unknown") {
          noCityCount++;
          return; // Skip leads without city for main table
        }
        const city = rawCity;
        const key = city.toLowerCase();
        if (!cityMap.has(key)) {
          cityMap.set(key, {
            city, state: lead.state || "", totalLeads: 0, paidLeads: 0, revenue: 0,
            conversionRate: 0, loanTypes: {}, sources: {}, avgLoanAmount: 0,
            adSpend: 0, profit: 0, cpa: 0,
          });
        }
        const d = cityMap.get(key)!;
        d.totalLeads++;
        d.avgLoanAmount += lead.loan_amount || 0;

        // Loan type breakdown
        const lt = lead.loan_type || "other";
        if (!d.loanTypes[lt]) d.loanTypes[lt] = { leads: 0, paid: 0, revenue: 0 };
        d.loanTypes[lt].leads++;

        // Source tracking
        const src = lead.utm_source || lead.source || "direct";
        d.sources[src] = (d.sources[src] || 0) + 1;

        if (paidSet.has(lead.id)) {
          d.paidLeads++;
          d.revenue += paymentMap.get(lead.id) || 0;
          d.loanTypes[lt].paid++;
          d.loanTypes[lt].revenue += paymentMap.get(lead.id) || 0;
        }
      });

      // Distribute ad spend proportionally by leads
      const totalTrackedLeads = Array.from(cityMap.values()).reduce((s, c) => s + c.totalLeads, 0) || 1;
      const list = Array.from(cityMap.values()).map(c => {
        const spend = (c.totalLeads / totalTrackedLeads) * totalAdSpend;
        return {
          ...c,
          conversionRate: c.totalLeads > 0 ? Math.round((c.paidLeads / c.totalLeads) * 100) : 0,
          avgLoanAmount: c.totalLeads > 0 ? Math.round(c.avgLoanAmount / c.totalLeads) : 0,
          adSpend: spend,
          profit: c.revenue - spend,
          cpa: c.paidLeads > 0 ? spend / c.paidLeads : 0,
        };
      });

      setCities(list);
      setNoCityLeads(noCityCount);
    } catch (err) {
      console.error("City ad performance error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const [noCityLeads, setNoCityLeads] = useState(0);

  // Update noCityLeads when cities change (set during fetchData via a ref pattern)
  const sorted = useMemo(() => {
    const s = [...cities];
    if (sortBy === "leads") s.sort((a, b) => b.totalLeads - a.totalLeads);
    else if (sortBy === "revenue") s.sort((a, b) => b.revenue - a.revenue);
    else s.sort((a, b) => b.conversionRate - a.conversionRate);
    return s;
  }, [cities, sortBy]);

  const topCities = sorted.slice(0, 15);
  const trackedLeads = cities.reduce((s, c) => s + c.totalLeads, 0);
  const totalPaid = cities.reduce((s, c) => s + c.paidLeads, 0);
  const totalRevenue = cities.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = trackedLeads + noCityLeads;
  const avgConversion = trackedLeads > 0 ? Math.round((totalPaid / trackedLeads) * 100) : 0;
  const cityTrackingRate = totalLeads > 0 ? Math.round((trackedLeads / totalLeads) * 100) : 0;

  // Loan type distribution across all cities
  const loanTypeAgg: Record<string, { leads: number; paid: number; revenue: number }> = {};
  cities.forEach(c => {
    Object.entries(c.loanTypes).forEach(([lt, v]) => {
      if (!loanTypeAgg[lt]) loanTypeAgg[lt] = { leads: 0, paid: 0, revenue: 0 };
      loanTypeAgg[lt].leads += v.leads;
      loanTypeAgg[lt].paid += v.paid;
      loanTypeAgg[lt].revenue += v.revenue;
    });
  });

  const loanTypePie = Object.entries(loanTypeAgg)
    .map(([type, v]) => ({ name: type.replace(/_/g, " "), ...v }))
    .sort((a, b) => b.leads - a.leads);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* City Tracking Health Alert */}
      {noCityLeads > 0 && (
        <div className={`rounded-xl p-3 border flex items-center gap-3 ${
          cityTrackingRate < 50 
            ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" 
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
        }`}>
          <MapPin className={`w-5 h-5 ${cityTrackingRate < 50 ? "text-red-600" : "text-amber-600"}`} />
          <div className="flex-1">
            <p className="text-xs font-semibold">{cityTrackingRate}% City Tracking Rate</p>
            <p className="text-[10px] text-muted-foreground">
              {noCityLeads.toLocaleString("en-IN")} leads missing city data (incomplete form fills). Only {trackedLeads.toLocaleString("en-IN")} leads have city info.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards - Single Line */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { label: "Cities", value: cities.length, icon: MapPin, color: "text-blue-600" },
          { label: "Tracked", value: trackedLeads, icon: Users, color: "text-purple-600" },
          { label: "No City", value: noCityLeads, icon: Target, color: "text-red-600" },
          { label: "Paid", value: totalPaid, icon: Target, color: "text-green-600" },
          { label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-amber-600" },
        ].map(card => (
          <div key={card.label} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-2 border border-border/50 whitespace-nowrap shrink-0">
            <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
            <span className="text-[10px] text-muted-foreground">{card.label}:</span>
            <span className={`text-sm font-bold ${card.color}`}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Cities Bar Chart */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Top Cities — Leads vs Paid
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCities.slice(0, 10)} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="city" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                <Bar dataKey="totalLeads" fill="#8b5cf6" name="Leads" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paidLeads" fill="#22c55e" name="Paid" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loan Type Distribution Pie */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Loan Type Distribution
          </h3>
          {loanTypePie.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={loanTypePie} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}
                    dataKey="leads" nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}>
                    {loanTypePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val: number, name: string, props: any) => {
                    const item = props.payload;
                    return [`${val} leads, ${item.paid} paid, ₹${item.revenue.toLocaleString("en-IN")}`, name];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Detailed City Table */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            City Performance Table
          </h3>
          <div className="flex gap-1">
            {(["leads", "revenue", "conversion"] as const).map(key => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                  sortBy === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                {key === "leads" ? "By Leads" : key === "revenue" ? "By Revenue" : "By Conv%"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] w-8">#</TableHead>
                <TableHead className="text-[10px]">City</TableHead>
                <TableHead className="text-[10px]">State</TableHead>
                <TableHead className="text-[10px] text-right">Leads</TableHead>
                <TableHead className="text-[10px] text-right">Paid</TableHead>
                <TableHead className="text-[10px] text-right">Conv%</TableHead>
                <TableHead className="text-[10px] text-right">Revenue</TableHead>
                <TableHead className="text-[10px] text-right">Spend</TableHead>
                <TableHead className="text-[10px] text-right">Profit</TableHead>
                <TableHead className="text-[10px] text-right">CPA</TableHead>
                <TableHead className="text-[10px]">Top Loan Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 30).map((city, i) => {
                const topLoan = Object.entries(city.loanTypes).sort((a, b) => b[1].leads - a[1].leads)[0];
                return (
                  <TableRow key={city.city + i}>
                    <TableCell className="text-[10px] font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">{city.city}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{city.state || "—"}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{city.totalLeads}</TableCell>
                    <TableCell className="text-xs text-right font-medium text-green-600">{city.paidLeads}</TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        city.conversionRate >= avgConversion
                          ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                      }`}>
                        {city.conversionRate >= avgConversion ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {city.conversionRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">₹{city.revenue.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-[10px] text-right">₹{Math.round(city.adSpend).toLocaleString("en-IN")}</TableCell>
                    <TableCell className={`text-[10px] text-right font-bold ${city.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      ₹{Math.round(city.profit).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-[10px] text-right">₹{Math.round(city.cpa).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-[10px] capitalize">{topLoan ? topLoan[0].replace(/_/g, " ") : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {cities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <MapPin className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No city data available for this period</p>
          </div>
        )}
      </div>

      {/* Loan Type × City Heatmap Table */}
      <CityLoanTypeBreakdown cities={sorted.slice(0, 10)} loanTypes={Object.keys(loanTypeAgg)} />
    </div>
  );
};

// Sub-component: City × Loan Type matrix
const CityLoanTypeBreakdown = ({ cities, loanTypes }: { cities: CityPerformance[]; loanTypes: string[] }) => {
  if (cities.length === 0 || loanTypes.length === 0) return null;

  const topTypes = loanTypes.slice(0, 6);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <ArrowUpRight className="w-4 h-4 text-primary" />
        City × Loan Type Breakdown (Top 10 Cities)
      </h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">City</TableHead>
              {topTypes.map(lt => (
                <TableHead key={lt} className="text-[10px] text-center capitalize">{lt.replace(/_/g, " ")}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cities.map(city => (
              <TableRow key={city.city}>
                <TableCell className="text-xs font-medium">{city.city}</TableCell>
                {topTypes.map(lt => {
                  const d = city.loanTypes[lt];
                  if (!d || d.leads === 0) return <TableCell key={lt} className="text-center text-[10px] text-muted-foreground">—</TableCell>;
                  const conv = Math.round((d.paid / d.leads) * 100);
                  return (
                    <TableCell key={lt} className="text-center">
                      <div className="text-[10px]">
                        <span className="font-medium">{d.leads}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-green-600 font-medium">{d.paid}</span>
                      </div>
                      <div className={`text-[9px] ${conv > 0 ? "text-green-600" : "text-muted-foreground"}`}>{conv}%</div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CityAdPerformance;
