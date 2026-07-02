import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import LeadAnalyticsReport from "./LeadAnalyticsReport";

interface Props {
  startISO: string;
  endISO: string;
  dateLabel: string;
}

const LeadAnalyticsTab = ({ startISO, endISO, dateLabel }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["report-lead-analytics", startISO, endISO, companyId],
    queryFn: async () => {
      const [
        leadsResult,
        totalCountResult,
        paidCountResult,
        verifiedCountResult,
        approvedCountResult,
        disbursedCountResult,
        paymentsResult,
      ] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("id, status, loan_type")
            .gte("created_at", startISO).lte("created_at", endISO).limit(10000)
        ),
        applyCompanyFilter(
          supabase.from("leads").select("id", { count: "exact", head: true })
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        applyCompanyFilter(
          supabase.from("payments").select("id", { count: "exact", head: true })
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        applyCompanyFilter(
          supabase.from("leads").select("id", { count: "exact", head: true })
            .in("status", ["verified", "processing", "approved", "disbursed"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        applyCompanyFilter(
          supabase.from("leads").select("id", { count: "exact", head: true })
            .in("status", ["approved", "disbursed"])
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        applyCompanyFilter(
          supabase.from("leads").select("id", { count: "exact", head: true })
            .eq("status", "disbursed")
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        applyCompanyFilter(
          supabase.from("payments").select("lead_id")
            .in("status", ["completed", "captured"])
            .gte("created_at", startISO).lte("created_at", endISO).limit(10000)
        ),
      ]);

      const leads = leadsResult.data || [];
      const paidLeadIds = new Set((paymentsResult.data || []).map(p => p.lead_id));

      const statusCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};
      leads.forEach(lead => {
        const effectiveStatus = lead.status === "unpaid" && paidLeadIds.has(lead.id) ? "paid" : lead.status;
        statusCounts[effectiveStatus] = (statusCounts[effectiveStatus] || 0) + 1;
        typeCounts[lead.loan_type] = (typeCounts[lead.loan_type] || 0) + 1;
      });

      const totalLeads = totalCountResult.count || 0;
      const paidCount = paidCountResult.count || 0;

      // Monthly trend (last 6 months) — all queries in parallel
      const monthQueries = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        monthQueries.push({
          label: monthStart.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
          leadsQuery: applyCompanyFilter(
            supabase.from("leads").select("id", { count: "exact", head: true })
              .gte("created_at", monthStart.toISOString()).lt("created_at", monthEnd.toISOString())
          ),
          paymentsQuery: applyCompanyFilter(
            supabase.from("payments").select("id", { count: "exact", head: true })
              .in("status", ["completed", "captured"])
              .gte("created_at", monthStart.toISOString()).lt("created_at", monthEnd.toISOString())
          ),
        });
      }

      const monthlyTrend = await Promise.all(
        monthQueries.map(async (mq) => {
          const [lr, pr] = await Promise.all([mq.leadsQuery, mq.paymentsQuery]);
          return { month: mq.label, leads: lr.count || 0, paid: pr.count || 0 };
        })
      );

      const conversionFunnel = [
        { stage: "Total Leads", count: totalLeads },
        { stage: "Paid", count: paidCount },
        { stage: "Verified", count: verifiedCountResult.count || 0 },
        { stage: "Approved", count: approvedCountResult.count || 0 },
        { stage: "Disbursed", count: disbursedCountResult.count || 0 },
      ];

      return {
        leadsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        leadsByLoanType: Object.entries(typeCounts).map(([type, count]) => ({ type, count })),
        monthlyTrend,
        conversionFunnel,
        totalLeads,
        paidCount,
      };
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <LeadAnalyticsReport
      leadsByStatus={data.leadsByStatus}
      leadsByLoanType={data.leadsByLoanType}
      monthlyTrend={data.monthlyTrend}
      conversionFunnel={data.conversionFunnel}
      dateFilter={startISO}
      dateEndFilter={endISO}
      filteredLeadsCount={data.totalLeads}
      filteredPaidCount={data.paidCount}
      dateLabel={dateLabel}
    />
  );
};

export default LeadAnalyticsTab;
