import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatISTDate, startOfDayIST, endOfDayIST, getISTDateNDaysAgo } from "@/lib/dateUtils";
import { Sun, Trophy, PhoneCall, Clock, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";

const MorningBriefingCard = ({ currentUserId }: { currentUserId: string | null }) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["morning-briefing", companyId, currentUserId],
    queryFn: async () => {
      const todayIST = formatISTDate(new Date());
      const yesterdayIST = getISTDateNDaysAgo(1);
      const todayStart = startOfDayIST(todayIST).toISOString();
      const todayEnd = endOfDayIST(todayIST).toISOString();
      const yesterdayStart = startOfDayIST(yesterdayIST).toISOString();
      const yesterdayEnd = endOfDayIST(yesterdayIST).toISOString();

      const [todayLeadsRes, yesterdayLeadsRes, todayPayRes, yesterdayPayRes, followUpsRes, hotLeadsRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("leads").select("*", { count: "exact", head: true })
            .gte("created_at", todayStart).lte("created_at", todayEnd)
        ),
        applyCompanyFilter(
          supabase.from("leads").select("*", { count: "exact", head: true })
            .gte("created_at", yesterdayStart).lte("created_at", yesterdayEnd)
        ),
        applyCompanyFilter(
          supabase.from("payments").select("total_amount")
            .in("status", ["completed", "captured"])
            .gte("created_at", todayStart).lte("created_at", todayEnd)
        ),
        applyCompanyFilter(
          supabase.from("payments").select("total_amount")
            .in("status", ["completed", "captured"])
            .gte("created_at", yesterdayStart).lte("created_at", yesterdayEnd)
        ),
        // Today's follow-ups
        applyCompanyFilter(
          supabase.from("leads").select("id, full_name, phone, follow_up_date, loan_amount", { count: "exact" })
            .gte("follow_up_date", todayStart).lte("follow_up_date", todayEnd)
            .in("status", ["unpaid", "paid", "documents_pending"])
            .order("follow_up_date", { ascending: true })
            .limit(10)
        ),
        // Hot leads: high income, recent, unpaid
        applyCompanyFilter(
          supabase.from("leads").select("id, full_name, phone, loan_amount, monthly_income, created_at", { count: "exact" })
            .eq("status", "unpaid")
            .gte("monthly_income", 30000)
            .gte("created_at", startOfDayIST(getISTDateNDaysAgo(3)).toISOString())
            .order("monthly_income", { ascending: false })
            .limit(5)
        ),
      ]);

      const todayLeads = todayLeadsRes.count || 0;
      const yesterdayLeads = yesterdayLeadsRes.count || 0;
      const todayRevenue = (todayPayRes.data || []).reduce((s, p) => s + Number(p.total_amount), 0);
      const yesterdayRevenue = (yesterdayPayRes.data || []).reduce((s, p) => s + Number(p.total_amount), 0);
      const followUps = followUpsRes.data || [];
      const followUpCount = followUpsRes.count || 0;
      const hotLeads = hotLeadsRes.data || [];

      const leadTrend = yesterdayLeads > 0 ? ((todayLeads - yesterdayLeads) / yesterdayLeads) * 100 : 0;
      const revTrend = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

      // Greeting based on IST hour
      const istHour = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
      const greeting = istHour < 12 ? "Good Morning" : istHour < 17 ? "Good Afternoon" : "Good Evening";

      return { todayLeads, todayRevenue, leadTrend, revTrend, followUps, followUpCount, hotLeads, greeting, yesterdayRevenue };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (isLoading || !data) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sun className="w-4 h-4 text-yellow-500" />
          {data.greeting}! Today's Briefing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Today's Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card rounded-lg p-2 border border-border">
            <p className="text-[10px] text-muted-foreground">Today's Leads</p>
            <div className="flex items-center gap-1">
              <p className="text-lg font-bold">{data.todayLeads}</p>
              {data.leadTrend !== 0 && (
                <span className={`text-[10px] ${data.leadTrend > 0 ? "text-green-600" : "text-red-500"}`}>
                  {data.leadTrend > 0 ? "↑" : "↓"}{Math.abs(data.leadTrend).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-card rounded-lg p-2 border border-border">
            <p className="text-[10px] text-muted-foreground">Today's Revenue</p>
            <div className="flex items-center gap-1">
              <p className="text-lg font-bold">₹{(data.todayRevenue / 1000).toFixed(1)}K</p>
              {data.revTrend !== 0 && (
                <span className={`text-[10px] ${data.revTrend > 0 ? "text-green-600" : "text-red-500"}`}>
                  {data.revTrend > 0 ? "↑" : "↓"}{Math.abs(data.revTrend).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Follow-ups */}
        {data.followUpCount > 0 && (
          <div>
            <p className="text-xs font-medium flex items-center gap-1 mb-1.5">
              <Clock className="w-3 h-3 text-orange-500" />
              Follow-ups Today ({data.followUpCount})
            </p>
            <div className="space-y-1">
              {data.followUps.slice(0, 3).map(f => (
                <div key={f.id} className="flex items-center justify-between text-[11px] bg-orange-500/5 rounded px-2 py-1">
                  <span className="font-medium truncate max-w-[120px]">{f.full_name}</span>
                  <span className="text-muted-foreground">₹{Number(f.loan_amount).toLocaleString("en-IN")}</span>
                </div>
              ))}
              {data.followUpCount > 3 && (
                <p className="text-[10px] text-muted-foreground text-center">+{data.followUpCount - 3} more</p>
              )}
            </div>
          </div>
        )}

        {/* Hot Leads */}
        {data.hotLeads.length > 0 && (
          <div>
            <p className="text-xs font-medium flex items-center gap-1 mb-1.5">
              <TrendingUp className="w-3 h-3 text-green-500" />
              🔥 Hot Leads (High Income, Recent)
            </p>
            <div className="space-y-1">
              {data.hotLeads.slice(0, 3).map(l => (
                <div key={l.id} className="flex items-center justify-between text-[11px] bg-green-500/5 rounded px-2 py-1">
                  <span className="font-medium truncate max-w-[120px]">{l.full_name}</span>
                  <span className="text-muted-foreground">₹{Number(l.monthly_income).toLocaleString("en-IN")}/m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MorningBriefingCard;
