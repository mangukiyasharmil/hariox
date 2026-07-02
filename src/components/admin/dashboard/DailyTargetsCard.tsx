import { useState, useEffect } from "react";
import { Target, TrendingUp, Phone, IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface DailyTargetsCardProps {
  currentUserId: string | null;
  dateFilter: string;
  dateEndFilter: string;
}

const DailyTargetsCard = ({ currentUserId, dateFilter, dateEndFilter }: DailyTargetsCardProps) => {
  const { currentCompany } = useCompany();
  const [targets, setTargets] = useState({ calls: 30, paid: 3, interested: 5 });
  const [actuals, setActuals] = useState({ calls: 0, paid: 0, interested: 0 });

  useEffect(() => {
    if (!currentUserId) return;
    fetchTargetsAndActuals();
  }, [currentUserId, dateFilter, dateEndFilter, currentCompany?.id]);

  const fetchTargetsAndActuals = async () => {
    // Fetch system-configured targets
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["daily_call_target", "daily_paid_target", "daily_interested_target"]);

    if (settings) {
      const settingsMap = Object.fromEntries(settings.map(s => [s.key, parseInt(s.value) || 0]));
      setTargets({
        calls: settingsMap["daily_call_target"] || 30,
        paid: settingsMap["daily_paid_target"] || 3,
        interested: settingsMap["daily_interested_target"] || 5,
      });
    }

    const companyFilter = currentCompany?.id;

    // Calls today
    let callQuery = supabase
      .from("call_logs")
      .select("*", { count: "exact", head: true })
      .eq("caller_id", currentUserId!)
      .gte("created_at", dateFilter)
      .lte("created_at", dateEndFilter);
    if (companyFilter) callQuery = callQuery.eq("company_id", companyFilter);
    const { count: callCount } = await callQuery;

    // Paid leads today — use assignment history to find leads ever assigned to this user,
    // then check payments in the date range (since paid leads get reassigned to verification)
    // Paginate to avoid 1000 row default limit
    const allHistoryIds: string[] = [];
    let offset = 0;
    while (true) {
      const { data: batch } = await supabase
        .from("lead_assignment_history")
        .select("lead_id")
        .eq("assigned_to", currentUserId!)
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      allHistoryIds.push(...batch.map(h => h.lead_id));
      if (batch.length < 1000) break;
      offset += 1000;
    }
    
    let currentAssignedQ = supabase.from("leads").select("id").eq("assigned_to", currentUserId!);
    if (companyFilter) currentAssignedQ = currentAssignedQ.eq("company_id", companyFilter);
    const { data: currentAssigned } = await currentAssignedQ;

    const allLeadIds = [...new Set([
      ...allHistoryIds,
      ...(currentAssigned || []).map(l => l.id),
    ])];

    let paidCount = 0;
    if (allLeadIds.length > 0) {
      // Filter to company if needed
      let filteredIds = allLeadIds;
      if (companyFilter) {
        const chunks = [];
        for (let i = 0; i < allLeadIds.length; i += 100) chunks.push(allLeadIds.slice(i, i + 100));
        const validIds: string[] = [];
        await Promise.all(chunks.map(async (chunk) => {
          const { data } = await supabase.from("leads").select("id").in("id", chunk).eq("company_id", companyFilter);
          (data || []).forEach(l => validIds.push(l.id));
        }));
        filteredIds = validIds;
      }

      if (filteredIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < filteredIds.length; i += 100) chunks.push(filteredIds.slice(i, i + 100));
        const paidIds = new Set<string>();
        await Promise.all(chunks.map(async (chunk) => {
          const { data: payments } = await supabase.from("payments")
            .select("lead_id").in("lead_id", chunk)
            .in("status", ["completed", "captured"])
            .gte("created_at", dateFilter).lte("created_at", dateEndFilter);
          (payments || []).forEach(p => paidIds.add(p.lead_id));
        }));
        paidCount = paidIds.size;
      }
    }

    // Interested leads today
    let intQuery = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", currentUserId!)
      .eq("is_interested", true)
      .gte("updated_at", dateFilter)
      .lte("updated_at", dateEndFilter);
    if (companyFilter) intQuery = intQuery.eq("company_id", companyFilter);
    const { count: intCount } = await intQuery;

    setActuals({
      calls: callCount || 0,
      paid: paidCount,
      interested: intCount || 0,
    });
  };

  const getProgress = (actual: number, target: number) => Math.min(100, Math.round((actual / target) * 100));
  const getColor = (pct: number) => pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";

  const items = [
    { icon: Phone, label: "Calls", actual: actuals.calls, target: targets.calls, color: "text-blue-600" },
    { icon: IndianRupee, label: "Paid", actual: actuals.paid, target: targets.paid, color: "text-green-600" },
    { icon: TrendingUp, label: "Interested", actual: actuals.interested, target: targets.interested, color: "text-purple-600" },
  ];

  return (
    <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-primary/20 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold">Daily Targets</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const pct = getProgress(item.actual, item.target);
          return (
            <div key={item.label} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <item.icon className={`w-3 h-3 ${item.color}`} />
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
              <p className={`text-sm font-bold ${item.color}`}>
                {item.actual}/{item.target}
              </p>
              <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getColor(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {pct >= 100 && <span className="text-[9px] text-green-600 font-medium">✓ Done</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyTargetsCard;
