import { FileCheck, CheckCircle, XCircle, Clock, FileText, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";

interface VerificationDashboardViewProps {
  currentUserId: string | null;
  dateFilter: string;
  dateEndFilter: string;
}

const VerificationDashboardView = ({ currentUserId, dateFilter, dateEndFilter }: VerificationDashboardViewProps) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data: stats } = useQuery({
    queryKey: ["verification-dashboard", currentUserId, dateFilter, dateEndFilter, companyId],
    enabled: !!currentUserId,
    queryFn: async () => {
      // Get ALL leads assigned to this verification user (no date filter - total queue)
      let baseQuery = supabase.from("leads").select("*")
        .eq("assigned_to", currentUserId!)
        .in("status", ["paid", "verification", "documents_pending", "documents_uploaded", "verified", "rejected"]);

      baseQuery = applyCompanyFilter(baseQuery);

      const { data: allLeads } = await baseQuery;
      const leads = allLeads || [];

      const queue = leads.filter(l => ["paid", "documents_pending", "documents_uploaded"].includes(l.status)).length;
      const verified = leads.filter(l => l.status === "verified").length;
      const rejected = leads.filter(l => l.status === "rejected").length;
      const docsPending = leads.filter(l => l.status === "documents_pending").length;
      const docsUploaded = leads.filter(l => l.status === "documents_uploaded").length;
      const paid = leads.filter(l => l.status === "paid").length;

      // Today's assigned: leads whose payment was made within the date range
      const allLeadIds = leads.map(l => l.id);
      let todayAssignedCount = 0;
      const todayAssignedLeadIds = new Set<string>();
      if (allLeadIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < allLeadIds.length; i += 100) {
          chunks.push(allLeadIds.slice(i, i + 100));
        }
        await Promise.all(chunks.map(async (chunk) => {
          const { data: paymentsData } = await supabase.from("payments")
            .select("lead_id")
            .in("lead_id", chunk)
            .in("status", ["completed", "captured"])
            .gte("created_at", dateFilter)
            .lte("created_at", dateEndFilter);
          (paymentsData || []).forEach(p => todayAssignedLeadIds.add(p.lead_id));
        }));
        todayAssignedCount = todayAssignedLeadIds.size;
      }

      // Today's verified/rejected by activity log date
      const { data: todayVerifiedLogs } = await supabase.from("activity_logs")
        .select("lead_id, action")
        .eq("user_id", currentUserId!)
        .in("action", ["lead_verified", "lead_rejected"])
        .gte("created_at", dateFilter)
        .lte("created_at", dateEndFilter);

      const todayVerified = (todayVerifiedLogs || []).filter(l => l.action === "lead_verified").length;
      const todayRejected = (todayVerifiedLogs || []).filter(l => l.action === "lead_rejected").length;

      // Get recent activity
      const { data: recentLogs } = await supabase.from("activity_logs")
        .select("action, created_at, lead_id")
        .eq("user_id", currentUserId!)
        .in("action", ["lead_verified", "lead_rejected", "document_verified"])
        .order("created_at", { ascending: false })
        .limit(10);

      return {
        queue, verified, rejected, docsPending, docsUploaded, paid,
        todayAssigned: todayAssignedCount, todayVerified, todayRejected,
        totalAssigned: leads.length,
        recentActivity: recentLogs || [],
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const s = stats || { queue: 0, verified: 0, rejected: 0, docsPending: 0, docsUploaded: 0, paid: 0, todayAssigned: 0, todayVerified: 0, todayRejected: 0, totalAssigned: 0, recentActivity: [] };

  return (
    <div className="space-y-3">
      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { value: s.todayAssigned, label: "Orders Today", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", icon: <Calendar className="w-3.5 h-3.5" /> },
          { value: s.queue, label: "Review Queue", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", icon: <Clock className="w-3.5 h-3.5" /> },
        ].map((item) => (
          <div key={item.label} className={`p-3 rounded-xl ${item.bg} text-center`}>
            <div className={`flex justify-center mb-0.5 ${item.color}`}>{item.icon}</div>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { value: s.verified, label: "Approved", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", icon: <CheckCircle className="w-3.5 h-3.5" /> },
          { value: s.rejected, label: "Cancelled", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", icon: <XCircle className="w-3.5 h-3.5" /> },
          { value: s.totalAssigned, label: "Total", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", icon: <FileCheck className="w-3.5 h-3.5" /> },
        ].map((item) => (
          <div key={item.label} className={`p-2 sm:p-3 rounded-xl ${item.bg} text-center`}>
            <div className={`flex justify-center mb-0.5 ${item.color}`}>{item.icon}</div>
            <p className={`text-lg sm:text-xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Queue Breakdown */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-card rounded-xl border border-border p-2 sm:p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{s.paid}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">New Orders</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2 sm:p-3 text-center">
          <p className="text-lg font-bold text-yellow-600">{s.docsPending}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Pmt Pending</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2 sm:p-3 text-center">
          <p className="text-lg font-bold text-cyan-600">{s.docsUploaded}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Pmt Confirmed</p>
        </div>
      </div>

      {/* Today's Performance */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border border-green-200 dark:border-green-800 p-3">
        <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-2">Today's Activity (by date filter)</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-green-600">{s.todayVerified}</p>
            <p className="text-[9px] text-muted-foreground">Approved</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{s.todayRejected}</p>
            <p className="text-[9px] text-muted-foreground">Cancelled</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {s.recentActivity.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs font-semibold mb-2">Recent Activity</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {s.recentActivity.map((log: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {log.action === "lead_verified" ? (
                  <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                )}
                <span className="text-muted-foreground">
                  {log.action.replace(/_/g, " ")} •{" "}
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

export default VerificationDashboardView;
