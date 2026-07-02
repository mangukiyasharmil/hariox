import { useState, useEffect, useCallback } from "react";
import { RefreshCw, TrendingUp, CheckCircle2, Clock, BarChart3, Users, Calendar, ArrowRight, XCircle, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

// SMS Schedule reference - matches edge function
const SMS_SCHEDULE = [
  { sms: 1, day: 0, time: "10:00 AM", label: "Day 0" },
  { sms: 2, day: 0, time: "8:30 PM", label: "Day 0" },
  { sms: 3, day: 1, time: "11:00 AM", label: "Day 1" },
  { sms: 4, day: 1, time: "7:00 PM", label: "Day 1" },
  { sms: 5, day: 2, time: "12:00 PM", label: "Day 2" },
  { sms: 6, day: 3, time: "8:00 PM", label: "Day 3" },
  { sms: 7, day: 4, time: "11:00 AM", label: "Day 4" },
  { sms: 8, day: 5, time: "8:30 PM", label: "Day 5" },
  { sms: 9, day: 6, time: "12:00 PM", label: "Day 6" },
  { sms: 10, day: 7, time: "7:00 PM", label: "Day 7" },
];

interface CycleRow {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  sms_sent_count: number;
  status: string;
  start_date: string;
  last_sms_sent_at: string | null;
  company_slug: string;
}

const RemarketingCycleReport = () => {
  const [summary, setSummary] = useState({ active: 0, stopped: 0, completed: 0, total: 0 });
  const [todayStats, setTodayStats] = useState({ newCycles: 0, smsSentToday: 0, stoppedToday: 0 });
  const [yesterdayStats, setYesterdayStats] = useState({ smsSent: 0, stopped: 0 });
  const [progressBreakdown, setProgressBreakdown] = useState<{ count: number; label: string }[]>([]);
  const [activeCycles, setActiveCycles] = useState<CycleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const todayISO = todayStart.toISOString();
      const yesterdayISO = yesterdayStart.toISOString();

      // Parallel fetches
      const [allCyclesRes, todaySmsRes, yesterdaySmsRes, todayCyclesRes, yesterdayStoppedRes, activeCyclesRes] = await Promise.all([
        supabase.from("remarketing_cycles").select("status, sms_sent_count", { count: "exact" }).limit(50000),
        supabase.from("sms_logs").select("id", { count: "exact" }).eq("sms_type", "remarketing").gte("sent_at", todayISO).limit(1),
        supabase.from("sms_logs").select("id", { count: "exact" }).eq("sms_type", "remarketing").gte("sent_at", yesterdayISO).lt("sent_at", todayISO).limit(1),
        supabase.from("remarketing_cycles").select("id", { count: "exact" }).gte("start_date", todayISO).limit(1),
        supabase.from("remarketing_cycles").select("id", { count: "exact" }).eq("status", "stopped").gte("updated_at", yesterdayISO).lt("updated_at", todayISO).limit(1),
        supabase.from("remarketing_cycles").select("id, lead_id, company_id, sms_sent_count, status, start_date, last_sms_sent_at").eq("status", "active").order("start_date", { ascending: false }).limit(10000),
      ]);

      // Summary
      const all = allCyclesRes.data || [];
      const s = { active: 0, stopped: 0, completed: 0, total: allCyclesRes.count || all.length };
      const progressMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
      all.forEach(c => {
        if (c.status === "active") { s.active++; progressMap[c.sms_sent_count] = (progressMap[c.sms_sent_count] || 0) + 1; }
        else if (c.status === "stopped") s.stopped++;
        else if (c.status === "completed") s.completed++;
      });
      setSummary(s);

      setProgressBreakdown([
        { label: "Waiting SMS 1", count: progressMap[0] || 0 },
        { label: "Sent 1/10", count: progressMap[1] || 0 },
        { label: "Sent 2/10", count: progressMap[2] || 0 },
        { label: "Sent 3/10", count: progressMap[3] || 0 },
        { label: "Sent 4/10", count: progressMap[4] || 0 },
        { label: "Sent 5/10", count: progressMap[5] || 0 },
        { label: "Sent 6/10", count: progressMap[6] || 0 },
        { label: "Sent 7/10", count: progressMap[7] || 0 },
        { label: "Sent 8/10", count: progressMap[8] || 0 },
        { label: "Sent 9/10", count: progressMap[9] || 0 },
      ]);

      // Today/Yesterday stats
      setTodayStats({
        newCycles: todayCyclesRes.count || 0,
        smsSentToday: todaySmsRes.count || 0,
        stoppedToday: 0,
      });
      setYesterdayStats({
        smsSent: yesterdaySmsRes.count || 0,
        stopped: yesterdayStoppedRes.count || 0,
      });

      // Active cycles with lead info
      const activeData = activeCyclesRes.data || [];
      if (activeData.length > 0) {
        const leadIds = activeData.map(c => c.lead_id);
        const companyIds = [...new Set(activeData.map(c => c.company_id).filter(Boolean))];
        
        const [leadsRes, companiesRes] = await Promise.all([
          supabase.from("leads").select("id, full_name, phone").in("id", leadIds),
          companyIds.length > 0 ? supabase.from("companies").select("id, slug").in("id", companyIds as string[]) : Promise.resolve({ data: [] }),
        ]);

        const leadsMap = new Map((leadsRes.data || []).map(l => [l.id, l]));
        const companiesMap: Record<string, string> = {};
        (companiesRes.data || []).forEach((c: any) => { companiesMap[c.id] = c.slug; });

        setActiveCycles(activeData.map(c => {
          const lead = leadsMap.get(c.lead_id);
          return {
            id: c.id,
            lead_id: c.lead_id,
            lead_name: lead?.full_name || "Unknown",
            lead_phone: lead?.phone || "",
            sms_sent_count: c.sms_sent_count,
            status: c.status,
            start_date: c.start_date,
            last_sms_sent_at: c.last_sms_sent_at,
            company_slug: c.company_id ? (companiesMap[c.company_id] || "hariox") : "hariox",
          };
        }));
      } else {
        setActiveCycles([]);
      }
    } catch (err) {
      console.error("Error fetching remarketing data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getCycleDayNumber = (startDate: string) => {
    const days = Math.floor((Date.now() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000));
    return days;
  };

  const getNextSMSInfo = (count: number, startDate: string) => {
    if (count >= 10) return { text: "Completed", isOverdue: false, missedCount: 0 };
    const next = SMS_SCHEDULE[count];
    if (!next) return { text: "—", isOverdue: false, missedCount: 0 };
    const cycleDay = getCycleDayNumber(startDate);
    
    if (cycleDay > next.day) {
      // Count how many SMS were supposed to be sent by now but weren't
      let missedCount = 0;
      for (let i = count; i < SMS_SCHEDULE.length; i++) {
        if (cycleDay > SMS_SCHEDULE[i].day || (cycleDay === SMS_SCHEDULE[i].day)) {
          missedCount++;
        } else break;
      }
      const daysOverdue = cycleDay - next.day;
      return { 
        text: `SMS #${next.sms} overdue by ${daysOverdue}d (${missedCount} not sent)`, 
        isOverdue: true, 
        missedCount 
      };
    }
    if (cycleDay === next.day) return { text: `SMS #${next.sms} at ${next.time} (today)`, isOverdue: false, missedCount: 0 };
    return { text: `SMS #${next.sms} on ${next.label} at ${next.time}`, isOverdue: false, missedCount: 0 };
  };

  const formatDateTime = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Remarketing Cycle Overview
        </h3>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* SMS Schedule Reference */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">📋 10-SMS Remarketing Cycle (Day 0 = Lead Created Day)</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-wrap gap-1">
            {SMS_SCHEDULE.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="bg-primary/10 border border-primary/20 rounded px-2 py-1 text-xs">
                  <span className="font-semibold text-primary">SMS {s.sms}</span>
                  <span className="text-muted-foreground ml-1">{s.label} · {s.time}</span>
                </div>
                {i < SMS_SCHEDULE.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Today vs Yesterday */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold">Today</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">New Cycles</p>
                <p className="text-xl font-bold text-blue-600">{todayStats.newCycles}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SMS Sent</p>
                <p className="text-xl font-bold text-green-600">{todayStats.smsSentToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Yesterday</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">SMS Sent</p>
                <p className="text-xl font-bold">{yesterdayStats.smsSent}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stopped (Paid)</p>
                <p className="text-xl font-bold text-orange-600">{yesterdayStats.stopped}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-lg font-bold text-blue-600">{summary.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3 flex items-center gap-3">
            <StopCircle className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Stopped (Paid)</p>
              <p className="text-lg font-bold text-orange-600">{summary.stopped}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Completed (10/10)</p>
              <p className="text-lg font-bold text-green-600">{summary.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Cycles</p>
              <p className="text-lg font-bold">{summary.total}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Cycles by SMS Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Active Cycles Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {progressBreakdown.map((p, i) => {
              const maxCount = Math.max(...progressBreakdown.map(x => x.count), 1);
              const barWidth = (p.count / maxCount) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{p.label}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                      style={{
                        width: `${barWidth}%`,
                        minWidth: p.count > 0 ? "30px" : "0",
                        backgroundColor: i === 0 ? "hsl(var(--muted-foreground) / 0.3)" : `hsl(${200 + i * 25}, 70%, ${55 - i * 5}%)`,
                      }}
                    >
                      {p.count > 0 && <span className="text-[11px] font-bold text-white">{p.count}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Cycles Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Active Cycles ({activeCycles.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground">Lead</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Company</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Cycle Day</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">SMS Progress</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Next SMS</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Last Sent</th>
                </tr>
              </thead>
              <tbody>
                {activeCycles.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No active cycles</td></tr>
                ) : (
                  activeCycles.map(cycle => {
                    const dayNum = getCycleDayNumber(cycle.start_date);
                    const nextInfo = getNextSMSInfo(cycle.sms_sent_count, cycle.start_date);
                    return (
                      <tr key={cycle.id} className={`border-t border-border hover:bg-muted/30 ${nextInfo.isOverdue ? "bg-red-50/50" : ""}`}>
                        <td className="p-2">
                          <div className="font-medium">{cycle.lead_name}</div>
                          <div className="text-muted-foreground font-mono">{cycle.lead_phone}</div>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{cycle.company_slug}</Badge>
                        </td>
                        <td className="p-2">
                          <Badge variant="secondary" className="text-[10px]">Day {dayNum + 1}</Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <div
                                  key={n}
                                  className={`w-2.5 h-3 rounded-sm ${
                                    n <= cycle.sms_sent_count
                                      ? "bg-green-500"
                                      : nextInfo.isOverdue && n <= cycle.sms_sent_count + nextInfo.missedCount
                                        ? "bg-red-400"
                                        : "bg-muted"
                                  }`}
                                  title={`SMS #${n}${n <= cycle.sms_sent_count ? " ✓ Sent" : nextInfo.isOverdue && n <= cycle.sms_sent_count + nextInfo.missedCount ? " ✗ Not Sent (Overdue)" : ""}`}
                                />
                              ))}
                            </div>
                            <span className="text-muted-foreground ml-1">{cycle.sms_sent_count}/10</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <span className={`text-[11px] ${nextInfo.isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            {nextInfo.isOverdue && <XCircle className="w-3 h-3 inline mr-0.5" />}
                            {nextInfo.text}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground text-[11px]">
                          {cycle.last_sms_sent_at ? formatDateTime(cycle.last_sms_sent_at) : "—"}
                        </td>
                      </tr>
                    );
                  })

                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RemarketingCycleReport;
