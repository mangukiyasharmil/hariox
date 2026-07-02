import { Building2, CheckCircle, Send, IndianRupee, XCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";

interface LoginTeamDashboardViewProps {
  currentUserId: string | null;
  dateFilter: string;
  dateEndFilter: string;
}

const LoginTeamDashboardView = ({ currentUserId, dateFilter, dateEndFilter }: LoginTeamDashboardViewProps) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data: stats } = useQuery({
    queryKey: ["login-team-dashboard", currentUserId, dateFilter, dateEndFilter, companyId],
    enabled: !!currentUserId,
    queryFn: async () => {
      let baseQuery = supabase.from("leads").select("*")
        .eq("assigned_to", currentUserId!)
        .in("status", ["verified", "processing", "approved", "disbursed", "rejected"]);

      baseQuery = applyCompanyFilter(baseQuery);

      const { data: allLeads } = await baseQuery;
      const leads = allLeads || [];

      const verified = leads.filter(l => l.status === "verified").length;
      const processing = leads.filter(l => l.status === "processing").length;
      const approved = leads.filter(l => l.status === "approved").length;
      const disbursed = leads.filter(l => l.status === "disbursed").length;
      const rejected = leads.filter(l => l.status === "rejected").length;

      // Today's stats based on activity log date, not lead created_at
      const { data: todayLogs } = await supabase.from("activity_logs")
        .select("action, details")
        .eq("user_id", currentUserId!)
        .in("action", ["submitted_to_bank", "lead_marked_lost"])
        .gte("created_at", dateFilter)
        .lte("created_at", dateEndFilter);

      const todayProcessing = (todayLogs || []).filter(l => l.action === "submitted_to_bank").length;

      // Today's approved/disbursed from bank_submissions updated today
      const { data: todaySubmissions } = await supabase.from("bank_submissions")
        .select("status")
        .eq("submitted_by", currentUserId!)
        .in("status", ["approved", "disbursed"])
        .gte("updated_at", dateFilter)
        .lte("updated_at", dateEndFilter);

      const todayApproved = (todaySubmissions || []).filter(s => s.status === "approved").length;
      const todayDisbursed = (todaySubmissions || []).filter(s => s.status === "disbursed").length;

      // Get bank submissions
      const { data: submissions } = await supabase.from("bank_submissions")
        .select("bank_name, status")
        .eq("submitted_by", currentUserId!);

      const bankStats = (submissions || []).reduce((acc: Record<string, { submitted: number; approved: number; rejected: number }>, s) => {
        if (!acc[s.bank_name]) acc[s.bank_name] = { submitted: 0, approved: 0, rejected: 0 };
        acc[s.bank_name].submitted++;
        if (s.status === "approved" || s.status === "disbursed") acc[s.bank_name].approved++;
        if (s.status === "rejected") acc[s.bank_name].rejected++;
        return acc;
      }, {});

      // Recent activity
      const { data: recentLogs } = await supabase.from("activity_logs")
        .select("action, created_at, details")
        .eq("user_id", currentUserId!)
        .in("action", ["submitted_to_bank", "lead_marked_lost"])
        .order("created_at", { ascending: false })
        .limit(10);

      return {
        verified, processing, approved, disbursed, rejected,
        todayProcessing, todayApproved, todayDisbursed,
        totalAssigned: leads.length,
        bankStats,
        recentActivity: recentLogs || [],
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const s = stats || { verified: 0, processing: 0, approved: 0, disbursed: 0, rejected: 0, todayProcessing: 0, todayApproved: 0, todayDisbursed: 0, totalAssigned: 0, bankStats: {}, recentActivity: [] };

  return (
    <div className="space-y-3">
      {/* Main Stats */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { value: s.verified, label: "Pending", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", icon: <Clock className="w-3.5 h-3.5" /> },
          { value: s.processing, label: "Processing", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", icon: <Send className="w-3.5 h-3.5" /> },
          { value: s.approved, label: "Approved", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", icon: <CheckCircle className="w-3.5 h-3.5" /> },
          { value: s.disbursed, label: "Disbursed", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30", icon: <IndianRupee className="w-3.5 h-3.5" /> },
        ].map((item) => (
          <div key={item.label} className={`p-2 sm:p-3 rounded-xl ${item.bg} text-center`}>
            <div className={`flex justify-center mb-0.5 ${item.color}`}>{item.icon}</div>
            <p className={`text-lg sm:text-xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Today's Performance */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-200 dark:border-blue-800 p-3">
        <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">Today's Activity</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-yellow-600">{s.todayProcessing}</p>
            <p className="text-[9px] text-muted-foreground">Submitted</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{s.todayApproved}</p>
            <p className="text-[9px] text-muted-foreground">Approved</p>
          </div>
          <div>
            <p className="text-lg font-bold text-teal-600">{s.todayDisbursed}</p>
            <p className="text-[9px] text-muted-foreground">Disbursed</p>
          </div>
        </div>
      </div>

      {/* Bank-wise Stats */}
      {Object.keys(s.bankStats).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs font-semibold mb-2">Bank-wise Performance</p>
          <div className="space-y-1.5">
            {Object.entries(s.bankStats).map(([bank, data]: [string, any]) => (
              <div key={bank} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium">{bank}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{data.submitted} sent</span>
                  <span className="text-green-600">{data.approved} ✓</span>
                  <span className="text-red-600">{data.rejected} ✗</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejection + Total */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-card rounded-xl border border-border p-2 sm:p-3 text-center">
          <p className="text-lg font-bold text-red-600">{s.rejected}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Rejected</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2 sm:p-3 text-center">
          <p className="text-lg font-bold text-purple-600">{s.totalAssigned}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Total Assigned</p>
        </div>
      </div>

      {/* Recent Activity */}
      {s.recentActivity.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs font-semibold mb-2">Recent Activity</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {s.recentActivity.map((log: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Send className="w-3 h-3 text-primary flex-shrink-0" />
                <span className="text-muted-foreground truncate">
                  {log.action.replace(/_/g, " ")}
                  {log.details?.bank ? ` → ${log.details.bank}` : ""} •{" "}
                  {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginTeamDashboardView;
