import { useEffect, useMemo, useState } from "react";
import { Phone, Gift, Target, Trophy, TrendingUp, Users, Clock, ArrowUp, XCircle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface TelecallerRow {
  userId: string;
  name: string;
  totalLeads: number;
  assignedLeads: number;
  todayTotal: number;
  todayLost: number;
  todayActive: number;
  conversions: number;
  conversionRate: number;
  lostLeads: number;
  totalCalls: number;
  connected: number;
  busy: number;
  noAnswer: number;
  switchedOff: number;
  avgDuration: number;
  totalDuration: number;
  monthlyPaidLeads: number;
  currentRate: number;
  earnedIncentive: number;
  nextMilestone: number;
  leadsToNextMilestone: number;
}

const INCENTIVE_TIERS = [
  { minPaid: 150, rate: 7 },
  { minPaid: 250, rate: 15 },
  { minPaid: 500, rate: 20 },
  { minPaid: 750, rate: 25 },
  { minPaid: 1000, rate: 30 },
];

const getIncentiveInfo = (paidLeads: number) => {
  let currentRate = 0;
  let nextMilestone = 150;

  for (const tier of INCENTIVE_TIERS) {
    if (paidLeads >= tier.minPaid) currentRate = tier.rate;
    else {
      nextMilestone = tier.minPaid;
      break;
    }
  }

  if (paidLeads >= 1000) nextMilestone = 0;

  const leadsToNextMilestone = nextMilestone > 0 ? Math.max(0, nextMilestone - paidLeads) : 0;
  const earnedIncentive = paidLeads >= 150 ? paidLeads * currentRate : 0;

  return { currentRate, nextMilestone, leadsToNextMilestone, earnedIncentive };
};

const formatMoney = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
const formatDuration = (seconds: number) => {
  if (seconds <= 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

interface UnifiedTelecallerReportProps {
  startDate: Date;
  endDate: Date;
}

const UnifiedTelecallerReport = ({ startDate, endDate }: UnifiedTelecallerReportProps) => {
  const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
  const [rows, setRows] = useState<TelecallerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const todayStartIso = useMemo(() => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const istMidnight = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate());
    return new Date(istMidnight - IST_OFFSET_MS).toISOString();
  }, []);

  const monthStartIso = useMemo(() => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const istMidnight = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1);
    return new Date(istMidnight - IST_OFFSET_MS).toISOString();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const companyId = getCompanyFilter();
      const isHariox = currentCompany?.slug === "hariox";

      const applyCompanyFilter = (query: any) => {
        if (!companyId) return query;
        return isHariox
          ? query.or(`company_id.eq.${companyId},company_id.is.null`)
          : query.eq("company_id", companyId);
      };

      const [staffRolesRes, profilesRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("user_id, full_name"),
      ]);

      const telecallerIds = (staffRolesRes.data || [])
        .filter((r) => r.role === "telecaller")
        .map((r) => r.user_id);
      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.full_name]));

      if (telecallerIds.length === 0) {
        setRows([]);
        setIsLoading(false);
        return;
      }

      // Fetch non-lost leads currently assigned to telecallers (for "All Leads" count)
      // Excluding lost avoids hitting 1000-row Supabase cap (thousands of lost leads exist)
      let allLeadsQuery = supabase
        .from("leads")
        .select("id, assigned_to, status")
        .in("assigned_to", telecallerIds)
        .neq("status", "lost")
        .limit(5000);
      allLeadsQuery = applyCompanyFilter(allLeadsQuery);

      let leadsQuery = supabase
        .from("leads")
        .select("id, assigned_to, status, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .limit(10000);
      leadsQuery = applyCompanyFilter(leadsQuery);

      const todayAssignmentQuery = supabase
        .from("lead_assignment_history")
        .select("lead_id, assigned_to")
        .gte("created_at", todayStartIso)
        .in("assigned_to", telecallerIds);

      let todayLeadsQuery = supabase
        .from("leads")
        .select("id, assigned_to, status")
        .gte("created_at", todayStartIso)
        .limit(10000);
      todayLeadsQuery = applyCompanyFilter(todayLeadsQuery);

      // Only count telecaller-source payments for attribution
      let paymentsQuery = supabase
        .from("payments")
        .select("lead_id, created_at, collected_by")
        .in("status", ["completed", "captured"])
        .eq("payment_source", "telecaller")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .limit(10000);
      paymentsQuery = applyCompanyFilter(paymentsQuery);

      let callLogsQuery = supabase
        .from("call_logs")
        .select("caller_id, outcome, call_duration")
        .in("caller_id", telecallerIds)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .limit(10000);
      callLogsQuery = applyCompanyFilter(callLogsQuery);

      // MTD payments - only telecaller source
      let mtdPaymentsQuery = supabase
        .from("payments")
        .select("lead_id, created_at, collected_by")
        .in("status", ["completed", "captured"])
        .eq("payment_source", "telecaller")
        .gte("created_at", monthStartIso)
        .limit(10000);
      mtdPaymentsQuery = applyCompanyFilter(mtdPaymentsQuery);

      // Assignment history - fetch ALL for telecallers
      const assignmentHistoryQuery = supabase
        .from("lead_assignment_history")
        .select("lead_id, assigned_to, created_at")
        .in("assigned_to", telecallerIds)
        .order("created_at", { ascending: false })
        .limit(50000);

      const [allLeadsRes, leadsRes, todayAssignmentRes, todayLeadsRes, paymentsRes, callLogsRes, mtdPaymentsRes, assignmentHistoryRes] = await Promise.all([
        allLeadsQuery,
        leadsQuery,
        todayAssignmentQuery,
        todayLeadsQuery,
        paymentsQuery,
        callLogsQuery,
        mtdPaymentsQuery,
        assignmentHistoryQuery,
      ]);

      const allLeads = allLeadsRes.data || [];
      const leads = leadsRes.data || [];
      // Today assignments - filter by checking if lead's current assignment is to a telecaller in our company scope
      const todayAssignments = todayAssignmentRes.data || [];
      const todayLeads = todayLeadsRes.data || [];
      const payments = paymentsRes.data || [];
      const callLogs = callLogsRes.data || [];
      const mtdPayments = mtdPaymentsRes.data || [];
      // Assignment history - no need to filter by allLeadIdSet since payments query already handles company scoping
      const assignmentHistory = assignmentHistoryRes.data || [];

      // Helper: Get last telecaller assigned before or at payment time
      const getLastTelecaller = (leadId: string, paymentDate: string, collectedBy: string | null) => {
        // Find the most recent assignment for this lead before or at payment time
        const history = assignmentHistory.filter(
          (ah) => ah.lead_id === leadId && ah.created_at <= paymentDate
        );
        // Already sorted desc, so first match is the latest
        if (history.length > 0) return history[0].assigned_to;
        
        // Fallback: any assignment for this lead (even after payment - assignment might have been recorded slightly after)
        const anyHistory = assignmentHistory.filter((ah) => ah.lead_id === leadId);
        if (anyHistory.length > 0) return anyHistory[0].assigned_to;
        
        // Fallback to collected_by
        if (collectedBy && telecallerIds.includes(collectedBy)) return collectedBy;
        
        // Last fallback: check current lead assignment
        const lead = allLeads.find(l => l.id === leadId);
        if (lead?.assigned_to && telecallerIds.includes(lead.assigned_to)) return lead.assigned_to;
        
        return null;
      };

      // Count date-range conversions
      const rangeConversions = new Map<string, Set<string>>();
      payments.forEach((p) => {
        const tc = getLastTelecaller(p.lead_id, p.created_at, p.collected_by);
        if (tc) {
          if (!rangeConversions.has(tc)) rangeConversions.set(tc, new Set());
          rangeConversions.get(tc)!.add(p.lead_id);
        }
      });

      // Count MTD conversions - deduplicate by lead_id
      const mtdConversions = new Map<string, Set<string>>();
      mtdPayments.forEach((p) => {
        const tc = getLastTelecaller(p.lead_id, p.created_at, p.collected_by);
        if (tc) {
          if (!mtdConversions.has(tc)) mtdConversions.set(tc, new Set());
          mtdConversions.get(tc)!.add(p.lead_id);
        }
      });

      // Build rows
      const newRows: TelecallerRow[] = telecallerIds.map((userId) => {
        // All Leads = non-lost leads currently assigned to this telecaller
        // allLeads query already excludes lost status
        const totalLeads = allLeads.filter(l => l.assigned_to === userId).length;

        const assignedLeads = leads.filter((l) => l.assigned_to === userId && l.status !== "lost").length;

        const todayAssignedFromHistoryIds = todayAssignments
          .filter((a) => a.assigned_to === userId)
          .map(a => a.lead_id);
        const todayCreatedLeadIds = todayLeads
          .filter((l) => l.assigned_to === userId)
          .map(l => l.id);
        const allTodayLeadIds = [...new Set([...todayAssignedFromHistoryIds, ...todayCreatedLeadIds])];
        const todayTotal = allTodayLeadIds.length;

        const todayLost = allTodayLeadIds.filter(leadId => {
          const lead = todayLeads.find(l => l.id === leadId);
          return lead?.status === 'lost';
        }).length;

        const todayActive = todayTotal - todayLost;

        const lostLeads = leads.filter((l) => l.assigned_to === userId && l.status === "lost").length;
        const conversions = rangeConversions.get(userId)?.size || 0;
        const conversionRate = assignedLeads > 0 ? Math.round((conversions / assignedLeads) * 100) : 0;

        // Calls - include both "connected" and legacy "contacted"
        const tcCalls = callLogs.filter((c) => c.caller_id === userId);
        const connectedCalls = tcCalls.filter((c) => c.outcome === "connected" || c.outcome === "contacted");
        const totalDuration = connectedCalls.reduce((sum, c) => sum + (c.call_duration || 0), 0);

        // Incentives (MTD)
        const monthlyPaidLeads = mtdConversions.get(userId)?.size || 0;
        const incentiveInfo = getIncentiveInfo(monthlyPaidLeads);

        return {
          userId,
          name: profileMap.get(userId) || "Unknown",
          totalLeads,
          assignedLeads,
          todayTotal,
          todayLost,
          todayActive,
          conversions,
          conversionRate,
          lostLeads,
          totalCalls: tcCalls.length,
          connected: connectedCalls.length,
          busy: tcCalls.filter((c) => c.outcome === "busy").length,
          noAnswer: tcCalls.filter((c) => c.outcome === "no_answer").length,
          switchedOff: tcCalls.filter((c) => c.outcome === "switched_off").length,
          avgDuration: connectedCalls.length > 0 ? Math.round(totalDuration / connectedCalls.length) : 0,
          totalDuration,
          monthlyPaidLeads,
          currentRate: incentiveInfo.currentRate,
          earnedIncentive: incentiveInfo.earnedIncentive,
          nextMilestone: incentiveInfo.nextMilestone,
          leadsToNextMilestone: incentiveInfo.leadsToNextMilestone,
        };
      }).sort((a, b) => b.conversions - a.conversions || b.monthlyPaidLeads - a.monthlyPaidLeads);

      setRows(newRows);
    } catch (e) {
      console.error("Unified telecaller report error:", e);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [currentCompany?.slug, showAllCompanies, getCompanyFilter, startDate, endDate, monthStartIso, todayStartIso]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      totalLeads: acc.totalLeads + r.totalLeads,
      assignedLeads: acc.assignedLeads + r.assignedLeads,
      todayTotal: acc.todayTotal + r.todayTotal,
      todayLost: acc.todayLost + r.todayLost,
      todayActive: acc.todayActive + r.todayActive,
      conversions: acc.conversions + r.conversions,
      lostLeads: acc.lostLeads + r.lostLeads,
      totalCalls: acc.totalCalls + r.totalCalls,
      connected: acc.connected + r.connected,
      totalDuration: acc.totalDuration + r.totalDuration,
      monthlyPaidLeads: acc.monthlyPaidLeads + r.monthlyPaidLeads,
      earnedIncentive: acc.earnedIncentive + r.earnedIncentive,
    }), {
      totalLeads: 0, assignedLeads: 0, todayTotal: 0, todayLost: 0, todayActive: 0,
      conversions: 0, lostLeads: 0, totalCalls: 0, connected: 0, totalDuration: 0,
      monthlyPaidLeads: 0, earnedIncentive: 0,
    });
  }, [rows]);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Telecaller Performance</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Today: {totals.todayTotal} ({totals.todayActive} active)
            </span>
            <span className="flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" />
              Ince.: MTD
            </span>
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <strong>Incentive Tiers:</strong> 150+ → ₹7 | 250+ → ₹15 | 500+ → ₹20 | 750+ → ₹25 | 1000+ → ₹30 per lead
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground w-10 sticky left-0 bg-muted/50 z-10 border-r border-border">#</th>
                <th className="text-left p-3 font-medium text-muted-foreground sticky left-10 bg-muted/50 z-10 border-r border-border min-w-[100px]">Name</th>
                {/* Performance */}
                <th className="text-right p-3 font-medium text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 border-l border-border">
                  <div className="flex flex-col items-end"><span>Today</span><span className="text-[10px] opacity-60">Total</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-red-50/50 dark:bg-red-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>Today</span><span className="text-[10px] opacity-60">Lost</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>Today</span><span className="text-[10px] opacity-60">Active</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>All</span><span className="text-[10px] opacity-60">Leads</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-green-50/50 dark:bg-green-950/20 border-l border-border">
                  <div className="flex flex-col items-end"><span>Conv.</span><span className="text-[10px] opacity-60">Range</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-green-50/50 dark:bg-green-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>Rate</span><span className="text-[10px] opacity-60">%</span></div>
                </th>
                {/* Calls */}
                <th className="text-right p-3 font-medium text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border-l border-border">
                  <div className="flex flex-col items-end"><span>Calls</span><span className="text-[10px] opacity-60">Total</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>Done</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>Busy</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>No Ans</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>S.Off</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border-l border-border/50">
                  <div className="flex items-center justify-end gap-1"><Clock className="w-3 h-3" /><span>Avg</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-amber-50/50 dark:bg-amber-950/20 border-l border-border/50">
                  <div className="flex items-center justify-end gap-1"><Clock className="w-3 h-3" /><span>Total</span></div>
                </th>
                {/* Incentive */}
                <th className="text-right p-3 font-medium text-muted-foreground bg-green-50/50 dark:bg-green-950/20 border-l border-border">
                  <div className="flex flex-col items-end"><span>Paid</span><span className="text-[10px] opacity-60">MTD</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-green-50/50 dark:bg-green-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>Rate</span><span className="text-[10px] opacity-60">₹/lead</span></div>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground bg-green-50/50 dark:bg-green-950/20 border-l border-border/50">
                  <div className="flex flex-col items-end"><span>Ince.</span><span className="text-[10px] opacity-60">MTD</span></div>
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground bg-green-50/50 dark:bg-green-950/20 border-l border-border/50">
                  <div className="flex flex-col"><span>Next</span><span className="text-[10px] opacity-60">Milestone</span></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, index) => (
                <tr key={r.userId} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 sticky left-0 bg-card z-10 border-r border-border">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? "bg-yellow-100 text-yellow-800" :
                      index === 1 ? "bg-gray-100 text-gray-800" :
                      index === 2 ? "bg-orange-100 text-orange-800" : "bg-muted text-muted-foreground"
                    }`}>
                      {index === 0 ? <Trophy className="w-3 h-3" /> : index + 1}
                    </span>
                  </td>
                  <td className="p-3 font-medium sticky left-10 bg-card z-10 border-r border-border">{r.name}</td>
                  {/* Performance */}
                  <td className="p-3 text-right font-semibold bg-blue-50/30 dark:bg-blue-950/10 border-l border-border">{r.todayTotal}</td>
                  <td className="p-3 text-right bg-red-50/30 dark:bg-red-950/10 border-l border-border/50">
                    {r.todayLost > 0 ? <span className="text-destructive font-medium">-{r.todayLost}</span> : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="p-3 text-right font-semibold text-primary bg-blue-50/30 dark:bg-blue-950/10 border-l border-border/50">{r.todayActive}</td>
                  <td className="p-3 text-right text-muted-foreground bg-blue-50/30 dark:bg-blue-950/10 border-l border-border/50">{r.totalLeads}</td>
                  <td className="p-3 text-right font-semibold text-green-600 bg-green-50/30 dark:bg-green-950/10 border-l border-border">{r.conversions}</td>
                  <td className="p-3 text-right bg-green-50/30 dark:bg-green-950/10 border-l border-border/50">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.conversionRate >= 50 ? "bg-green-100 text-green-800" :
                      r.conversionRate >= 25 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                    }`}>{r.conversionRate}%</span>
                  </td>
                  {/* Calls */}
                  <td className="p-3 text-right font-medium bg-amber-50/30 dark:bg-amber-950/10 border-l border-border">{r.totalCalls}</td>
                  <td className="p-3 text-right text-green-600 font-medium bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{r.connected}</td>
                  <td className="p-3 text-right text-orange-600 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{r.busy}</td>
                  <td className="p-3 text-right text-yellow-600 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{r.noAnswer}</td>
                  <td className="p-3 text-right text-red-600 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{r.switchedOff}</td>
                  <td className="p-3 text-right text-muted-foreground bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{formatDuration(r.avgDuration)}</td>
                  <td className="p-3 text-right text-muted-foreground bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{formatDuration(r.totalDuration)}</td>
                  {/* Incentives */}
                  <td className="p-3 text-right font-medium bg-green-50/30 dark:bg-green-950/10 border-l border-border">{r.monthlyPaidLeads}</td>
                  <td className="p-3 text-right bg-green-50/30 dark:bg-green-950/10 border-l border-border/50">
                    {r.currentRate > 0 ? formatMoney(r.currentRate) : "-"}
                  </td>
                  <td className="p-3 text-right font-semibold bg-green-50/30 dark:bg-green-950/10 border-l border-border/50">
                    {r.earnedIncentive > 0 ? <span className="text-green-600">{formatMoney(r.earnedIncentive)}</span> : "-"}
                  </td>
                  <td className="p-3 bg-green-50/30 dark:bg-green-950/10 border-l border-border/50">
                    {r.nextMilestone === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Target className="w-3.5 h-3.5" />Max
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[60px]">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round((r.monthlyPaidLeads / (r.nextMilestone || 1)) * 100))}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-0.5">
                          <ArrowUp className="w-3 h-3" />{r.leadsToNextMilestone}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={19} className="p-8 text-center text-muted-foreground">No telecaller data available</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-muted/70 font-semibold">
                <tr>
                  <td className="p-3 sticky left-0 bg-muted/70 z-10 border-r border-border" colSpan={1}></td>
                  <td className="p-3 sticky left-10 bg-muted/70 z-10 border-r border-border">Total</td>
                  <td className="p-3 text-right bg-blue-50/30 dark:bg-blue-950/10 border-l border-border">{totals.todayTotal}</td>
                  <td className="p-3 text-right text-destructive bg-red-50/30 dark:bg-red-950/10 border-l border-border/50">-{totals.todayLost}</td>
                  <td className="p-3 text-right text-primary bg-blue-50/30 dark:bg-blue-950/10 border-l border-border/50">{totals.todayActive}</td>
                  <td className="p-3 text-right text-muted-foreground bg-blue-50/30 dark:bg-blue-950/10 border-l border-border/50">{totals.totalLeads}</td>
                  <td className="p-3 text-right text-green-600 bg-green-50/30 dark:bg-green-950/10 border-l border-border">{totals.conversions}</td>
                  <td className="p-3 text-right bg-green-50/30 dark:bg-green-950/10 border-l border-border/50">
                    <span className="text-xs text-muted-foreground">
                      {totals.assignedLeads > 0 ? Math.round((totals.conversions / totals.assignedLeads) * 100) : 0}%
                    </span>
                  </td>
                  <td className="p-3 text-right bg-amber-50/30 dark:bg-amber-950/10 border-l border-border">{totals.totalCalls}</td>
                  <td className="p-3 text-right text-green-600 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{totals.connected}</td>
                  <td className="p-3 text-right text-orange-600 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{rows.reduce((s, r) => s + r.busy, 0)}</td>
                  <td className="p-3 text-right text-yellow-600 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{rows.reduce((s, r) => s + r.noAnswer, 0)}</td>
                  <td className="p-3 text-right text-red-600 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{rows.reduce((s, r) => s + r.switchedOff, 0)}</td>
                  <td className="p-3 bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50"></td>
                  <td className="p-3 text-right text-muted-foreground bg-amber-50/30 dark:bg-amber-950/10 border-l border-border/50">{formatDuration(totals.totalDuration)}</td>
                  <td className="p-3 text-right bg-green-50/30 dark:bg-green-950/10 border-l border-border">{totals.monthlyPaidLeads}</td>
                  <td className="p-3 bg-green-50/30 dark:bg-green-950/10 border-l border-border/50"></td>
                  <td className="p-3 text-right text-green-600 bg-green-50/30 dark:bg-green-950/10 border-l border-border/50">
                    {formatMoney(totals.earnedIncentive)}
                  </td>
                  <td className="p-3 bg-green-50/30 dark:bg-green-950/10 border-l border-border/50"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
};

export default UnifiedTelecallerReport;
