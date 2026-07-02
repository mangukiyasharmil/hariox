import { Users, Target } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import DropoffAnalysisReport from "./DropoffAnalysisReport";
import CohortAnalysisReport from "./CohortAnalysisReport";
import FullFunnelTrendChart from "./FullFunnelTrendChart";

interface LeadsByStatus {
  status: string;
  count: number;
}

interface LeadsByLoanType {
  type: string;
  count: number;
}

interface MonthlyTrend {
  month: string;
  leads: number;
  paid: number;
}

interface ConversionFunnel {
  stage: string;
  count: number;
}

interface LeadAnalyticsReportProps {
  leadsByStatus: LeadsByStatus[];
  leadsByLoanType: LeadsByLoanType[];
  monthlyTrend: MonthlyTrend[];
  conversionFunnel: ConversionFunnel[];
  dateFilter?: string;
  dateEndFilter?: string;
  filteredLeadsCount?: number;
  filteredPaidCount?: number;
  dateLabel?: string;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

const STATUS_COLORS: Record<string, string> = {
  unpaid: "#94a3b8",
  paid: "#22c55e",
  verification: "#3b82f6",
  documents_pending: "#f59e0b",
  documents_uploaded: "#8b5cf6",
  verified: "#10b981",
  rejected: "#ef4444",
  processing: "#6366f1",
  approved: "#14b8a6",
  disbursed: "#06b6d4",
  lost: "#6b7280",
};

const LeadAnalyticsReport = ({
  leadsByStatus,
  leadsByLoanType,
  monthlyTrend,
  conversionFunnel,
  dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  dateEndFilter,
  filteredLeadsCount,
  filteredPaidCount,
  dateLabel,
}: LeadAnalyticsReportProps) => {
  const totalLeads = conversionFunnel[0]?.count || 0;

  return (
    <div className="space-y-6">
      {/* Full Funnel Trend Chart */}
      <FullFunnelTrendChart 
        dateFilter={dateFilter} 
        dateEndFilter={dateEndFilter} 
      />
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Conversion Funnel
          </h3>
          <div className="space-y-3">
            {conversionFunnel.map((stage, index) => {
              const percentage = totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0;
              return (
                <div key={stage.stage} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stage.stage}</span>
                    <span className="text-muted-foreground">{stage.count} ({percentage}%)</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leads by Loan Type - Pie Chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Leads by Loan Type
          </h3>
          {leadsByLoanType.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadsByLoanType}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="type"
                    label={({ type, percent }) => `${type} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {leadsByLoanType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-muted-foreground">
              No loan type data
            </div>
          )}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4">Leads by Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {leadsByStatus.map((s) => (
            <div 
              key={s.status} 
              className="rounded-lg p-3 text-center transition-all hover:scale-105"
              style={{ 
                backgroundColor: `${STATUS_COLORS[s.status] || '#94a3b8'}15`,
                borderLeft: `3px solid ${STATUS_COLORS[s.status] || '#94a3b8'}`
              }}
            >
              <p className="text-2xl font-bold" style={{ color: STATUS_COLORS[s.status] || '#94a3b8' }}>
                {s.count}
              </p>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                {s.status.replace(/_/g, " ")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Drop-off Analysis - Full Width */}
      <DropoffAnalysisReport dateFilter={dateFilter} dateEndFilter={dateEndFilter} />

      <CohortAnalysisReport />
    </div>
  );
};

export default LeadAnalyticsReport;
