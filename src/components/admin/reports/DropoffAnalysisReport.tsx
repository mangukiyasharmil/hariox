import { useEffect, useState } from "react";
import { TrendingDown, AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";

interface FunnelStage {
  step: number;
  label: string;
  count: number;
  dropoff: number;
  dropoffPercent: number;
}

interface DropoffAnalysisReportProps {
  dateFilter: string;
  dateEndFilter?: string;
}

const STAGE_CONFIG = [
  { key: "total", label: "Step 1 – Landing Page Visit", icon: "1" },
  { key: "form_complete", label: "Step 2 – Form Submitted (Lead Created)", icon: "2" },
  { key: "payment_page", label: "Step 3 – Payment Page Opened", icon: "3" },
  { key: "paid", label: "Step 4 – Payment Done", icon: "4" },
];

const STEP_COLORS = ["#8b5cf6", "#3b82f6", "#f59e0b", "#22c55e"];

// Domain pattern matching — shared across all analytics modules
const getCompanyDomainPattern = (company: { name?: string; slug?: string } | null): string | null => {
  if (!company) return null;
  const name = company.name?.toLowerCase() || '';
  const slug = company.slug?.toLowerCase() || '';
  if (name.includes('credit') || slug === 'hariox') return 'credit.hariox.com';
  if (name.includes('capital') || slug === 'capital') return 'capital.hariox.com';
  if (name.includes('finance') || slug === 'finance') return 'finance.hariox.com';
  return null;
};

const DropoffAnalysisReport = ({ dateFilter, dateEndFilter }: DropoffAnalysisReportProps) => {
  const { currentCompany, companyId, applyCompanyFilter, showAllCompanies } = useCompanyFilter();
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFunnelData();
  }, [dateFilter, dateEndFilter, companyId, showAllCompanies]);

  const fetchFunnelData = async () => {
    try {
      setIsLoading(true);
      const endDate = dateEndFilter || new Date().toISOString();

      // Step 1 & 3: Fetch ALL analytics events with upper-bound date filter
      const { data: events } = await supabase
        .from("analytics_events")
        .select("*")
        .gte("created_at", dateFilter)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true });

      // Apply domain filtering (same logic used in WebsiteAnalytics & Dashboard)
      let eventsData = events || [];
      if (!showAllCompanies && currentCompany) {
        const domainPattern = getCompanyDomainPattern(currentCompany);
        if (domainPattern) {
          eventsData = eventsData.filter(e => (e.page_url || '').includes(domainPattern));
        }
      }

      // Filter pageviews (excluding admin)
      const pageviewEvents = eventsData.filter(e => 
        e.event_type === "pageview" && !(e.page_path || "").startsWith("/admin")
      );
      // Match exact payment pages: /pay, /pay/*, /payment — exclude /payment-success
      const paymentPageEvents = pageviewEvents.filter(e => {
        const path = (e.page_path || "").toLowerCase();
        return (path.startsWith("/pay") || path.startsWith("/payment")) && !path.includes("success");
      });

      const pageViews = pageviewEvents.length;
      const paymentPages = paymentPageEvents.length;

      // Step 2: Leads created — use shared applyCompanyFilter (handles Hariox null logic)
      let leadsQuery = supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dateFilter)
        .lte("created_at", endDate);
      leadsQuery = applyCompanyFilter(leadsQuery);
      const { count: leadsCreated } = await leadsQuery;
      const leadsCount = leadsCreated || 0;

      // Step 4: Payments completed — use shared applyCompanyFilter
      let paymentsQuery = supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .in("status", ["completed", "captured"])
        .gte("created_at", dateFilter)
        .lte("created_at", endDate);
      paymentsQuery = applyCompanyFilter(paymentsQuery);
      const { count: paidCount } = await paymentsQuery;
      const paid = paidCount || 0;

      // All real data — no estimations
      const counts = [pageViews, leadsCount, paymentPages, paid];

      // Ensure monotonically decreasing
      for (let i = 1; i < counts.length; i++) {
        if (counts[i] > counts[i - 1]) counts[i] = counts[i - 1];
      }

      const funnelData: FunnelStage[] = STAGE_CONFIG.map((s, i) => {
        const prevCount = i > 0 ? counts[i - 1] : counts[0];
        const dropoff = prevCount - counts[i];
        const dropoffPercent = prevCount > 0 ? Math.round((dropoff / prevCount) * 100) : 0;
        return {
          step: i + 1,
          label: s.label,
          count: counts[i],
          dropoff: i > 0 ? dropoff : 0,
          dropoffPercent: i > 0 ? dropoffPercent : 0,
        };
      });

      setFunnel(funnelData);
    } catch (error) {
      console.error("Error fetching funnel data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold">Customer Drop-off Journey</h3>
        </div>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (funnel.length === 0 || funnel[0].count === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold">Customer Drop-off Journey</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <TrendingDown className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-xs">No funnel data available</p>
        </div>
      </div>
    );
  }

  const overallConversion = funnel[0].count > 0
    ? ((funnel[funnel.length - 1].count / funnel[0].count) * 100).toFixed(1)
    : "0";

  // Find biggest dropoff
  const significantDropoffs = funnel.slice(1).filter(s => s.dropoff > 0);
  const biggestDropoff = significantDropoffs.length > 0
    ? significantDropoffs.reduce((max, s) => s.dropoff > max.dropoff ? s : max)
    : null;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold">Customer Drop-off Journey</h3>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">End-to-end: </span>
          <span className={`font-bold ${Number(overallConversion) >= 2 ? "text-green-600" : "text-destructive"}`}>
            {overallConversion}%
          </span>
        </div>
      </div>

      {/* Alert */}
      {biggestDropoff && (
        <div className="flex items-center gap-2 p-2 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Biggest drop at <strong>{biggestDropoff.label}</strong> — lost {biggestDropoff.dropoff.toLocaleString("en-IN")} ({biggestDropoff.dropoffPercent}%)
          </p>
        </div>
      )}

      {/* Step-based funnel */}
      <div className="space-y-0">
        {funnel.map((stage, index) => (
          <div key={stage.step}>
            {/* Step row */}
            <div className="flex items-center gap-3 py-2">
              {/* Step circle */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: STEP_COLORS[index] }}
              >
                {stage.step}
              </div>
              {/* Bar */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{stage.label}</span>
                  <span className="text-sm font-bold">{stage.count.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${funnel[0].count > 0 ? Math.max(3, (stage.count / funnel[0].count) * 100) : 100}%`,
                      backgroundColor: STEP_COLORS[index],
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Drop-off between steps */}
            {index < funnel.length - 1 && funnel[index + 1].dropoff > 0 && (
              <div className="flex items-center ml-4 pl-7 py-0.5">
                <ChevronRight className="w-3 h-3 text-destructive rotate-90" />
                <span className={`text-[10px] ml-1 ${
                  biggestDropoff?.step === funnel[index + 1].step 
                    ? "text-destructive font-bold" 
                    : "text-muted-foreground"
                }`}>
                  -{funnel[index + 1].dropoff.toLocaleString("en-IN")} dropped ({funnel[index + 1].dropoffPercent}%)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DropoffAnalysisReport;
