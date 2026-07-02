import { Trophy, Target, Flame, Medal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatISTDate, startOfDayIST, endOfDayIST } from "@/lib/dateUtils";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";

interface StaffLeaderboardProps {
  currentUserId: string | null;
  dateFilter: string;
  dateEndFilter: string;
}

interface TelecallerStats {
  userId: string;
  name: string;
  paidToday: number;
  callsToday: number;
  assigned: number;
}

const DAILY_TARGET = 5; // Daily paid target

const StaffLeaderboard = ({ currentUserId, dateFilter, dateEndFilter }: StaffLeaderboardProps) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["staff-leaderboard", dateFilter, dateEndFilter, companyId],
    queryFn: async (): Promise<TelecallerStats[]> => {
      // Get all telecallers
      const { data: telecallerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "telecaller");

      if (!telecallerRoles?.length) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      const userIds = telecallerRoles.map(r => r.user_id);

      // Fetch paid counts and call counts in parallel for all telecallers
      const stats = await Promise.all(userIds.map(async (userId) => {
        // Use assignment history to find ALL leads ever assigned (paid leads get reassigned)
        const { data: historyData } = await supabase
          .from("lead_assignment_history")
          .select("lead_id")
          .eq("assigned_to", userId)
          .limit(5000);
        
        let currentQuery = supabase.from("leads").select("id").eq("assigned_to", userId);
        currentQuery = applyCompanyFilter(currentQuery);
        const { data: currentData } = await currentQuery;
        
        const allLeadIds = [...new Set([
          ...(historyData || []).map(h => h.lead_id),
          ...(currentData || []).map(l => l.id),
        ])];

        // Filter to company if needed
        let filteredIds = allLeadIds;
        if (companyId && allLeadIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < allLeadIds.length; i += 100) chunks.push(allLeadIds.slice(i, i + 100));
          const validIds: string[] = [];
          await Promise.all(chunks.map(async (chunk) => {
            const { data } = await supabase.from("leads").select("id").in("id", chunk).eq("company_id", companyId);
            (data || []).forEach(l => validIds.push(l.id));
          }));
          filteredIds = validIds;
        }

        let paidCount = 0;
        if (filteredIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < filteredIds.length; i += 100) chunks.push(filteredIds.slice(i, i + 100));
          const paidIds = new Set<string>();
          await Promise.all(chunks.map(async (chunk) => {
            const { data: payments } = await supabase.from("payments")
              .select("lead_id").in("lead_id", chunk)
              .in("status", ["completed", "captured"])
              .gte("created_at", dateFilter)
              .lte("created_at", dateEndFilter);
            (payments || []).forEach(p => paidIds.add(p.lead_id));
          }));
          paidCount = paidIds.size;
        }

        // Get assigned leads count (unpaid), filtered by company
        let unpaidQuery = supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", userId)
          .eq("status", "unpaid");
        unpaidQuery = applyCompanyFilter(unpaidQuery);
        const { count: assignedCount } = await unpaidQuery;

        // Get calls today, filtered by company
        let callQuery = supabase
          .from("call_logs")
          .select("*", { count: "exact", head: true })
          .eq("caller_id", userId)
          .gte("created_at", dateFilter)
          .lte("created_at", dateEndFilter);
        if (companyId) callQuery = callQuery.eq("company_id", companyId);
        const { count: callCount } = await callQuery;

        return {
          userId,
          name: profileMap.get(userId) || "Unknown",
          paidToday: paidCount || 0,
          callsToday: callCount || 0,
          assigned: assignedCount || 0,
        };
      }));

      // Sort by paid (desc), then calls (desc)
      return stats.sort((a, b) => b.paidToday - a.paidToday || b.callsToday - a.callsToday);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!leaderboard.length) return null;

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (index === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (index === 2) return <Medal className="w-4 h-4 text-amber-700" />;
    return <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">#{index + 1}</span>;
  };

  return (
    <div className="bg-card rounded-xl border border-border p-2 sm:p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-orange-500" />
          <h3 className="text-xs sm:text-sm font-bold">Live Leaderboard</h3>
        </div>
        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
          <Target className="w-3 h-3" />
          <span>Target: {DAILY_TARGET} paid/day</span>
        </div>
      </div>

      <div className="space-y-1">
        {leaderboard.map((staff, index) => {
          const isCurrentUser = staff.userId === currentUserId;
          const progress = Math.min((staff.paidToday / DAILY_TARGET) * 100, 100);
          const targetMet = staff.paidToday >= DAILY_TARGET;

          return (
            <div
              key={staff.userId}
              className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors ${
                isCurrentUser
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/50"
              }`}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-5 flex justify-center">
                {getRankIcon(index)}
              </div>

              {/* Name & Progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] sm:text-xs font-medium truncate ${isCurrentUser ? "text-primary" : ""}`}>
                    {staff.name} {isCurrentUser ? "(You)" : ""}
                  </span>
                  <div className="flex items-center gap-2 text-[9px] sm:text-[10px]">
                    <span className="text-muted-foreground">{staff.callsToday} calls</span>
                    <span className={`font-bold ${targetMet ? "text-green-600" : "text-foreground"}`}>
                      {staff.paidToday} paid
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-muted rounded-full mt-0.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      targetMet
                        ? "bg-gradient-to-r from-green-500 to-emerald-400"
                        : "bg-gradient-to-r from-primary/70 to-primary"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Target badge */}
              {targetMet && (
                <span className="text-[8px] bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-1 py-0.5 rounded font-bold flex-shrink-0">
                  ✓ TARGET
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StaffLeaderboard;
