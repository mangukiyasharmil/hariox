import { Gift, Phone, Target, TrendingUp } from "lucide-react";
import type { PersonalStats } from "@/hooks/useDashboardData";
import UnifiedTelecallerReport from "../reports/UnifiedTelecallerReport";
import StaffLeaderboard from "./StaffLeaderboard";
import DailyTargetsCard from "./DailyTargetsCard";
import FollowUpReminders from "./FollowUpReminders";

interface StaffDashboardViewProps {
  personalStats: PersonalStats;
  currentUserId: string | null;
  dateFilter: string;
  dateEndFilter: string;
}

const StaffDashboardView = ({ personalStats, currentUserId, dateFilter, dateEndFilter }: StaffDashboardViewProps) => {
  return (
    <div className="space-y-2">
      {/* Daily Targets */}
      <DailyTargetsCard currentUserId={currentUserId} dateFilter={dateFilter} dateEndFilter={dateEndFilter} />

      {/* Follow-up Reminders */}
      <FollowUpReminders currentUserId={currentUserId} isAdmin={false} />

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { value: personalStats.assignedLeads, label: "Assigned", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
          { value: personalStats.paidLeads, label: "Paid", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
          { value: `${personalStats.conversionRate}%`, label: "Rate", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
          { value: personalStats.monthlyPaidLeads, label: "MTD Paid", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
        ].map((s) => (
          <div key={s.label} className={`p-2 sm:p-3 rounded-xl ${s.bg} text-center`}>
            <p className={`text-lg sm:text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Incentive + Calls Row */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200 dark:border-amber-800 p-2 sm:p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Gift className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] sm:text-xs font-medium text-amber-800 dark:text-amber-200">Incentive</span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-green-600">₹{personalStats.earnedIncentive.toLocaleString()}</span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-300 flex gap-1.5">
            <span>{personalStats.monthlyPaidLeads} paid</span>
            <span>•</span>
            <span>{personalStats.currentIncentiveRate > 0 ? `₹${personalStats.currentIncentiveRate}/lead` : "150 to start"}</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-2 sm:p-3">
          <div className="flex items-center gap-1 mb-1">
            <Phone className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] sm:text-xs font-medium">Calls: {personalStats.totalCalls}</span>
          </div>
          <div className="grid grid-cols-4 gap-0.5 text-center text-[9px]">
            <div><p className="font-bold text-green-600">{personalStats.connectedCalls}</p><p className="text-muted-foreground">OK</p></div>
            <div><p className="font-bold text-orange-600">{personalStats.busyCalls}</p><p className="text-muted-foreground">Busy</p></div>
            <div><p className="font-bold text-red-600">{personalStats.noAnswerCalls}</p><p className="text-muted-foreground">NA</p></div>
            <div><p className="font-bold text-gray-600">{personalStats.switchedOffCalls}</p><p className="text-muted-foreground">Off</p></div>
          </div>
        </div>
      </div>

      {/* Live Leaderboard */}
      <StaffLeaderboard currentUserId={currentUserId} dateFilter={dateFilter} dateEndFilter={dateEndFilter} />

      {/* Telecaller Performance */}
      <UnifiedTelecallerReport startDate={new Date(dateFilter)} endDate={new Date(dateEndFilter)} />
    </div>
  );
};

export default StaffDashboardView;
