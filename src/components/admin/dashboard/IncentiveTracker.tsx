import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatISTDate, startOfDayIST, endOfDayIST } from "@/lib/dateUtils";
import { Trophy, Target, TrendingUp, Star, Gift } from "lucide-react";

// Incentive slabs (per paid lead)
const INCENTIVE_SLABS = [
  { min: 0, max: 49, rate: 50 },
  { min: 50, max: 99, rate: 75 },
  { min: 100, max: 149, rate: 100 },
  { min: 150, max: 199, rate: 125 },
  { min: 200, max: Infinity, rate: 150 },
];

const IncentiveTracker = ({ currentUserId }: { currentUserId: string | null }) => {
  const { applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["incentive-tracker", currentUserId],
    enabled: !!currentUserId,
    queryFn: async () => {
      // Current month boundaries (IST)
      const now = new Date();
      const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const year = istNow.getUTCFullYear();
      const month = istNow.getUTCMonth(); // 0-based
      
      const monthStart = new Date(Date.UTC(year, month, 1) - 5.5 * 60 * 60 * 1000);
      const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59) - 5.5 * 60 * 60 * 1000);

      // Get leads assigned to this telecaller that got paid this month
      const { data: paidLeads } = await supabase.from("leads")
        .select("id")
        .eq("assigned_to", currentUserId!)
        .in("status", ["paid", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"]);

      const leadIds = (paidLeads || []).map(l => l.id);
      
      // Count unique leads with payments this month
      let monthlyPaidCount = 0;
      if (leadIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < leadIds.length; i += 100) chunks.push(leadIds.slice(i, i + 100));
        const paidSet = new Set<string>();
        await Promise.all(chunks.map(async chunk => {
          const { data: payments } = await supabase.from("payments")
            .select("lead_id")
            .in("lead_id", chunk)
            .in("status", ["completed", "captured"])
            .gte("created_at", monthStart.toISOString())
            .lte("created_at", monthEnd.toISOString());
          (payments || []).forEach(p => paidSet.add(p.lead_id));
        }));
        monthlyPaidCount = paidSet.size;
      }

      // Calculate current slab
      const currentSlab = INCENTIVE_SLABS.find(s => monthlyPaidCount >= s.min && monthlyPaidCount <= s.max) || INCENTIVE_SLABS[0];
      const earnedIncentive = monthlyPaidCount * currentSlab.rate;

      // Next milestone
      const nextSlabIndex = INCENTIVE_SLABS.indexOf(currentSlab) + 1;
      const nextSlab = nextSlabIndex < INCENTIVE_SLABS.length ? INCENTIVE_SLABS[nextSlabIndex] : null;
      const leadsToNext = nextSlab ? nextSlab.min - monthlyPaidCount : 0;

      // If they reach next slab, how much more they earn
      const projectedBonus = nextSlab ? (nextSlab.rate - currentSlab.rate) * monthlyPaidCount : 0;

      // Days left in month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const currentDay = istNow.getUTCDate();
      const daysLeft = daysInMonth - currentDay;

      // Daily target to reach next slab
      const dailyTarget = daysLeft > 0 && leadsToNext > 0 ? Math.ceil(leadsToNext / daysLeft) : 0;

      return {
        monthlyPaidCount,
        currentRate: currentSlab.rate,
        earnedIncentive,
        nextSlab,
        leadsToNext,
        projectedBonus,
        daysLeft,
        dailyTarget,
        monthName: new Date(year, month).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (isLoading || !data) return null;

  const progressPercent = data.nextSlab ? ((data.monthlyPaidCount - (INCENTIVE_SLABS[INCENTIVE_SLABS.indexOf(INCENTIVE_SLABS.find(s => s.rate === data.currentRate)!) || 0].min)) / (data.leadsToNext + data.monthlyPaidCount - (INCENTIVE_SLABS.find(s => s.rate === data.currentRate)?.min || 0))) * 100 : 100;

  return (
    <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          Incentive Tracker — {data.monthName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{data.monthlyPaidCount}</p>
            <p className="text-[10px] text-muted-foreground">Paid Leads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">₹{data.currentRate}</p>
            <p className="text-[10px] text-muted-foreground">Per Lead Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">₹{data.earnedIncentive.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">Earned So Far</p>
          </div>
        </div>

        {/* Progress to next slab */}
        {data.nextSlab && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Target className="w-3 h-3" />
                Next: ₹{data.nextSlab.rate}/lead
              </span>
              <span className="font-medium">{data.leadsToNext} more needed</span>
            </div>
            <div className="bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
            {data.dailyTarget > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500" />
                Target: {data.dailyTarget} leads/day for {data.daysLeft} days
                {data.projectedBonus > 0 && (
                  <span className="text-green-600 font-medium ml-1">
                    (+₹{data.projectedBonus} bonus at next slab)
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Slab table */}
        <div className="grid grid-cols-5 gap-1 text-center">
          {INCENTIVE_SLABS.map((slab, i) => (
            <div
              key={i}
              className={`rounded p-1.5 text-[9px] ${slab.rate === data.currentRate ? "bg-primary text-primary-foreground font-bold" : "bg-muted"}`}
            >
              <p>{slab.max === Infinity ? `${slab.min}+` : `${slab.min}-${slab.max}`}</p>
              <p className="font-semibold">₹{slab.rate}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default IncentiveTracker;
