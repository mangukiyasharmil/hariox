import { useState, useEffect } from "react";
import { FileText, ArrowUpDown, TrendingUp, Users, Eye, Target, IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";

interface LandingPageData {
  page: string;
  path: string;
  activeUsers: number;
  sessions: number;
  pageViews: number;
  leads: number;
  paidUsers: number;
  revenue: number;
  conversionRate: number;
  bounceRate: number;
}

interface LandingPageReportProps {
  dateRange: string;
  companyFilter?: string | null;
  domainPattern?: string | null;
  showAllCompanies?: boolean;
}

type SortKey = "activeUsers" | "sessions" | "pageViews" | "leads" | "paidUsers" | "revenue" | "conversionRate";

const LandingPageReport = ({ dateRange, companyFilter, domainPattern, showAllCompanies }: LandingPageReportProps) => {
  const { isHariox } = useCompanyFilter();
  const [data, setData] = useState<LandingPageData[]>([]);
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

      // Fetch analytics events, leads, and payments in parallel
      const [eventsRes, leadsRes, paymentsRes] = await Promise.all([
        supabase
          .from("analytics_events")
          .select("*")
          .gte("created_at", startDate)
          .order("created_at", { ascending: true }),
        supabase
          .from("leads")
          .select("id, created_at, company_id, source")
          .gte("created_at", startDate),
        supabase
          .from("payments")
          .select("id, lead_id, total_amount, company_id, created_at, payment_source")
          .in("status", ["completed", "captured"])
          .gte("created_at", startDate),
      ]);

      let events = eventsRes.data || [];

      // Apply domain filtering
      if (!showAllCompanies && domainPattern) {
        events = events.filter(e => (e.page_url || "").includes(domainPattern));
      }

      // Filter leads/payments by company (include null for Hariox)
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

      // Build page-level aggregation from analytics events
      const pageMap: Record<string, {
        path: string;
        displayName: string;
        visitors: Set<string>;
        sessions: Set<string>;
        pageViews: number;
      }> = {};

      events.forEach(e => {
        let pathname = "/";
        try {
          pathname = new URL(e.page_url || "/").pathname || "/";
        } catch { pathname = "/"; }

        if (!pageMap[pathname]) {
          pageMap[pathname] = {
            path: pathname,
            displayName: getPageName(pathname),
            visitors: new Set(),
            sessions: new Set(),
            pageViews: 0,
          };
        }
        if (e.visitor_id) pageMap[pathname].visitors.add(e.visitor_id);
        if (e.session_id) pageMap[pathname].sessions.add(e.session_id);
        if (e.event_type === "pageview") pageMap[pathname].pageViews++;
      });

      // Map leads by source to pages
      const totalLeads = leads.length;
      const leadsBySource: Record<string, number> = {};
      leads.forEach(l => {
        const src = (l.source || "website").toLowerCase();
        leadsBySource[src] = (leadsBySource[src] || 0) + 1;
      });

      // Source → display path mapping (canonical path for attribution)
      const sourceToCanonicalPath: Record<string, string> = {
        "direct": "/",
        "website": "/",
        "marketing": "/pay/marketing",
        "sms": "/pay/marketing",
        "sms-link": "/pay/marketing",
        "telecaller": "/pay/telecaller",
        "whatsapp": "/pay/whatsapp",
        "manual": "/",
      };

      // Build paid counts per canonical path
      const paidByPath: Record<string, { count: number; revenue: number }> = {};
      payments.forEach(p => {
        const src = (p.payment_source || "direct").toLowerCase();
        const targetPath = sourceToCanonicalPath[src] || "/";
        if (!paidByPath[targetPath]) paidByPath[targetPath] = { count: 0, revenue: 0 };
        paidByPath[targetPath].count++;
        paidByPath[targetPath].revenue += p.total_amount || 0;
      });

      // Build leads per canonical path
      const leadsByPath: Record<string, number> = {};
      Object.entries(leadsBySource).forEach(([src, count]) => {
        const targetPath = sourceToCanonicalPath[src] || "/";
        leadsByPath[targetPath] = (leadsByPath[targetPath] || 0) + count;
      });

      // Ensure canonical paths exist in pageMap even without pageview data
      const allAttributionPaths = new Set([...Object.values(sourceToCanonicalPath)]);
      allAttributionPaths.forEach(path => {
        if (!pageMap[path] && ((paidByPath[path]?.count || 0) > 0 || (leadsByPath[path] || 0) > 0)) {
          pageMap[path] = {
            path,
            displayName: getPageName(path),
            visitors: new Set(),
            sessions: new Set(),
            pageViews: 0,
          };
        }
      });

      const result: LandingPageData[] = Object.values(pageMap)
        .filter(p => p.pageViews > 0 || (paidByPath[p.path]?.count || 0) > 0 || (leadsByPath[p.path] || 0) > 0)
        .map(p => {
          const pagePaid = paidByPath[p.path] || { count: 0, revenue: 0 };
          const pageLeads = leadsByPath[p.path] || 0;

          // Calculate bounce rate for this page
          const sessionPages: Record<string, number> = {};
          events.filter(e => e.event_type === "pageview").forEach(e => {
            let ep = "/";
            try { ep = new URL(e.page_url || "/").pathname || "/"; } catch {}
            if (ep === p.path && e.session_id) {
              sessionPages[e.session_id] = (sessionPages[e.session_id] || 0) + 1;
            }
          });
          const totalSess = Object.keys(sessionPages).length;
          const bounced = Object.values(sessionPages).filter(c => c === 1).length;

          return {
            page: p.displayName,
            path: p.path,
            activeUsers: p.visitors.size,
            sessions: p.sessions.size,
            pageViews: p.pageViews,
            leads: pageLeads,
            paidUsers: pagePaid.count,
            revenue: pagePaid.revenue,
            conversionRate: p.visitors.size > 0 ? (pageLeads / p.visitors.size) * 100 : 0,
            bounceRate: totalSess > 0 ? (bounced / totalSess) * 100 : 0,
          };
        });

      // Sort
      result.sort((a, b) => sortDir === "desc" ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
      setData(result);
    } catch (err) {
      console.error("Landing page report error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceFromPath = (path: string): string => {
    if (path.startsWith("/pay/telecaller") || path === "/telecaller") return "telecaller";
    if (path.startsWith("/pay/whatsapp") || path.startsWith("/pay/w")) return "whatsapp";
    if (path.startsWith("/pay/marketing")) return "marketing";
    if (path.startsWith("/pay/sms")) return "sms-link";
    return "direct";
  };

  const getPageName = (pathname: string): string => {
    const map: Record<string, string> = {
      "/": "Home (Landing Page)",
      "/telecaller": "Telecaller Portal",
      "/marketing": "Marketing Portal",
      "/pay": "Payment Page",
      "/pay/telecaller": "Payment - Telecaller",
      "/pay/whatsapp": "Payment - WhatsApp",
      "/pay/marketing": "Payment - Marketing",
      "/pay/w": "Payment - WhatsApp (Short)",
      "/pay/sms": "Payment - SMS",
      "/blog": "Blog",
      "/document-upload": "Document Upload",
      "/payment-success": "Payment Success",
      "/privacy-policy": "Privacy Policy",
      "/terms-of-service": "Terms of Service",
      "/refund-policy": "Refund Policy",
    };
    if (map[pathname]) return map[pathname];
    if (pathname.startsWith("/pay/")) {
      const slug = pathname.split("/").pop() || "";
      return `Payment - ${slug.charAt(0).toUpperCase() + slug.slice(1)}`;
    }
    if (pathname.startsWith("/blog/")) return "Blog Post";
    return pathname.split("/").filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")).join(" / ") || "Home";
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

  const totals = data.reduce(
    (acc, d) => ({
      activeUsers: acc.activeUsers + d.activeUsers,
      sessions: acc.sessions + d.sessions,
      pageViews: acc.pageViews + d.pageViews,
      leads: acc.leads + d.leads,
      paidUsers: acc.paidUsers + d.paidUsers,
      revenue: acc.revenue + d.revenue,
    }),
    { activeUsers: 0, sessions: 0, pageViews: 0, leads: 0, paidUsers: 0, revenue: 0 }
  );

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Landing Page Performance
        </h3>
        <Badge variant="outline" className="text-xs">
          {data.length} pages
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold">{totals.activeUsers}</p>
          <p className="text-xs text-muted-foreground">Active Users</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold">{totals.pageViews}</p>
          <p className="text-xs text-muted-foreground">Views</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold">{totals.leads}</p>
          <p className="text-xs text-muted-foreground">Leads</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold">₹{totals.revenue.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted-foreground">Revenue</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[200px]">Landing page</TableHead>
              <SortHeader label="Sessions" field="sessions" />
              <SortHeader label="Active Users" field="activeUsers" />
              <SortHeader label="New Users" field="pageViews" />
              <SortHeader label="Leads" field="leads" />
              <SortHeader label="Paid" field="paidUsers" />
              <SortHeader label="Revenue" field="revenue" />
              <SortHeader label="CVR %" field="conversionRate" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Total row like GA */}
            <TableRow className="bg-muted/30 font-medium border-b-2 border-border">
              <TableCell></TableCell>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell>
                <div>{totals.sessions}</div>
                <div className="text-xs text-muted-foreground">100% of total</div>
              </TableCell>
              <TableCell>
                <div>{totals.activeUsers}</div>
                <div className="text-xs text-muted-foreground">100% of total</div>
              </TableCell>
              <TableCell>
                <div>{totals.pageViews}</div>
                <div className="text-xs text-muted-foreground">100% of total</div>
              </TableCell>
              <TableCell className="text-primary font-medium">{totals.leads}</TableCell>
              <TableCell className="text-emerald-600 font-medium">{totals.paidUsers}</TableCell>
              <TableCell className="font-medium">₹{totals.revenue.toLocaleString("en-IN")}</TableCell>
              <TableCell>
                {totals.activeUsers > 0 ? ((totals.leads / totals.activeUsers) * 100).toFixed(1) : "0"}%
              </TableCell>
            </TableRow>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No landing page data available
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow key={row.path}>
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-primary">{row.path}</span>
                  </TableCell>
                  <TableCell>
                    <div>{row.sessions}</div>
                    <div className="text-xs text-muted-foreground">
                      {totals.sessions > 0 ? ((row.sessions / totals.sessions) * 100).toFixed(1) : "0"}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{row.activeUsers}</div>
                    <div className="text-xs text-muted-foreground">
                      {totals.activeUsers > 0 ? ((row.activeUsers / totals.activeUsers) * 100).toFixed(1) : "0"}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{row.pageViews}</div>
                    <div className="text-xs text-muted-foreground">
                      {totals.pageViews > 0 ? ((row.pageViews / totals.pageViews) * 100).toFixed(1) : "0"}%
                    </div>
                  </TableCell>
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
                      <span className="text-muted-foreground">₹0.00</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.conversionRate >= 5
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : row.conversionRate >= 2
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {row.conversionRate.toFixed(1)}%
                    </Badge>
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

export default LandingPageReport;
