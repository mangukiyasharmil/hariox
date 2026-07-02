import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface CohortData {
  period: string;
  totalLeads: number;
  day0: number;
  day1: number;
  day3: number;
  day7: number;
  day30: number;
}

const CohortAnalysisReport = () => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCohortData();
  }, [currentCompany?.id]);

  const fetchCohortData = async () => {
    try {
      setIsLoading(true);
      const companyId = getCompanyFilter();
      const isHariox = currentCompany?.slug === "hariox";

      // Get last 4 weeks of data
      const cohortData: CohortData[] = [];
      const now = new Date();

      for (let week = 0; week < 4; week++) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (week + 1) * 7);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        let leadsQuery = supabase
          .from("leads")
          .select("id, created_at")
          .gte("created_at", weekStart.toISOString())
          .lt("created_at", weekEnd.toISOString());

        if (companyId) {
          leadsQuery = isHariox
            ? leadsQuery.or(`company_id.eq.${companyId},company_id.is.null`)
            : leadsQuery.eq("company_id", companyId);
        }

        const { data: leads } = await leadsQuery;
        
        if (!leads || leads.length === 0) {
          cohortData.push({
            period: weekStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
            totalLeads: 0,
            day0: 0,
            day1: 0,
            day3: 0,
            day7: 0,
            day30: 0,
          });
          continue;
        }

        const leadIds = leads.map(l => l.id);

        // Get payments for these leads
        const { data: payments } = await supabase
          .from("payments")
          .select("lead_id, created_at")
          .in("lead_id", leadIds)
          .in("status", ["completed", "captured"]);

        // Calculate retention by days since lead creation
        let day0 = 0, day1 = 0, day3 = 0, day7 = 0, day30 = 0;

        leads.forEach(lead => {
          const leadDate = new Date(lead.created_at);
          const payment = payments?.find(p => p.lead_id === lead.id);
          
          if (payment) {
            const paymentDate = new Date(payment.created_at);
            const daysDiff = Math.floor((paymentDate.getTime() - leadDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 0) day0++;
            if (daysDiff <= 1) day1++;
            if (daysDiff <= 3) day3++;
            if (daysDiff <= 7) day7++;
            if (daysDiff <= 30) day30++;
          }
        });

        cohortData.push({
          period: weekStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          totalLeads: leads.length,
          day0,
          day1,
          day3,
          day7,
          day30,
        });
      }

      setCohorts(cohortData.reverse());
    } catch (error) {
      console.error("Error fetching cohort data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRetentionColor = (rate: number) => {
    if (rate >= 30) return "bg-green-500 text-white";
    if (rate >= 20) return "bg-green-400 text-white";
    if (rate >= 10) return "bg-yellow-400 text-black";
    if (rate >= 5) return "bg-orange-400 text-white";
    return "bg-red-400 text-white";
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Cohort Analysis</h3>
        </div>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (cohorts.length === 0 || cohorts.every(c => c.totalLeads === 0)) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Cohort Analysis</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <Users className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-xs">No cohort data available</p>
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Weekly Cohort Analysis</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">Payment conversion by time</p>
      </div>

      {/* Cohort Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left py-2 pr-2">Week</th>
              <th className="text-center py-2 px-1">Leads</th>
              <th className="text-center py-2 px-1">Day 0</th>
              <th className="text-center py-2 px-1">Day 1</th>
              <th className="text-center py-2 px-1">Day 3</th>
              <th className="text-center py-2 px-1">Day 7</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort, index) => (
              <motion.tr
                key={cohort.period}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-t border-border"
              >
                <td className="py-2 pr-2 font-medium">{cohort.period}</td>
                <td className="py-2 px-1 text-center">{cohort.totalLeads}</td>
                {[cohort.day0, cohort.day1, cohort.day3, cohort.day7].map((val, i) => {
                  const rate = cohort.totalLeads > 0 ? Math.round((val / cohort.totalLeads) * 100) : 0;
                  return (
                    <td key={i} className="py-2 px-1 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${getRetentionColor(rate)}`}>
                        {rate}%
                      </span>
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-center gap-4 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>&gt;30%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-400" />
            <span>10-30%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-400" />
            <span>&lt;10%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CohortAnalysisReport;
