import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { formatISTDate, startOfDayIST, endOfDayIST, getISTDateNDaysAgo, getMonthStartISO } from "@/lib/dateUtils";
import type { AppRole } from "@/types/database";

// Types
export interface DashboardStats {
  totalLeads: number;
  paidLeads: number;
  totalRevenue: number;
  totalExpenses: number;
  verifiedLeads: number;
  disbursedLeads: number;
  lostLeads: number;
  conversionRate: number;
  gstPayable: number;
  outputGST: number;
  inputGST: number;
}

export interface PersonalStats {
  assignedLeads: number;
  paidLeads: number;
  conversionRate: number;
  monthlyPaidLeads: number;
  currentIncentiveRate: number;
  nextMilestone: number;
  leadsToNextMilestone: number;
  earnedIncentive: number;
  totalCalls: number;
  connectedCalls: number;
  busyCalls: number;
  noAnswerCalls: number;
  switchedOffCalls: number;
  avgCallDuration: number;
}

export interface PaymentSourceData {
  source: string;
  count: number;
  amount: number;
  color: string;
  iconName: string;
}

export interface GatewayData {
  gateway: string;
  count: number;
  amount: number;
  color: string;
  icon: string;
}

export interface TelecallerRanking {
  name: string;
  userId: string;
  leads: number;
  conversions: number;
  rate: number;
}

export interface VisitorStats {
  visitors: number;
  pageviews: number;
  sessions: number;
  mobilePercent: number;
  desktopPercent: number;
  bounceRate: number;
  avgDuration: number;
  leadsGenerated: number;
  conversionRate: number;
}

export interface CallStats {
  totalCalls: number;
  connected: number;
  busy: number;
  noAnswer: number;
  switchedOff: number;
  avgDuration: number;
  totalDuration: number;
  connectRate: number;
}

const INCENTIVE_TIERS = [
  { minPaid: 150, rate: 7 },
  { minPaid: 250, rate: 15 },
  { minPaid: 500, rate: 20 },
  { minPaid: 750, rate: 25 },
  { minPaid: 1000, rate: 30 },
];

export const getIncentiveInfo = (paidLeads: number) => {
  let currentRate = 0;
  let nextMilestone = 150;
  for (const tier of INCENTIVE_TIERS) {
    if (paidLeads >= tier.minPaid) currentRate = tier.rate;
    else { nextMilestone = tier.minPaid; break; }
  }
  if (paidLeads >= 1000) nextMilestone = 0;
  const leadsToNext = nextMilestone > 0 ? nextMilestone - paidLeads : 0;
  const earnedIncentive = paidLeads >= 150 ? paidLeads * currentRate : 0;
  return { currentRate, nextMilestone, leadsToNext, earnedIncentive };
};

function getDateBounds(dateRange: string) {
  const now = new Date();
  const todayIST = formatISTDate(now);
  
  const rangeMap: Record<string, () => { start: string; end: string }> = {
    today: () => ({ start: todayIST, end: todayIST }),
    yesterday: () => {
      const d = getISTDateNDaysAgo(1);
      return { start: d, end: d };
    },
    week: () => ({ start: getISTDateNDaysAgo(7), end: todayIST }),
    month: () => ({ start: getISTDateNDaysAgo(30), end: todayIST }),
  };

  const bounds = (rangeMap[dateRange] || rangeMap.today)();
  return {
    startISO: startOfDayIST(bounds.start).toISOString(),
    endISO: endOfDayIST(bounds.end).toISOString(),
    startDateStr: bounds.start,
    endDateStr: bounds.end,
  };
}

