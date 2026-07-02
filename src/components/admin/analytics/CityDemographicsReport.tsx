import { useState, useEffect } from "react";
import { MapPin, ArrowUpDown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface CityData {
  city: string;
  country: string;
  activeUsers: number;
  sessions: number;
  pageViews: number;
  leads: number;
  paidUsers: number;
  revenue: number;
  percentage: number;
}

interface CityDemographicsReportProps {
  dateRange: string;
  companyFilter?: string | null;
  domainPattern?: string | null;
  showAllCompanies?: boolean;
}

type SortKey = "activeUsers" | "sessions" | "pageViews" | "leads" | "paidUsers" | "revenue";

const CityDemographicsReport = ({ dateRange, companyFilter, domainPattern, showAllCompanies }: CityDemographicsReportProps) => {
  const { isHariox } = useCompanyFilter();
  const [data, setData] = useState<CityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("activeUsers");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchData();
  }, [dateRange, companyFilter, domainPattern, showAllCompanies]);

  const getStartDate = () => {
    const start = new Date();
    if (dateRange === "today") {
      start.setHours(0, 0, 0, 0);
    } else {
      const days = parseInt(dateRange.replace("d", ""));
      start.setDate(start.getDate() - days);
    }
    return start.toISOString();
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const startDate = getStartDate();

      const [eventsRes, leadsRes, paymentsRes] = await Promise.all([
        supabase
          .from("analytics_events")
          .select("*")
          .gte("created_at", startDate),
        supabase
          .from("leads")
          .select("id, city, company_id, created_at")
          .gte("created_at", startDate),
        supabase
          .from("payments")
          .select("id, lead_id, total_amount, company_id, created_at")
          .in("status", ["completed", "captured"])
          .gte("created_at", startDate),
      ]);

      let events = eventsRes.data || [];
      if (!showAllCompanies && domainPattern) {
        events = events.filter(e => (e.page_url || "").includes(domainPattern));
      }

      let leads = leadsRes.data || [];
      let payments = paymentsRes.data || [];
      if (companyFilter) {
        if (isHariox) {
          leads = leads.filter(l => l.company_id === companyFilter || l.company_id === null);
          payments = payments.filter(p => p.company_id === companyFilter || p.company_id === null);
        } else {
          leads = leads.filter(l => l.company_id === companyFilter);
          payments = payments.filter(p => p.company_id === companyFilter);
        }
      }

      // Aggregate analytics events by city
      const cityMap: Record<string, {
        city: string;
        country: string;
        visitors: Set<string>;
        sessions: Set<string>;
        pageViews: number;
      }> = {};

      events.forEach(e => {
        const city = e.city || "Unknown";
        const country = e.country || "";
        const key = `${city}|${country}`;

        if (!cityMap[key]) {
          cityMap[key] = { city, country, visitors: new Set(), sessions: new Set(), pageViews: 0 };
        }
        if (e.visitor_id) cityMap[key].visitors.add(e.visitor_id);
        if (e.session_id) cityMap[key].sessions.add(e.session_id);
        if (e.event_type === "pageview") cityMap[key].pageViews++;
      });

      // Aggregate leads by city
      const leadsByCity: Record<string, number> = {};
      leads.forEach(l => {
        const city = l.city || "Unknown";
        leadsByCity[city] = (leadsByCity[city] || 0) + 1;
      });

      // Get lead IDs for paid mapping
      const leadIds = new Set(leads.map(l => l.id));
      const paidByCity: Record<string, { count: number; revenue: number }> = {};

      // Map payments to cities via leads
      const leadCityMap: Record<string, string> = {};
      leads.forEach(l => { leadCityMap[l.id] = l.city || "Unknown"; });

      payments.forEach(p => {
        const city = leadCityMap[p.lead_id] || "Unknown";
        if (!paidByCity[city]) paidByCity[city] = { count: 0, revenue: 0 };
        paidByCity[city].count++;
        paidByCity[city].revenue += p.total_amount || 0;
      });

      // Compute totals for percentage
      const totalVisitors = Object.values(cityMap).reduce((acc, c) => acc + c.visitors.size, 0);

      const result: CityData[] = Object.values(cityMap)
        .filter(c => c.city !== "Unknown")
        .map(c => {
          const cityLeads = leadsByCity[c.city] || 0;
          const cityPaid = paidByCity[c.city] || { count: 0, revenue: 0 };

          return {
            city: c.city,
            country: c.country,
            activeUsers: c.visitors.size,
            sessions: c.sessions.size,
            pageViews: c.pageViews,
            leads: cityLeads,
            paidUsers: cityPaid.count,
            revenue: cityPaid.revenue,
            percentage: totalVisitors > 0 ? (c.visitors.size / totalVisitors) * 100 : 0,
          };
        });

      result.sort((a, b) => sortDir === "desc" ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
      setData(result);
    } catch (err) {
      console.error("City demographics error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortBy === field && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  const top10Chart = data.slice(0, 10).map(d => ({
    city: d.city.length > 12 ? d.city.slice(0, 12) + "…" : d.city,
    "Active Users": d.activeUsers,
    Leads: d.leads,
  }));

  // Unknown city stats
  const unknownEvents = data.length === 0 ? 0 : data.filter(d => d.city === "Unknown").reduce((a, d) => a + d.activeUsers, 0);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          City Demographics
        </h3>
        <Badge variant="outline" className="text-xs">
          {data.length} cities
        </Badge>
      </div>

      {/* Top cities chart */}
      {top10Chart.length > 0 && (
        <div className="h-52 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10Chart} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="city" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="Active Users" fill="#6366f1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Leads" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">City</TableHead>
              <SortHeader label="Active Users" field="activeUsers" />
              <SortHeader label="Sessions" field="sessions" />
              <SortHeader label="Views" field="pageViews" />
              <SortHeader label="Leads" field="leads" />
              <SortHeader label="Paid" field="paidUsers" />
              <SortHeader label="Revenue" field="revenue" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No city data available
                </TableCell>
              </TableRow>
            ) : (
              data.slice(0, 20).map((row) => (
                <TableRow key={`${row.city}-${row.country}`}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{row.city}</p>
                      {row.country && (
                        <p className="text-xs text-muted-foreground">{row.country}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.activeUsers}</span>
                      <span className="text-xs text-muted-foreground">({row.percentage.toFixed(1)}%)</span>
                    </div>
                  </TableCell>
                  <TableCell>{row.sessions}</TableCell>
                  <TableCell>{row.pageViews}</TableCell>
                  <TableCell>
                    <span className={row.leads > 0 ? "text-primary font-medium" : "text-muted-foreground"}>
                      {row.leads}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={row.paidUsers > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                      {row.paidUsers}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.revenue > 0 ? (
                      <span className="font-medium">₹{row.revenue.toLocaleString("en-IN")}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CityDemographicsReport;
