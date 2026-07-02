import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  Target, IndianRupee, TrendingUp, TrendingDown,
  Globe, Headphones, Mail, MessageCircle, CreditCard, ChevronDown, ChevronUp,
} from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { DashboardStats, PaymentSourceData, GatewayData, VisitorStats } from "@/hooks/useDashboardData";
import { Eye } from "lucide-react";

// Lazy load heavy chart components to prevent dashboard timeout
const UnifiedTelecallerReport = lazy(() => import("../reports/UnifiedTelecallerReport"));
const ChannelBreakdown = lazy(() => import("./ChannelBreakdown"));
const TimeToConversionCard = lazy(() => import("./TimeToConversionCard"));
const TimeWiseLeadsChart = lazy(() => import("../reports/TimeWiseLeadsChart"));
const StatusTrendChart = lazy(() => import("../reports/StatusTrendChart"));
const TeamPerformanceReport = lazy(() => import("../reports/TeamPerformanceReport"));
const UTMCampaignPerformance = lazy(() => import("./UTMCampaignPerformance"));
const DropoffAnalysisReport = lazy(() => import("../reports/DropoffAnalysisReport"));

const iconComponents: Record<string, typeof Globe> = {
  Globe, Headphones, Mail, MessageCircle, CreditCard,
};

const ChartLoader = () => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
  </div>
);

interface AdminDashboardViewProps {
  stats: DashboardStats;
  paymentSources: PaymentSourceData[];
  gateways: GatewayData[];
  visitorStats: VisitorStats;
  dateFilter: string;
  dateEndFilter: string;
  isLoadingSources: boolean;
  verificationPerformance?: { name: string; paid: number; verified: number; rejected: number }[];
  loginTeamPerformance?: { name: string; approved: number; processing: number; disbursed: number }[];
}