// ─── Admin Stats Query ──────────────────────────────────
export function useAdminStats(dateRange: string) {
  const { companyId, applyCompanyFilter, currentCompany, isHariox } = useCompanyFilter();

  return useQuery({
    queryKey: ["admin-stats", dateRange, companyId],
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async (): Promise<DashboardStats> => {
      const { startISO, endISO, startDateStr, endDateStr } = getDateBounds(dateRange);

      // Single query for all lead statuses instead of 5 separate HEAD queries
      let leadsQuery = supabase.from("leads")
        .select("id, status")
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      leadsQuery = applyCompanyFilter(leadsQuery);

      // Payments query
      let paymentsQuery = supabase.from("payments")
        .select("total_amount, lead_id, company_id")
        .in("status", ["completed", "captured"])
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      // Expenses & income
      let expensesQuery = supabase.from("accounting_entries")
        .select("amount, gst_included, gst_rate").eq("entry_type", "expense")
        .gte("entry_date", startDateStr).lte("entry_date", endDateStr);
      let incomeQuery = supabase.from("accounting_entries")
        .select("amount, gst_included, gst_rate").eq("entry_type", "income")
        .gte("entry_date", startDateStr).lte("entry_date", endDateStr);
      if (companyId) {
        expensesQuery = expensesQuery.eq("company_id", companyId);
        incomeQuery = incomeQuery.eq("company_id", companyId);
      }

      // Run ALL queries in parallel (4 instead of 9+)
      const [{ data: leads }, { data: payments }, { data: expenses }, { data: incomeEntries }] = await Promise.all([
        leadsQuery,
        paymentsQuery,
        expensesQuery,
        incomeQuery,
      ]);

      const allLeads = leads || [];
      const totalLeads = allLeads.length;
      const verifiedLeads = allLeads.filter(l => ["verified", "processing", "approved", "disbursed"].includes(l.status)).length;
      const disbursedLeads = allLeads.filter(l => l.status === "disbursed").length;
      const lostLeads = allLeads.filter(l => l.status === "lost").length;

      // Filter payments by company using lead IDs we already have
      let filteredPayments = payments || [];
      if (companyId) {
        const companyLeadIds = new Set(allLeads.map(l => l.id));
        filteredPayments = filteredPayments.filter(p => p.company_id === companyId || companyLeadIds.has(p.lead_id));
      }
      const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.total_amount), 0);
      const actualPaidCount = new Set(filteredPayments.map(p => p.lead_id)).size;

      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // GST
      const paymentGST = totalRevenue * 0.18 / 1.18;
      const incomeGST = (incomeEntries || []).reduce((sum, e) => {
        if (e.gst_included && e.gst_rate) {
          const rate = Number(e.gst_rate) / 100;
          return sum + (Number(e.amount) * rate / (1 + rate));
        }
        return sum;
      }, 0);
      const expenseGST = (expenses || []).reduce((sum, e) => {
        if (e.gst_included && e.gst_rate) {
          const rate = Number(e.gst_rate) / 100;
          return sum + (Number(e.amount) * rate / (1 + rate));
        }
        return sum;
      }, 0);

      const totalOutputGST = paymentGST + incomeGST;
      const totalInputGST = expenseGST;
      const netGST = totalOutputGST - totalInputGST;

      return {
        totalLeads,
        paidLeads: actualPaidCount,
        totalRevenue,
        totalExpenses,
        verifiedLeads,
        disbursedLeads,
        lostLeads,
        conversionRate: totalLeads > 0 ? Math.round((actualPaidCount / totalLeads) * 100) : 0,
        gstPayable: netGST,
        outputGST: totalOutputGST,
        inputGST: totalInputGST,
      };
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

// ─── Payment Sources Query ──────────────────────────────
export function usePaymentSources(dateRange: string) {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  return useQuery({
    queryKey: ["payment-sources", dateRange, companyId],
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async () => {
      const { startISO, endISO } = getDateBounds(dateRange);

      let paymentsQuery = supabase.from("payments")
        .select("total_amount, payment_source, lead_id, company_id, razorpay_order_id, razorpay_payment_id")
        .in("status", ["completed", "captured"])
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      const { data: payments } = await paymentsQuery;

      let filteredPayments = payments || [];
      if (companyId) {
        const { data: companyLeads } = await supabase.from("leads").select("id").eq("company_id", companyId);
        const companyLeadIds = new Set(companyLeads?.map(l => l.id) || []);
        filteredPayments = (payments || []).filter(p => p.company_id === companyId || companyLeadIds.has(p.lead_id));
      }

      const sourceData: Record<string, { count: number; amount: number }> = {
        direct: { count: 0, amount: 0 },
        telecaller: { count: 0, amount: 0 },
        marketing: { count: 0, amount: 0 },
        whatsapp: { count: 0, amount: 0 },
        manual: { count: 0, amount: 0 },
      };

      const gatewayStats: Record<string, { count: number; amount: number }> = {
        razorpay: { count: 0, amount: 0 },
        phonepe: { count: 0, amount: 0 },
        paytm: { count: 0, amount: 0 },
        cash: { count: 0, amount: 0 },
      };

      const detectGateway = (orderId: string | null, paymentId: string | null): string => {
        const oid = (orderId || "").toLowerCase();
        const pid = (paymentId || "").toLowerCase();
        if (oid.startsWith("order_") || pid.startsWith("pay_")) return "razorpay";
        if (oid.includes("paytm") || pid.includes("paytm")) return "paytm";
        if (oid.startsWith("txn_") || oid.includes("phonepe")) return "phonepe";
        if (oid.startsWith("cash_") || oid.includes("manual") || pid.startsWith("cash_")) return "cash";
        return "razorpay";
      };

      filteredPayments.forEach(p => {
        let source: string = (p.payment_source || "direct").toLowerCase();
        if (source === "sms") source = "marketing";
        if (!["direct", "telecaller", "marketing", "whatsapp", "manual"].includes(source)) source = "direct";
        if (!sourceData[source]) sourceData[source] = { count: 0, amount: 0 };
        sourceData[source].count++;
        sourceData[source].amount += Number(p.total_amount);

        const gateway = detectGateway(p.razorpay_order_id, p.razorpay_payment_id);
        if (!gatewayStats[gateway]) gatewayStats[gateway] = { count: 0, amount: 0 };
        gatewayStats[gateway].count++;
        gatewayStats[gateway].amount += Number(p.total_amount);
      });

      const iconMap: Record<string, string> = { direct: "Globe", telecaller: "Headphones", marketing: "Mail", whatsapp: "MessageCircle", manual: "CreditCard" };
      const colorMap: Record<string, string> = { direct: "bg-blue-100 text-blue-600", telecaller: "bg-amber-100 text-amber-600", marketing: "bg-violet-100 text-violet-600", whatsapp: "bg-emerald-100 text-emerald-600", manual: "bg-rose-100 text-rose-600" };
      const labelMap: Record<string, string> = { direct: "Website", telecaller: "Telecaller", marketing: "SMS", whatsapp: "WhatsApp", manual: "Manual" };

      const sources: PaymentSourceData[] = Object.entries(sourceData).map(([source, data]) => ({
        source: labelMap[source] || source,
        count: data.count,
        amount: data.amount,
        color: colorMap[source] || "bg-gray-100 text-gray-600",
        iconName: iconMap[source] || "Globe",
      }));

      const gatewayColorMap: Record<string, string> = { razorpay: "bg-indigo-100 text-indigo-700", phonepe: "bg-purple-100 text-purple-700", paytm: "bg-sky-100 text-sky-700", cash: "bg-amber-100 text-amber-700" };
      const gatewayIconMap: Record<string, string> = { razorpay: "💳", phonepe: "📲", paytm: "📱", cash: "💵" };
      const gatewayLabelMap: Record<string, string> = { razorpay: "Razorpay", phonepe: "PhonePe", paytm: "Paytm", cash: "Cash" };

      const gateways: GatewayData[] = Object.entries(gatewayStats)
        .filter(([, d]) => d.count > 0)
        .map(([gw, d]) => ({
          gateway: gatewayLabelMap[gw] || gw,
          count: d.count,
          amount: d.amount,
          color: gatewayColorMap[gw] || "bg-gray-100 text-gray-600",
          icon: gatewayIconMap[gw] || "💰",
        }));

      return { sources, gateways };
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

// ─── Visitor Analytics Query ────────────────────────────
export function useVisitorAnalytics(dateRange: string) {
  const { companyId, applyCompanyFilter, currentCompany } = useCompanyFilter();

  return useQuery({
    queryKey: ["visitor-analytics", dateRange, companyId],
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async (): Promise<VisitorStats> => {
      const { startISO, endISO } = getDateBounds(dateRange);

      // Use RPC for accurate pageview/visitor counts (no row limit)
      const [analyticsCountRes, eventsRes, leadsRes] = await Promise.all([
        supabase.rpc("get_analytics_counts", {
          p_start: startISO,
          p_end: endISO,
          p_company_id: companyId || null,
        }),
        // Still fetch raw events for session/device stats (capped but OK for ratios)
        supabase
          .from("analytics_events")
          .select("session_id, device_type, page_url")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .in("event_type", ["pageview", "page_view"])
          .or("page_path.not.like./admin%,page_path.is.null")
          .limit(10000),
        applyCompanyFilter(
          supabase.from("leads").select("*", { count: "exact", head: true })
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
      ]);

      const { count: leadsCount } = leadsRes;
      const counts = analyticsCountRes.data?.[0] || { pageviews: 0, visitors: 0 };
      const pageviews = Number(counts.pageviews) || 0;
      const uniqueVisitors = Number(counts.visitors) || 0;

      const events = eventsRes.data || [];
      let eventsData = events;
      if (companyId && currentCompany) {
        const getDomainPattern = (company: typeof currentCompany) => {
          if (!company) return null;
          const slug = company.slug?.toLowerCase() || "";
          if (slug === "hariox") return "credit.hariox.com";
          if (slug === "capital") return "capital.hariox.com";
          if (slug === "finance") return "finance.hariox.com";
          return null;
        };
        const pattern = getDomainPattern(currentCompany);
        if (pattern) eventsData = eventsData.filter(e => (e.page_url || "").includes(pattern));
      }

      const sessions = new Set(eventsData.filter(e => e.session_id).map(e => e.session_id)).size;
      const mobileEvents = eventsData.filter(e => e.device_type === "mobile").length;
      const desktopEvents = eventsData.filter(e => e.device_type === "desktop").length;
      const totalDeviceEvents = mobileEvents + desktopEvents;
      const mobilePercent = totalDeviceEvents > 0 ? Math.round((mobileEvents / totalDeviceEvents) * 100) : 0;
      const desktopPercent = totalDeviceEvents > 0 ? Math.round((desktopEvents / totalDeviceEvents) * 100) : 0;

      const sessionPageviews: Record<string, number> = {};
      eventsData.forEach(e => { if (e.session_id) sessionPageviews[e.session_id] = (sessionPageviews[e.session_id] || 0) + 1; });
      const bouncedSessions = Object.values(sessionPageviews).filter(c => c === 1).length;
      const bounceRate = sessions > 0 ? Math.round((bouncedSessions / sessions) * 100) : 0;
      const avgDuration = sessions > 0 ? Math.round(pageviews / sessions * 10) / 10 : 0;
      const conversionRate = uniqueVisitors > 0 ? Math.round(((leadsCount || 0) / uniqueVisitors) * 100) : 0;

      return { visitors: uniqueVisitors, pageviews, sessions, mobilePercent, desktopPercent, bounceRate, avgDuration, leadsGenerated: leadsCount || 0, conversionRate };
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

// ─── Call Performance Query ─────────────────────────────
export function useCallPerformance(dateRange: string) {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  return useQuery({
    queryKey: ["call-performance", dateRange, companyId],
    queryFn: async (): Promise<CallStats> => {
      const { startISO } = getDateBounds(dateRange);
      let query = supabase
        .from("call_logs")
        .select("outcome, call_duration")
        .gte("created_at", startISO);
      if (companyId) query = query.eq("company_id", companyId);
      const { data: callLogs } = await query;

      if (!callLogs?.length) {
        return { totalCalls: 0, connected: 0, busy: 0, noAnswer: 0, switchedOff: 0, avgDuration: 0, totalDuration: 0, connectRate: 0 };
      }

      const totalCalls = callLogs.length;
      const connected = callLogs.filter(c => c.outcome === "connected" || c.outcome === "contacted").length;
      const busy = callLogs.filter(c => c.outcome === "busy").length;
      const noAnswer = callLogs.filter(c => c.outcome === "no_answer").length;
      const switchedOff = callLogs.filter(c => c.outcome === "switched_off").length;

      const callsWithDuration = callLogs.filter(c => (c.outcome === "connected" || c.outcome === "contacted") && c.call_duration && c.call_duration > 0);
      const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.call_duration || 0), 0);
      const avgDuration = callsWithDuration.length > 0 ? Math.round(totalDuration / callsWithDuration.length) : 0;
      const connectRate = totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0;

      return { totalCalls, connected, busy, noAnswer, switchedOff, avgDuration, totalDuration, connectRate };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ─── Personal Stats Query (Telecaller) ──────────────────
export function usePersonalStats(dateRange: string, userId: string | null, enabled: boolean) {
  const { applyCompanyFilter, companyId } = useCompanyFilter();

  return useQuery({
    queryKey: ["personal-stats", dateRange, userId, companyId],
    enabled: enabled && !!userId,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async (): Promise<PersonalStats> => {
      if (!userId) throw new Error("No user");
      const { startISO, endISO } = getDateBounds(dateRange);
      const monthStartIso = getMonthStartISO();

      // ── Step 1: Get ALL leads ever assigned to this user via assignment history ──
      // This is critical because paid leads get reassigned to verification team,
      // so `assigned_to` no longer points to the telecaller.
      // Fetch ALL history (telecallers can have 2000+ entries, default limit is 1000)
      const allHistoryLeadIds: string[] = [];
      let historyOffset = 0;
      const BATCH = 1000;
      while (true) {
        const { data: batch } = await supabase
          .from("lead_assignment_history")
          .select("lead_id")
          .eq("assigned_to", userId)
          .range(historyOffset, historyOffset + BATCH - 1);
        if (!batch || batch.length === 0) break;
        allHistoryLeadIds.push(...batch.map(h => h.lead_id));
        if (batch.length < BATCH) break;
        historyOffset += BATCH;
      }
      
      // Also include currently assigned leads (in case history is missing)
      let currentAssignedQuery = supabase.from("leads").select("id").eq("assigned_to", userId);
      currentAssignedQuery = applyCompanyFilter(currentAssignedQuery);
      const { data: currentAssignedData } = await currentAssignedQuery;

      const allEverAssignedIds = [...new Set([
        ...allHistoryLeadIds,
        ...(currentAssignedData || []).map(l => l.id),
      ])];

      // ── Step 2: Filter to company if needed ──
      let companyFilteredIds = allEverAssignedIds;
      if (companyId && allEverAssignedIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < allEverAssignedIds.length; i += 100) {
          chunks.push(allEverAssignedIds.slice(i, i + 100));
        }
        const validIds: string[] = [];
        await Promise.all(chunks.map(async (chunk) => {
          const { data } = await supabase.from("leads").select("id").in("id", chunk).eq("company_id", companyId);
          (data || []).forEach(l => validIds.push(l.id));
        }));
        companyFilteredIds = validIds;
      }

      // ── Step 3: Assigned leads in date range (for display) ──
      let assignedQuery = supabase.from("leads").select("id").eq("assigned_to", userId)
        .gte("created_at", startISO).lte("created_at", endISO);
      assignedQuery = applyCompanyFilter(assignedQuery);
      const { data: assignedLeadsData } = await assignedQuery;
      const assignedLeads = assignedLeadsData?.length || 0;

      // ── Step 4: Paid leads in date range (payments for leads ever assigned) ──
      let paidLeadsCount = 0;
      if (companyFilteredIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < companyFilteredIds.length; i += 100) {
          chunks.push(companyFilteredIds.slice(i, i + 100));
        }
        const paidLeadIds = new Set<string>();
        await Promise.all(chunks.map(async (chunk) => {
          const { data: paymentsData } = await supabase.from("payments")
            .select("lead_id").in("lead_id", chunk)
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO);
          (paymentsData || []).forEach(p => paidLeadIds.add(p.lead_id));
        }));
        paidLeadsCount = paidLeadIds.size;
      }

      // ── Step 5: Monthly Paid (MTD) — uses same ever-assigned set ──
      let monthlyPaidLeadsCount = 0;
      if (companyFilteredIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < companyFilteredIds.length; i += 100) {
          chunks.push(companyFilteredIds.slice(i, i + 100));
        }
        const monthlyPaidIds = new Set<string>();
        await Promise.all(chunks.map(async (chunk) => {
          const { data: monthlyPaymentsData } = await supabase.from("payments")
            .select("lead_id").in("lead_id", chunk)
            .in("status", ["completed", "captured"])
            .gte("created_at", monthStartIso);
          (monthlyPaymentsData || []).forEach(p => monthlyPaidIds.add(p.lead_id));
        }));
        monthlyPaidLeadsCount = monthlyPaidIds.size;
      }

      // ── Step 6: Call stats ──
      let callQuery = supabase.from("call_logs")
        .select("outcome, call_duration").eq("caller_id", userId).gte("created_at", startISO);
      if (companyId) callQuery = callQuery.eq("company_id", companyId);
      const { data: callLogs } = await callQuery;

      const totalCalls = callLogs?.length || 0;
      const connectedCalls = callLogs?.filter(c => c.outcome === "connected").length || 0;
      const busyCalls = callLogs?.filter(c => c.outcome === "busy").length || 0;
      const noAnswerCalls = callLogs?.filter(c => c.outcome === "no_answer").length || 0;
      const switchedOffCalls = callLogs?.filter(c => c.outcome === "switched_off").length || 0;
      const connectedWithDuration = callLogs?.filter(c => c.outcome === "connected" && c.call_duration) || [];
      const totalDuration = connectedWithDuration.reduce((sum, c) => sum + (c.call_duration || 0), 0);
      const avgCallDuration = connectedWithDuration.length > 0 ? Math.round(totalDuration / connectedWithDuration.length) : 0;

      const incentiveInfo = getIncentiveInfo(monthlyPaidLeadsCount);
      const conversionRate = assignedLeads > 0 ? Math.round((paidLeadsCount / assignedLeads) * 100) : 0;

      return {
        assignedLeads, paidLeads: paidLeadsCount, conversionRate,
        monthlyPaidLeads: monthlyPaidLeadsCount, currentIncentiveRate: incentiveInfo.currentRate,
        nextMilestone: incentiveInfo.nextMilestone, leadsToNextMilestone: incentiveInfo.leadsToNext,
        earnedIncentive: incentiveInfo.earnedIncentive, totalCalls, connectedCalls, busyCalls,
        noAnswerCalls, switchedOffCalls, avgCallDuration,
      };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
