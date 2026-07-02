import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { RefreshCw, Wallet, Megaphone, MapPin, BarChart3, MessageSquare, RotateCcw, CreditCard, TrendingUp, Clock, UserX, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { formatISTDate, startOfDayIST, endOfDayIST } from "@/lib/dateUtils";

// Lazy load ALL report sub-tabs
const FinancialReportTab = lazy(() => import("./reports/FinancialReportTab"));
const MarketingReport = lazy(() => import("./reports/MarketingReport"));

const CityAdPerformance = lazy(() => import("./reports/CityAdPerformance"));
const WebsiteAnalytics = lazy(() => import("./WebsiteAnalytics"));
const RemarketingReport = lazy(() => import("./reports/RemarketingReport"));
const ChatbotReport = lazy(() => import("./reports/ChatbotReport"));
const PaymentRecoveryReport = lazy(() => import("./reports/PaymentRecoveryReport"));
const RevenueForecastReport = lazy(() => import("./reports/RevenueForecastReport"));
const LeadSourceROIReport = lazy(() => import("./reports/LeadSourceROIReport"));
const PeakHourHeatmap = lazy(() => import("./reports/PeakHourHeatmap"));
const CityPnLReport = null; // removed — merged into CityAdPerformance
const ConversionSpeedReport = lazy(() => import("./reports/ConversionSpeedReport"));
const LostLeadAnalysis = lazy(() => import("./reports/LostLeadAnalysis"));
const LostLeadRecovery = lazy(() => import("./reports/LostLeadRecovery"));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
  </div>
);

const ReportsSection = () => {
  const { companyId, showAllCompanies } = useCompanyFilter();
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom">("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeTab, setActiveTab] = useState("financial");
  const [refreshKey, setRefreshKey] = useState(0);

  const dateBoundaries = useMemo(() => {
    const now = new Date();
    const todayIST = formatISTDate(now);
    const getISTDateNDaysAgo = (daysAgo: number): string => formatISTDate(new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000));
    
    let startDate: Date;
    let endDate: Date;
    
    if (dateRange === "today") {
      startDate = startOfDayIST(todayIST);
      endDate = endOfDayIST(todayIST);
    } else if (dateRange === "yesterday") {
      startDate = startOfDayIST(getISTDateNDaysAgo(1));
      endDate = endOfDayIST(getISTDateNDaysAgo(1));
    } else if (dateRange === "week") {
      startDate = startOfDayIST(getISTDateNDaysAgo(7));
      endDate = endOfDayIST(todayIST);
    } else if (dateRange === "month") {
      startDate = startOfDayIST(getISTDateNDaysAgo(30));
      endDate = endOfDayIST(todayIST);
    } else if (dateRange === "quarter") {
      startDate = startOfDayIST(getISTDateNDaysAgo(90));
      endDate = endOfDayIST(todayIST);
    } else if (dateRange === "year") {
      startDate = startOfDayIST(getISTDateNDaysAgo(365));
      endDate = endOfDayIST(todayIST);
    } else if (dateRange === "custom" && customStart) {
      startDate = startOfDayIST(customStart);
      endDate = customEnd ? endOfDayIST(customEnd) : endOfDayIST(todayIST);
    } else {
      startDate = startOfDayIST(getISTDateNDaysAgo(30));
      endDate = endOfDayIST(todayIST);
    }
    
    return { startDate, endDate };
  }, [dateRange, customStart, customEnd]);

  const getDateLabel = useCallback(() => {
    switch (dateRange) {
      case "today": return "Today";
      case "yesterday": return "Yesterday";
      case "week": return "Last 7 Days";
      case "month": return "Last 30 Days";
      case "quarter": return "Last 3 Months";
      case "year": return "Last 12 Months";
      case "custom": 
        return customStart && customEnd 
          ? `${new Date(customStart + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${new Date(customEnd + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
          : "Custom Period";
      default: return dateRange;
    }
  }, [dateRange, customStart, customEnd]);

  const startISO = dateBoundaries.startDate.toISOString();
  const endISO = dateBoundaries.endDate.toISOString();

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 bg-card rounded-xl p-3 sm:p-4 border border-border">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Reports & Analytics</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Business performance insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 sm:p-1 overflow-x-auto">
            {["today", "yesterday", "week", "month", "quarter", "custom"].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range as any)}
                className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
                  dateRange === range ? "bg-primary text-primary-foreground" : "hover:bg-background"
                }`}
              >
                {range === "quarter" ? "3M" : range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-1">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-28 sm:w-32 h-8 text-xs" />
              <span className="text-muted-foreground text-xs">to</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-28 sm:w-32 h-8 text-xs" />
            </div>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="bg-card border border-border inline-flex w-auto min-w-full">
            <TabsTrigger value="financial" className="text-[10px] sm:text-xs gap-1">
              <Wallet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Financial</span>
            </TabsTrigger>
            <TabsTrigger value="marketing" className="text-[10px] sm:text-xs gap-1">
              <Megaphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marketing</span>
            </TabsTrigger>
            <TabsTrigger value="city-ads" className="text-[10px] sm:text-xs gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">City</span>
            </TabsTrigger>
            <TabsTrigger value="remarketing" className="text-[10px] sm:text-xs gap-1">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Remarketing</span>
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="text-[10px] sm:text-xs gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chatbot</span>
            </TabsTrigger>
            <TabsTrigger value="recovery" className="text-[10px] sm:text-xs gap-1">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Recovery</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-[10px] sm:text-xs gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="forecast" className="text-[10px] sm:text-xs gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Forecast</span>
            </TabsTrigger>
            <TabsTrigger value="roi" className="text-[10px] sm:text-xs gap-1">
              <Flame className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ROI</span>
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="text-[10px] sm:text-xs gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Peak Hours</span>
            </TabsTrigger>
            <TabsTrigger value="speed" className="text-[10px] sm:text-xs gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Speed</span>
            </TabsTrigger>
            <TabsTrigger value="lost" className="text-[10px] sm:text-xs gap-1">
              <UserX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lost</span>
            </TabsTrigger>
            <TabsTrigger value="recover" className="text-[10px] sm:text-xs gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Recover</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="financial" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <FinancialReportTab key={refreshKey} startISO={startISO} endISO={endISO} dateLabel={getDateLabel()} />
          </Suspense>
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <MarketingReport key={refreshKey} dateFilter={startISO} dateEndFilter={endISO} dateLabel={getDateLabel()} />
          </Suspense>
        </TabsContent>


        <TabsContent value="city-ads" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <CityAdPerformance key={refreshKey} dateFilter={startISO} dateEndFilter={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="remarketing" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <RemarketingReport key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="chatbot" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <ChatbotReport key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="recovery" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <PaymentRecoveryReport key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <WebsiteAnalytics />
          </Suspense>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <RevenueForecastReport key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="roi" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <LeadSourceROIReport key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <PeakHourHeatmap key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="speed" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <ConversionSpeedReport key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="lost" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <LostLeadAnalysis key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>

        <TabsContent value="recover" className="mt-4">
          <Suspense fallback={<TabLoader />}>
            <LostLeadRecovery key={refreshKey} startISO={startISO} endISO={endISO} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsSection;