const AdminDashboardView = ({
  stats, paymentSources, gateways, visitorStats,
  dateFilter, dateEndFilter, isLoadingSources,
  verificationPerformance = [], loginTeamPerformance = [],
}: AdminDashboardViewProps) => {
  const navigate = useNavigate();
  const netProfit = stats.totalRevenue - stats.totalExpenses - stats.gstPayable;
  const totalPayments = paymentSources.reduce((sum, p) => sum + p.count, 0);
  const totalPaymentAmount = paymentSources.reduce((sum, p) => sum + p.amount, 0);

  const [trendStart, setTrendStart] = useState(() => {
    const now = new Date();
    const startD = new Date(now);
    startD.setDate(startD.getDate() - 7);
    return startD.toISOString();
  });
  const [trendEnd, setTrendEnd] = useState(() => new Date().toISOString());
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

  return (
    <div className="space-y-2">
      {/* Row 1: Lead Funnel */}
      <ErrorBoundary fallbackTitle="Lead Funnel failed to load">
        <div className="bg-card rounded-lg sm:rounded-xl border border-border p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs sm:text-sm font-semibold">Lead Funnel</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{stats.conversionRate}% overall</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {[
              { value: stats.totalLeads, label: "Total", textColor: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200 dark:border-blue-800", pct: null },
              { value: stats.paidLeads, label: "Paid", textColor: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30", borderColor: "border-green-200 dark:border-green-800", pct: stats.conversionRate },
              { value: stats.verifiedLeads, label: "Verified", textColor: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30", borderColor: "border-purple-200 dark:border-purple-800", pct: stats.paidLeads > 0 ? Math.round((stats.verifiedLeads / stats.paidLeads) * 100) : 0 },
              { value: stats.disbursedLeads, label: "Disbursed", textColor: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/30", borderColor: "border-teal-200 dark:border-teal-800", pct: stats.verifiedLeads > 0 ? Math.round((stats.disbursedLeads / stats.verifiedLeads) * 100) : 0 },
              { value: stats.lostLeads, label: "Lost", textColor: "text-red-500", bgColor: "bg-red-50 dark:bg-red-950/30", borderColor: "border-red-200 dark:border-red-800", pct: stats.totalLeads > 0 ? Math.round((stats.lostLeads / stats.totalLeads) * 100) : 0 },
            ].map((stage) => (
              <div key={stage.label} className={`${stage.bgColor} rounded-lg border ${stage.borderColor} p-2 sm:p-3 text-center`}>
                <p className={`text-base sm:text-xl font-bold ${stage.textColor}`}>{stage.value}</p>
                <p className="text-[8px] sm:text-[10px] text-muted-foreground font-medium mt-0.5">{stage.label}</p>
                {stage.pct !== null && <p className={`text-[7px] sm:text-[9px] font-medium ${stage.textColor}`}>{stage.pct}%</p>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-3 pt-2 border-t border-border">
            {[
              { value: `${stats.conversionRate}%`, label: "Lead→Paid", color: "text-primary" },
              { value: `₹${(stats.totalLeads > 0 ? Math.round(stats.totalRevenue / stats.totalLeads) : 0).toLocaleString("en-IN")}`, label: "Rev/Lead", color: "text-green-600" },
              { value: `₹${(stats.totalLeads > 0 ? Math.round(stats.totalExpenses / stats.totalLeads) : 0).toLocaleString("en-IN")}`, label: "Exp/Lead", color: "text-orange-600" },
              { value: `₹${(stats.paidLeads > 0 ? Math.round(stats.totalExpenses / stats.paidLeads) : 0).toLocaleString("en-IN")}`, label: "Exp/Paid", color: "text-red-600" },
              { value: `₹${(stats.paidLeads > 0 ? Math.round((stats.totalRevenue - stats.totalExpenses) / stats.paidLeads) : 0).toLocaleString("en-IN")}`, label: "Profit/Paid", color: stats.paidLeads > 0 && (stats.totalRevenue - stats.totalExpenses) >= 0 ? "text-emerald-600" : "text-rose-600" },
            ].map(m => (
              <div key={m.label} className="text-center p-1.5 rounded-lg bg-muted/30">
                <p className={`text-[10px] sm:text-xs font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[7px] sm:text-[9px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </ErrorBoundary>

      {/* Row 2: Finance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg p-2 sm:p-2.5 border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20">
          <div className="flex items-center gap-1 mb-0.5"><IndianRupee className="w-3 h-3 text-green-600" /><span className="text-[9px] sm:text-[10px] font-medium text-green-700 dark:text-green-300">Revenue</span></div>
          <p className="text-sm sm:text-lg font-bold text-green-700 dark:text-green-400">₹{stats.totalRevenue.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg p-2 sm:p-2.5 border border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20">
          <div className="flex items-center gap-1 mb-0.5"><TrendingDown className="w-3 h-3 text-red-600" /><span className="text-[9px] sm:text-[10px] font-medium text-red-700 dark:text-red-300">Expenses</span></div>
          <p className="text-sm sm:text-lg font-bold text-red-700 dark:text-red-400">₹{stats.totalExpenses.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-lg p-2 sm:p-2.5 border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20">
          <div className="flex items-center gap-1 mb-1">
            <IndianRupee className="w-3 h-3 text-amber-600" />
            <span className="text-[9px] sm:text-[10px] font-medium text-amber-700 dark:text-amber-300">GST</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] sm:text-[10px]">
              <span className="text-amber-600 dark:text-amber-400">Output</span>
              <span className="font-medium text-amber-700 dark:text-amber-300">₹{Math.round(stats.outputGST).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-[9px] sm:text-[10px]">
              <span className="text-green-600 dark:text-green-400">Input</span>
              <span className="font-medium text-green-700 dark:text-green-300">₹{Math.round(stats.inputGST).toLocaleString("en-IN")}</span>
            </div>
            <div className="border-t border-amber-300 dark:border-amber-700 pt-0.5 flex justify-between text-[10px] sm:text-xs font-bold">
              <span className={stats.gstPayable >= 0 ? "text-amber-800 dark:text-amber-300" : "text-green-700 dark:text-green-400"}>
                {stats.gstPayable >= 0 ? "Payable" : "ITC Credit"}
              </span>
              <span className={stats.gstPayable >= 0 ? "text-amber-800 dark:text-amber-300" : "text-green-700 dark:text-green-400"}>
                ₹{Math.round(Math.abs(stats.gstPayable)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
        <div className={`rounded-lg p-2 sm:p-2.5 border ${netProfit >= 0 ? "border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20" : "border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-rose-900/20"}`}>
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className={`w-3 h-3 ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
            <span className={`text-[9px] sm:text-[10px] font-medium ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>Net Profit</span>
            {stats.totalRevenue > 0 && (
              <span className={`ml-auto text-[8px] px-1 py-0.5 rounded-full font-medium ${netProfit >= 0 ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200" : "bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-200"}`}>
                {Math.round((netProfit / stats.totalRevenue) * 100)}%
              </span>
            )}
          </div>
          <p className={`text-sm sm:text-lg font-bold ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {netProfit < 0 && "-"}₹{Math.abs(Math.round(netProfit)).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Row 3: Payment Sources + Website Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <ErrorBoundary fallbackTitle="Payment Sources failed">
          {isLoadingSources ? (
            <CardSkeleton />
          ) : (
            <div
              className="bg-card rounded-lg sm:rounded-xl border border-border p-3 sm:p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              onClick={() => navigate("/admin/dashboard/payments")}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-semibold">Payment Sources</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{totalPayments} • ₹{(totalPaymentAmount / 1000).toFixed(1)}k</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {paymentSources.map((p) => {
                  const IconComp = iconComponents[p.iconName] || Globe;
                  return (
                    <div key={p.source} className="text-center p-2 rounded-lg bg-muted/30 relative overflow-hidden">
                      <IconComp className={`w-4 h-4 mx-auto mb-1 ${p.color.split(' ')[1]}`} />
                      <p className="text-xs sm:text-sm font-bold">₹{(p.amount / 1000).toFixed(1)}k</p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{p.source} ({p.count})</p>
                    </div>
                  );
                })}
              </div>
              {gateways.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <span className="text-[10px] sm:text-xs text-muted-foreground mb-1 block">By Gateway</span>
                  <div className="flex flex-wrap gap-1.5">
                    {gateways.map((g) => (
                      <div key={g.gateway} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${g.color}`}>
                        <span>{g.icon}</span>
                        <span>{g.gateway}</span>
                        <span className="opacity-75">({g.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Visitor analytics failed">
          <div className="bg-card rounded-lg sm:rounded-xl border border-border p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold">Website Analytics</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: visitorStats.visitors, label: "Visitors", color: "text-blue-600" },
                { value: visitorStats.pageviews, label: "Views", color: "text-purple-600" },
                { value: `${visitorStats.conversionRate}%`, label: "Conv", color: "text-green-600" },
                { value: `${visitorStats.mobilePercent}%`, label: "Mobile", color: "text-orange-600" },
                { value: `${visitorStats.bounceRate}%`, label: "Bounce", color: "text-red-600" },
                { value: visitorStats.leadsGenerated, label: "Leads", color: "text-teal-600" },
              ].map(s => (
                <div key={s.label} className="text-center p-2.5 rounded-lg bg-muted/30">
                  <p className={`text-sm sm:text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </ErrorBoundary>
      </div>

      {/* Advanced analytics - lazy mounted on demand to keep initial dashboard fast */}
      <div className="bg-card rounded-lg sm:rounded-xl border border-border p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setShowAdvancedAnalytics((prev) => !prev)}
          className="w-full flex items-center justify-between text-left"
        >
          <div>
            <p className="text-xs sm:text-sm font-semibold">Advanced Analytics</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Loads heavy reports only when needed</p>
          </div>
          {showAdvancedAnalytics ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>

      {showAdvancedAnalytics && (
        <>
          <Suspense fallback={<ChartLoader />}>
            <ErrorBoundary fallbackTitle="Telecaller Report failed">
              <UnifiedTelecallerReport startDate={new Date(dateFilter)} endDate={new Date(dateEndFilter)} />
            </ErrorBoundary>
          </Suspense>

          <Suspense fallback={<ChartLoader />}>
            <ErrorBoundary fallbackTitle="Hourly leads chart failed">
              <TimeWiseLeadsChart dateFilter={dateFilter} dateEndFilter={dateEndFilter} />
            </ErrorBoundary>
          </Suspense>

          <Suspense fallback={<ChartLoader />}>
            <ErrorBoundary fallbackTitle="Status trend failed">
              <StatusTrendChart
                dateFilter={dateFilter}
                dateEndFilter={dateEndFilter}
                onLocalDateChange={(start, end) => { setTrendStart(start); setTrendEnd(end); }}
              />
            </ErrorBoundary>
          </Suspense>

          <Suspense fallback={<ChartLoader />}>
            <ErrorBoundary fallbackTitle="Channel breakdown failed">
              <ChannelBreakdown dateFilter={dateFilter} dateEndFilter={dateEndFilter} />
            </ErrorBoundary>
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <Suspense fallback={<ChartLoader />}>
              <ErrorBoundary fallbackTitle="Pages tracking failed">
                <UTMCampaignPerformance dateFilter={dateFilter} dateEndFilter={dateEndFilter} />
              </ErrorBoundary>
            </Suspense>
            <Suspense fallback={<ChartLoader />}>
              <ErrorBoundary fallbackTitle="Drop-off analysis failed">
                <DropoffAnalysisReport dateFilter={dateFilter} dateEndFilter={dateEndFilter} />
              </ErrorBoundary>
            </Suspense>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <Suspense fallback={<ChartLoader />}>
              <ErrorBoundary fallbackTitle="Conversion card failed">
                <TimeToConversionCard dateFilter={dateFilter} dateEndFilter={dateEndFilter} />
              </ErrorBoundary>
            </Suspense>
            <Suspense fallback={<ChartLoader />}>
              <ErrorBoundary fallbackTitle="Team Performance failed">
                <TeamPerformanceReport
                  verificationPerformance={verificationPerformance}
                  loginTeamPerformance={loginTeamPerformance}
                  startDate={new Date(dateFilter)}
                  endDate={new Date(dateEndFilter)}
                />
              </ErrorBoundary>
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboardView;
