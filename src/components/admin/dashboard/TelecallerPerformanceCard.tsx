import { useEffect, useMemo, useState } from "react";
import { Phone, Users, Calendar, XCircle, TrendingUp, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface TelecallerRow {
  userId: string;
  name: string;
  totalLeads: number; // All leads ever assigned (including past)
  assignedLeads: number; // Active leads in range (excluding lost)
  todayTotal: number; // Total leads assigned today
  todayLost: number; // Lost from today's assigned
  todayActive: number; // todayTotal - todayLost
  conversions: number;
  conversionRate: number;
  lostLeads: number;
  totalCalls: number;
  connected: number;
  monthlyPaidLeads: number;
  earnedIncentive: number;
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
  for (const tier of INCENTIVE_TIERS) {
    if (paidLeads >= tier.minPaid) currentRate = tier.rate;
    else break;
  }
  const earnedIncentive = paidLeads >= 150 ? paidLeads * currentRate : 0;
  return { earnedIncentive };
};

interface TelecallerPerformanceCardProps {
  dateFilter: string;
  dateEndFilter: string;
}

const TelecallerPerformanceCard = ({ dateFilter, dateEndFilter }: TelecallerPerformanceCardProps) => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [rows, setRows] = useState<TelecallerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate today start in IST
  const todayStartIso = useMemo(() => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();
    const day = istNow.getUTCDate();
    const istMidnight = Date.UTC(year, month, day, 0, 0, 0, 0);
    return new Date(istMidnight - IST_OFFSET_MS).toISOString();
  }, []);

  // Calculate MTD start in IST
  const monthStartIso = useMemo(() => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();
    const istMidnight = Date.UTC(year, month, 1, 0, 0, 0, 0);
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

      // Fetch base data
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

      // Fetch ALL leads assigned to telecallers (no date filter) for "Total Leads"
      let allLeadsQuery = supabase
        .from("leads")
        .select("id, assigned_to, status")
        .in("assigned_to", telecallerIds)
        .limit(100000);
      allLeadsQuery = applyCompanyFilter(allLeadsQuery);

      // Fetch leads in date range
      let leadsQuery = supabase
        .from("leads")
        .select("id, assigned_to, status, created_at")
        .gte("created_at", dateFilter)
        .lte("created_at", dateEndFilter)
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

      let todayLostLeadsQuery = supabase
        .from("leads")
        .select("id")
        .eq("status", "lost")
        .gte("updated_at", todayStartIso)
        .limit(10000);
      todayLostLeadsQuery = applyCompanyFilter(todayLostLeadsQuery);

      let paymentsQuery = supabase
        .from("payments")
        .select("lead_id, created_at, collected_by")
        .in("status", ["completed", "captured"])
        .eq("payment_source", "telecaller")
        .gte("created_at", dateFilter)
        .lte("created_at", dateEndFilter)
        .limit(10000);
      paymentsQuery = applyCompanyFilter(paymentsQuery);

      let callLogsQuery = supabase
        .from("call_logs")
        .select("caller_id, outcome, call_duration")
        .in("caller_id", telecallerIds)
        .gte("created_at", dateFilter)
        .lte("created_at", dateEndFilter)
        .limit(10000);
      callLogsQuery = applyCompanyFilter(callLogsQuery);

      // MTD payments - only telecaller-sourced for accurate conversion tracking
      let mtdPaymentsQuery = supabase
        .from("payments")
        .select("lead_id, created_at, collected_by")
        .in("status", ["completed", "captured"])
        .eq("payment_source", "telecaller")
        .gte("created_at", monthStartIso)
        .limit(10000);
      mtdPaymentsQuery = applyCompanyFilter(mtdPaymentsQuery);

      const [allLeadsRes, leadsRes, todayAssignmentRes, todayLeadsRes, todayLostLeadsRes, paymentsRes, callLogsRes, mtdPaymentsRes, assignmentHistoryRes] = await Promise.all([
        allLeadsQuery,
        leadsQuery,
        todayAssignmentQuery,
        todayLeadsQuery,
        todayLostLeadsQuery,
        paymentsQuery,
        callLogsQuery,
        mtdPaymentsQuery,
        supabase.from("lead_assignment_history").select("lead_id, assigned_to, created_at").order("created_at", { ascending: false }).limit(50000),
      ]);

      const allLeads = allLeadsRes.data || [];

      const leads = leadsRes.data || [];
      const todayAssignments = todayAssignmentRes.data || [];
      const todayLeads = todayLeadsRes.data || [];
      const todayLostLeads = todayLostLeadsRes.data || [];
      const payments = paymentsRes.data || [];
      const callLogs = callLogsRes.data || [];
      const mtdPayments = mtdPaymentsRes.data || [];
      const assignmentHistory = assignmentHistoryRes.data || [];

      const getLastTelecaller = (leadId: string, paymentDate: string, collectedBy: string | null) => {
        const history = assignmentHistory.filter(
          (ah) => ah.lead_id === leadId && 
                  telecallerIds.includes(ah.assigned_to) && 
                  ah.created_at <= paymentDate
        );
        if (history.length > 0) return history[0].assigned_to;
        if (collectedBy && telecallerIds.includes(collectedBy)) return collectedBy;
        return null;
      };

      const rangeConversions = new Map<string, number>();
      payments.forEach((p) => {
        const tc = getLastTelecaller(p.lead_id, p.created_at, p.collected_by);
        if (tc) rangeConversions.set(tc, (rangeConversions.get(tc) || 0) + 1);
      });

      const mtdConversions = new Map<string, number>();
      mtdPayments.forEach((p) => {
        const tc = getLastTelecaller(p.lead_id, p.created_at, p.collected_by);
        if (tc) mtdConversions.set(tc, (mtdConversions.get(tc) || 0) + 1);
      });

      const newRows: TelecallerRow[] = telecallerIds.map((userId) => {
      // All Leads = all unique leads ever assigned, excluding lost
        const historyLeadIds = new Set(assignmentHistory.filter((ah) => ah.assigned_to === userId).map((ah) => ah.lead_id));
        allLeads.filter((l) => l.assigned_to === userId).forEach((l) => historyLeadIds.add(l.id));
        // Remove lost leads
        const totalLeads = [...historyLeadIds].filter((lid) => {
          const lead = allLeads.find((l) => l.id === lid);
          return !lead || lead.status !== "lost";
        }).length;
        
        // AssignedRange = active leads in date range (excluding lost)
        const assignedLeads = leads.filter((l) => l.assigned_to === userId && l.status !== "lost").length;
        
        // Get unique lead IDs assigned to this telecaller today (from history + created today)
        const todayAssignedFromHistoryIds = todayAssignments
          .filter((a) => a.assigned_to === userId)
          .map(a => a.lead_id);
        const todayCreatedLeadIds = todayLeads
          .filter((l) => l.assigned_to === userId)
          .map(l => l.id);
        
        // Combine and deduplicate
        const allTodayLeadIds = [...new Set([...todayAssignedFromHistoryIds, ...todayCreatedLeadIds])];
        const todayTotal = allTodayLeadIds.length;
        
        // Count lost leads from today's assigned leads
        const todayLost = allTodayLeadIds.filter(leadId => {
          const lead = todayLeads.find(l => l.id === leadId);
          return lead?.status === 'lost';
        }).length;
        
        // Today Active = Total - Lost
        const todayActive = todayTotal - todayLost;
        
        const lostLeads = leads.filter((l) => l.assigned_to === userId && l.status === "lost").length;
        const conversions = rangeConversions.get(userId) || 0;
        const conversionRate = assignedLeads > 0 ? Math.round((conversions / assignedLeads) * 100) : 0;

        const tcCalls = callLogs.filter((c) => c.caller_id === userId);
        const connectedCalls = tcCalls.filter((c) => c.outcome === "connected");

        const monthlyPaidLeads = mtdConversions.get(userId) || 0;
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
          monthlyPaidLeads,
          earnedIncentive: incentiveInfo.earnedIncentive,
        };
      }).sort((a, b) => b.conversions - a.conversions || b.monthlyPaidLeads - a.monthlyPaidLeads);

      setRows(newRows);
    } catch (e) {
      console.error("Telecaller card error:", e);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Auto-refresh every 1 minute
    return () => clearInterval(interval);
  }, [currentCompany?.slug, getCompanyFilter, dateFilter, dateEndFilter, monthStartIso, todayStartIso]);

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
      monthlyPaidLeads: acc.monthlyPaidLeads + r.monthlyPaidLeads,
      earnedIncentive: acc.earnedIncentive + r.earnedIncentive,
    }), {
      totalLeads: 0,
      assignedLeads: 0,
      todayTotal: 0,
      todayLost: 0,
      todayActive: 0,
      conversions: 0,
      lostLeads: 0,
      totalCalls: 0,
      connected: 0,
      monthlyPaidLeads: 0,
      earnedIncentive: 0,
    });
  }, [rows]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Telecaller Performance</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-primary" />
            Today: {totals.todayTotal} ({totals.todayActive} active)
          </span>
          <span className="flex items-center gap-1">
            <Gift className="w-3 h-3 text-amber-500" />
            MTD: ₹{totals.earnedIncentive.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] sm:text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex flex-col items-end">
                  <span>Today</span>
                  <span className="text-[9px] opacity-60">Total</span>
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex flex-col items-end">
                  <span>Today</span>
                  <span className="text-[9px] opacity-60">Lost</span>
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex flex-col items-end">
                  <span>Today</span>
                  <span className="text-[9px] opacity-60">Active</span>
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex flex-col items-end">
                  <span>Active</span>
                  <span className="text-[9px] opacity-60">Leads</span>
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex flex-col items-end">
                  <span>Calls</span>
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex flex-col items-end">
                  <span>MTD</span>
                  <span className="text-[9px] opacity-60">Paid</span>
                </div>
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                <div className="flex flex-col items-end">
                  <span>Incentive</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, idx) => (
              <tr key={row.userId} className="hover:bg-muted/30">
                <td className="p-2 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      idx === 0 ? "bg-yellow-100 text-yellow-800" : idx === 1 ? "bg-gray-100 text-gray-700" : "bg-orange-100 text-orange-800"
                    }`}>{idx + 1}</span>
                    <span className="truncate max-w-[60px]">{row.name.split(' ')[0]}</span>
                  </div>
                </td>
                <td className="p-2 text-right font-semibold">{row.todayTotal}</td>
                <td className="p-2 text-right">
                  {row.todayLost > 0 ? (
                    <span className="text-destructive font-medium">-{row.todayLost}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="p-2 text-right font-semibold text-primary">{row.todayActive}</td>
                <td className="p-2 text-right text-muted-foreground">{row.totalLeads}</td>
                <td className="p-2 text-right">{row.totalCalls}</td>
                <td className="p-2 text-right font-bold text-primary">{row.monthlyPaidLeads}</td>
                <td className="p-2 text-right">
                  {row.earnedIncentive > 0 ? (
                    <span className="text-emerald-600 font-semibold">₹{row.earnedIncentive.toLocaleString("en-IN")}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/50 font-semibold">
            <tr>
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{totals.todayTotal}</td>
              <td className="p-2 text-right text-destructive">-{totals.todayLost}</td>
              <td className="p-2 text-right text-primary">{totals.todayActive}</td>
              <td className="p-2 text-right text-muted-foreground">{totals.totalLeads}</td>
              <td className="p-2 text-right">{totals.totalCalls}</td>
              <td className="p-2 text-right text-primary">{totals.monthlyPaidLeads}</td>
              <td className="p-2 text-right text-emerald-600">₹{totals.earnedIncentive.toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TelecallerPerformanceCard;
