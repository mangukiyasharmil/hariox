import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/database";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { formatISTDate, startOfDayIST, endOfDayIST, getISTDateNDaysAgo } from "@/lib/dateUtils";
import { CardSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeSync } from "@/hooks/useRealtimeLeads";

// React Query hooks
import {
  useAdminStats,
  usePaymentSources,
  useVisitorAnalytics,
  usePersonalStats,
} from "@/hooks/useDashboardData";

// Sub-components
import StaffDashboardView from "./dashboard/StaffDashboardView";
import AdminDashboardView from "./dashboard/AdminDashboardView";
import VerificationDashboardView from "./dashboard/VerificationDashboardView";
import LoginTeamDashboardView from "./dashboard/LoginTeamDashboardView";
import IncentiveTracker from "./dashboard/IncentiveTracker";

interface DashboardOverviewProps {
  userRoles: AppRole[];
  onNavigate?: (path: string, filter?: string) => void;
}

const DashboardOverview = ({ userRoles }: DashboardOverviewProps) => {
  const { companyId, applyCompanyFilter, currentCompany } = useCompanyFilter();
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "week" | "month">("today");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Realtime sync — dashboard auto-refreshes when leads/payments change
  useRealtimeSync();

  const isAdmin = userRoles.includes("admin");
  const isManager = userRoles.includes("manager");
  const isTelecaller = userRoles.includes("telecaller");
  const isVerification = userRoles.includes("verification");
  const isLoginTeam = userRoles.includes("login_team");
  const isFranchiseOwner = userRoles.includes("franchise_owner");
  const showAdminView = isAdmin || isManager || isFranchiseOwner;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
  }, []);

  // React Query hooks — auto-cache, dedup, and refresh
  const { data: stats, isLoading: isLoadingStats } = useAdminStats(dateRange);
  const { data: paymentData, isLoading: isLoadingSources } = usePaymentSources(dateRange);
  const { data: visitorStats } = useVisitorAnalytics(dateRange);
  const { data: personalStats } = usePersonalStats(dateRange, currentUserId, !showAdminView && isTelecaller);

  // Fetch verification & login team performance
  const { data: teamPerformanceData } = useQuery({
    queryKey: ["team-performance-dashboard", dateRange, companyId],
    enabled: showAdminView,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async () => {
      const { startISO, endISO } = (() => {
        const todayIST = formatISTDate(new Date());
        const rangeMap: Record<string, () => { s: string; e: string }> = {
          today: () => ({ s: todayIST, e: todayIST }),
          yesterday: () => { const d = getISTDateNDaysAgo(1); return { s: d, e: d }; },
          week: () => ({ s: getISTDateNDaysAgo(7), e: todayIST }),
          month: () => ({ s: getISTDateNDaysAgo(30), e: todayIST }),
        };
        const b = (rangeMap[dateRange] || rangeMap.today)();
        return { startISO: startOfDayIST(b.s).toISOString(), endISO: endOfDayIST(b.e).toISOString() };
      })();

      // Batch: fetch all roles + profiles in parallel
      const [{ data: verificationRoles }, { data: loginRoles }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "verification"),
        supabase.from("user_roles").select("user_id").eq("role", "login_team"),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      // Verification: batch fetch all leads assigned to verification users at once
      const verificationIds = (verificationRoles || []).map(r => r.user_id);
      let verificationPerformance: { name: string; paid: number; verified: number; rejected: number }[] = [];
      if (verificationIds.length > 0) {
        let leadsQuery = supabase.from("leads").select("id, status, assigned_to")
          .in("assigned_to", verificationIds)
          .in("status", ["paid", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed", "rejected"]);
        if (companyId) leadsQuery = leadsQuery.eq("company_id", companyId);
        const { data: allVerLeads } = await leadsQuery;

        // Batch fetch payments for all verification leads in date range
        const allVerLeadIds = (allVerLeads || []).map(l => l.id);
        const paidByUser = new Map<string, Set<string>>();
        if (allVerLeadIds.length > 0) {
          const { data: payments } = await supabase.from("payments")
            .select("lead_id").in("lead_id", allVerLeadIds)
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO);
          const paidLeadIds = new Set((payments || []).map(p => p.lead_id));
          // Map paid leads back to their assigned user
          (allVerLeads || []).forEach(l => {
            if (paidLeadIds.has(l.id) && l.assigned_to) {
              if (!paidByUser.has(l.assigned_to)) paidByUser.set(l.assigned_to, new Set());
              paidByUser.get(l.assigned_to)!.add(l.id);
            }
          });
        }

        verificationPerformance = verificationIds.map(userId => {
          const userLeads = (allVerLeads || []).filter(l => l.assigned_to === userId);
          return {
            name: profileMap.get(userId) || "Unknown",
            paid: paidByUser.get(userId)?.size || 0,
            verified: userLeads.filter(l => ["verified", "processing", "approved", "disbursed"].includes(l.status)).length,
            rejected: userLeads.filter(l => l.status === "rejected").length,
          };
        });
      }

      // Login team: batch fetch all leads at once
      const loginIds = (loginRoles || []).map(r => r.user_id);
      let loginTeamPerformance: { name: string; approved: number; processing: number; disbursed: number }[] = [];
      if (loginIds.length > 0) {
        let loginLeadsQuery = supabase.from("leads").select("status, assigned_to")
          .in("assigned_to", loginIds)
          .in("status", ["approved", "processing", "disbursed"])
          .gte("created_at", startISO).lte("created_at", endISO);
        if (companyId) loginLeadsQuery = loginLeadsQuery.eq("company_id", companyId);
        const { data: loginLeads } = await loginLeadsQuery;

        loginTeamPerformance = loginIds.map(userId => {
          const userLeads = (loginLeads || []).filter(l => l.assigned_to === userId);
          return {
            name: profileMap.get(userId) || "Unknown",
            approved: userLeads.filter(l => l.status === "approved").length,
            processing: userLeads.filter(l => l.status === "processing").length,
            disbursed: userLeads.filter(l => l.status === "disbursed").length,
          };
        });
      }

      return { verificationPerformance, loginTeamPerformance };
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });

  // Compute date bounds for child components
  const todayIST = formatISTDate(new Date());
  const getDateFilter = () => {
    if (dateRange === "today") return startOfDayIST(todayIST).toISOString();
    if (dateRange === "yesterday") return startOfDayIST(getISTDateNDaysAgo(1)).toISOString();
    if (dateRange === "week") return startOfDayIST(getISTDateNDaysAgo(7)).toISOString();
    return startOfDayIST(getISTDateNDaysAgo(30)).toISOString();
  };
  const getDateEndFilter = () => {
    if (dateRange === "yesterday") return endOfDayIST(getISTDateNDaysAgo(1)).toISOString();
    return endOfDayIST(todayIST).toISOString();
  };



  const isLoading = isLoadingStats && !stats;

  if (isLoading) {
    return (
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  const defaultStats = { totalLeads: 0, paidLeads: 0, totalRevenue: 0, totalExpenses: 0, verifiedLeads: 0, disbursedLeads: 0, lostLeads: 0, conversionRate: 0, gstPayable: 0, outputGST: 0, inputGST: 0 };
  const defaultVisitor = { visitors: 0, pageviews: 0, sessions: 0, mobilePercent: 0, desktopPercent: 0, bounceRate: 0, avgDuration: 0, leadsGenerated: 0, conversionRate: 0 };
  const defaultPersonal = { assignedLeads: 0, paidLeads: 0, conversionRate: 0, monthlyPaidLeads: 0, currentIncentiveRate: 0, nextMilestone: 150, leadsToNextMilestone: 150, earnedIncentive: 0, totalCalls: 0, connectedCalls: 0, busyCalls: 0, noAnswerCalls: 0, switchedOffCalls: 0, avgCallDuration: 0 };

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-bold">Dashboard</h1>
        <div className="flex items-center gap-1 bg-card rounded-lg p-0.5 sm:p-1 border border-border text-[10px] sm:text-xs">
          <Calendar className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-muted-foreground ml-1 sm:ml-2" />
          <select
            className="px-1 sm:px-2 py-0.5 sm:py-1 bg-transparent outline-none font-medium"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">7 Days</option>
            <option value="month">30 Days</option>
          </select>
        </div>
      </div>

      {/* Staff View - Telecaller */}
      {!showAdminView && isTelecaller && (
        <StaffDashboardView
          personalStats={personalStats || defaultPersonal}
          currentUserId={currentUserId}
          dateFilter={getDateFilter()}
          dateEndFilter={getDateEndFilter()}
        />
      )}

      {/* Staff View - Verification */}
      {!showAdminView && isVerification && (
        <VerificationDashboardView
          currentUserId={currentUserId}
          dateFilter={getDateFilter()}
          dateEndFilter={getDateEndFilter()}
        />
      )}

      {/* Staff View - Login Team */}
      {!showAdminView && isLoginTeam && (
        <LoginTeamDashboardView
          currentUserId={currentUserId}
          dateFilter={getDateFilter()}
          dateEndFilter={getDateEndFilter()}
        />
      )}

      {/* Admin View */}
      {showAdminView && (
        <>
          <AdminDashboardView
            stats={stats || defaultStats}
            paymentSources={paymentData?.sources || []}
            gateways={paymentData?.gateways || []}
            visitorStats={visitorStats || defaultVisitor}
            dateFilter={getDateFilter()}
            dateEndFilter={getDateEndFilter()}
            isLoadingSources={isLoadingSources}
            verificationPerformance={teamPerformanceData?.verificationPerformance || []}
            loginTeamPerformance={teamPerformanceData?.loginTeamPerformance || []}
          />
        </>
      )}

      {/* Telecaller Incentive Tracker */}
      {!showAdminView && isTelecaller && (
        <IncentiveTracker currentUserId={currentUserId} />
      )}
    </div>
  );
};

export default DashboardOverview;
