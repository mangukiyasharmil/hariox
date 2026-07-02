import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, Search, BarChart3, ExternalLink, Eye, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface PageData {
  pagePath: string;
  pageviews: number;
  uniqueVisitors: number;
  leads: number;
  paid: number;
  revenue: number;
  conversionRate: number;
}

interface UTMCampaignPerformanceProps {
  dateFilter: string;
  dateEndFilter?: string;
}

const UTMCampaignPerformance = ({ dateFilter, dateEndFilter }: UTMCampaignPerformanceProps) => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [pages, setPages] = useState<PageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ pageviews: 0, visitors: 0, leads: 0, paid: 0, revenue: 0 });

  useEffect(() => {
    fetchData();
  }, [dateFilter, dateEndFilter, currentCompany?.id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const companyId = getCompanyFilter();
      const isHariox = currentCompany?.slug === "hariox";

      const applyFilter = (query: any) => {
        if (!companyId) return query;
        return isHariox
          ? query.or(`company_id.eq.${companyId},company_id.is.null`)
          : query.eq("company_id", companyId);
      };

      // Fetch all pageview analytics (increased limit for accuracy)
      let analyticsQuery = supabase
        .from("analytics_events")
        .select("page_path, page_url, visitor_id")
        .eq("event_type", "pageview")
        .gte("created_at", dateFilter)
        .limit(5000);
      if (dateEndFilter) analyticsQuery = analyticsQuery.lte("created_at", dateEndFilter);
      const { data: analyticsEvents } = await analyticsQuery;

      // Fetch leads with source
      let leadsQuery = supabase
        .from("leads")
        .select("id, source, utm_source, utm_medium, utm_campaign")
        .gte("created_at", dateFilter);
      if (dateEndFilter) leadsQuery = leadsQuery.lte("created_at", dateEndFilter);
      leadsQuery = applyFilter(leadsQuery);
      const { data: leads } = await leadsQuery;

      // Fetch payments for leads
      const leadIds = (leads || []).map(l => l.id);
      let payments: any[] = [];
      if (leadIds.length > 0) {
        const { data: payData } = await supabase
          .from("payments")
          .select("lead_id, total_amount")
          .in("lead_id", leadIds)
          .in("status", ["completed", "captured"]);
        payments = payData || [];
      }

      const paidLeadMap = new Map<string, number>();
      payments.forEach(p => {
        paidLeadMap.set(p.lead_id, (paidLeadMap.get(p.lead_id) || 0) + p.total_amount);
      });

      // Filter analytics by domain if company selected
      let eventsData = analyticsEvents || [];
      if (companyId && currentCompany) {
        const getDomain = (c: typeof currentCompany): string | null => {
          if (!c) return null;
          const slug = c.slug?.toLowerCase() || "";
          if (slug === "hariox") return "credit.hariox.com";
          if (slug === "capital") return "capital.hariox.com";
          if (slug === "finance") return "finance.hariox.com";
          return null;
        };
        const domain = getDomain(currentCompany);
        if (domain) {
          eventsData = eventsData.filter(e => (e.page_url || "").includes(domain));
        }
      }

      // Build page data from analytics (exclude admin routes)
      const pageMap = new Map<string, { pageviews: number; visitors: Set<string> }>();
      eventsData.forEach(e => {
        const path = e.page_path || "/";
        if (path.startsWith("/admin")) return; // Skip admin pages
        if (!pageMap.has(path)) pageMap.set(path, { pageviews: 0, visitors: new Set() });
        const entry = pageMap.get(path)!;
        entry.pageviews++;
        if (e.visitor_id) entry.visitors.add(e.visitor_id);
      });

      // Count leads by source path
      const leadsBySource = new Map<string, { leads: number; paid: number; revenue: number }>();
      (leads || []).forEach(lead => {
        const source = lead.source || lead.utm_source || "direct";
        if (!leadsBySource.has(source)) leadsBySource.set(source, { leads: 0, paid: 0, revenue: 0 });
        const entry = leadsBySource.get(source)!;
        entry.leads++;
        const rev = paidLeadMap.get(lead.id);
        if (rev) {
          entry.paid++;
          entry.revenue += rev;
        }
      });

      // Merge page data: combine analytics pages + lead sources
      const allPages = new Map<string, PageData>();

      // Add analytics pages
      pageMap.forEach((data, path) => {
        allPages.set(path, {
          pagePath: path,
          pageviews: data.pageviews,
          uniqueVisitors: data.visitors.size,
          leads: 0,
          paid: 0,
          revenue: 0,
          conversionRate: 0,
        });
      });

      // Merge lead sources into matching pages or create new entries
      leadsBySource.forEach((data, source) => {
        const matchingPath = Array.from(allPages.keys()).find(p =>
          p === source || p.includes(source) || source.includes(p)
        );
        if (matchingPath) {
          const page = allPages.get(matchingPath)!;
          page.leads += data.leads;
          page.paid += data.paid;
          page.revenue += data.revenue;
        } else {
          allPages.set(source, {
            pagePath: source,
            pageviews: 0,
            uniqueVisitors: 0,
            leads: data.leads,
            paid: data.paid,
            revenue: data.revenue,
            conversionRate: 0,
          });
        }
      });

      // Calculate conversion rates and sort
      const pageList = Array.from(allPages.values())
        .map(p => ({
          ...p,
          conversionRate: p.uniqueVisitors > 0 ? Math.round((p.leads / p.uniqueVisitors) * 100) : 0,
        }))
        .sort((a, b) => b.pageviews - a.pageviews || b.leads - a.leads)
        .slice(0, 30);

      const totals = {
        pageviews: pageList.reduce((s, p) => s + p.pageviews, 0),
        visitors: pageList.reduce((s, p) => s + p.uniqueVisitors, 0),
        leads: pageList.reduce((s, p) => s + p.leads, 0),
        paid: pageList.reduce((s, p) => s + p.paid, 0),
        revenue: pageList.reduce((s, p) => s + p.revenue, 0),
      };

      setPages(pageList);
      setTotalStats(totals);
    } catch (error) {
      console.error("Error fetching campaign data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Page Tracking</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Page Tracking</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <Globe className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-xs">No page tracking data available</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">All Pages & Links Tracking</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-muted-foreground">{totalStats.pageviews} views</span>
          <span className="text-muted-foreground">{totalStats.visitors} visitors</span>
          <span className="font-medium text-primary">{totalStats.leads} leads</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] sm:text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium text-muted-foreground">Page / Link</th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  <Eye className="w-3 h-3" /> Views
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  <Users className="w-3 h-3" /> Visitors
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">Leads</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Paid</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Revenue</th>
              <th className="text-right p-2 font-medium text-muted-foreground">Conv %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pages.map((page, index) => (
              <motion.tr
                key={page.pagePath}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="hover:bg-muted/30"
              >
                <td className="p-2">
                  <div className="flex items-center gap-1.5 max-w-[200px]">
                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium truncate text-primary" title={page.pagePath}>
                      {page.pagePath}
                    </span>
                  </div>
                </td>
                <td className="p-2 text-right font-medium">{page.pageviews}</td>
                <td className="p-2 text-right text-muted-foreground">{page.uniqueVisitors}</td>
                <td className="p-2 text-right">
                  {page.leads > 0 ? (
                    <span className="font-semibold text-blue-600">{page.leads}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  {page.paid > 0 ? (
                    <span className="font-semibold text-green-600">{page.paid}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  {page.revenue > 0 ? (
                    <span className="font-medium text-green-600">₹{page.revenue.toLocaleString("en-IN")}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  {page.conversionRate > 0 ? (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      page.conversionRate >= 30
                        ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                        : page.conversionRate >= 15
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400"
                        : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                    }`}>
                      {page.conversionRate}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/50 font-semibold text-[10px] sm:text-xs">
            <tr>
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{totalStats.pageviews}</td>
              <td className="p-2 text-right">{totalStats.visitors}</td>
              <td className="p-2 text-right text-blue-600">{totalStats.leads}</td>
              <td className="p-2 text-right text-green-600">{totalStats.paid}</td>
              <td className="p-2 text-right text-green-600">₹{totalStats.revenue.toLocaleString("en-IN")}</td>
              <td className="p-2 text-right">
                {totalStats.visitors > 0 ? `${Math.round((totalStats.leads / totalStats.visitors) * 100)}%` : "-"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </motion.div>
  );
};

export default UTMCampaignPerformance;
