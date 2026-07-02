import { useEffect, useState } from "react";
import { MessageSquare, Users, CreditCard, HeadphonesIcon, TrendingUp, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

interface Props {
  startISO: string;
  endISO: string;
}

const COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#06b6d4"];

const ChatbotReport = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalConversations: 0,
    uniqueUsers: 0,
    leadsCreated: 0,
    agentEscalations: 0,
    conversionRate: 0,
    avgMessagesPerConvo: 0,
  });
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<any[]>([]);

  const toISTDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
    const ist = new Date(istMs);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    fetchData();
  }, [startISO, endISO, companyId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Get WhatsApp account IDs for current company
      let accountIds: string[] = [];
      if (companyId) {
        const { data: accounts } = await supabase
          .from("whatsapp_accounts")
          .select("id")
          .eq("company_id", companyId);
        accountIds = (accounts || []).map(a => a.id);
      }

      const applyAccountFilter = (query: any) => {
        if (!companyId || accountIds.length === 0) return query;
        return query.in("account_id", accountIds);
      };

      // Use exact counts for totals, fetch rows only for trend grouping
      const [
        incomingCountRes, outgoingCountRes, leadsCountRes, agentCountRes,
        incomingRowsRes, leadsRowsRes,
      ] = await Promise.all([
        // Exact count of incoming messages
        applyAccountFilter(
          supabase.from("unified_messages")
            .select("id", { count: "exact", head: true })
            .eq("platform", "whatsapp").eq("direction", "incoming")
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        // Exact count of outgoing messages
        applyAccountFilter(
          supabase.from("unified_messages")
            .select("id", { count: "exact", head: true })
            .eq("platform", "whatsapp").eq("direction", "outgoing")
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        // Leads from WhatsApp - exact count (with company filter)
        applyCompanyFilter(
          supabase.from("leads")
            .select("id", { count: "exact", head: true })
            .or("source.eq.whatsapp,source.like.whatsapp%")
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        // Agent escalation requests
        applyAccountFilter(
          supabase.from("unified_messages")
            .select("id", { count: "exact", head: true })
            .eq("platform", "whatsapp").eq("direction", "incoming")
            .eq("status", "needs_agent")
            .gte("created_at", startISO).lte("created_at", endISO)
        ),
        // Incoming rows for unique user count & daily trend
        applyAccountFilter(
          supabase.from("unified_messages")
            .select("sender_id, created_at")
            .eq("platform", "whatsapp").eq("direction", "incoming")
            .gte("created_at", startISO).lte("created_at", endISO)
            .limit(50000)
        ),
        // Leads rows for daily trend & paid status (with company filter)
        applyCompanyFilter(
          supabase.from("leads")
            .select("id, created_at, status")
            .or("source.eq.whatsapp,source.like.whatsapp%")
            .gte("created_at", startISO).lte("created_at", endISO)
            .limit(50000)
        ),
      ]);

      const incoming = incomingRowsRes.data || [];
      const leads = leadsRowsRes.data || [];
      const totalIncoming = incomingCountRes.count || 0;
      const totalOutgoing = outgoingCountRes.count || 0;
      const totalLeads = leadsCountRes.count || 0;
      const agentEscalations = agentCountRes.count || 0;
      const uniqueUsers = new Set(incoming.map(m => m.sender_id)).size;
      const totalMessages = totalIncoming + totalOutgoing;

      const paidLeads = leads.filter(l =>
        ["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"].includes(l.status)
      );

      setStats({
        totalConversations: totalIncoming,
        uniqueUsers,
        leadsCreated: totalLeads,
        agentEscalations,
        conversionRate: uniqueUsers > 0 ? Math.round((totalLeads / uniqueUsers) * 100) : 0,
        avgMessagesPerConvo: uniqueUsers > 0 ? Math.round(totalMessages / uniqueUsers) : 0,
      });

      // Daily trend
      const dayMap: Record<string, { messages: number; leads: number; paid: number }> = {};
      incoming.forEach(m => {
        const d = toISTDate(m.created_at);
        if (!dayMap[d]) dayMap[d] = { messages: 0, leads: 0, paid: 0 };
        dayMap[d].messages++;
      });
      leads.forEach(l => {
        const d = toISTDate(l.created_at);
        if (!dayMap[d]) dayMap[d] = { messages: 0, leads: 0, paid: 0 };
        dayMap[d].leads++;
      });
      paidLeads.forEach(l => {
        const d = toISTDate(l.created_at);
        if (dayMap[d]) dayMap[d].paid++;
      });

      setDailyTrend(
        Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({
            date: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
            ...v,
          }))
      );

      // Source breakdown
      setSourceBreakdown([
        { name: "Lead Captured", value: totalLeads, fill: "#22c55e" },
        { name: "Paid", value: paidLeads.length, fill: "#3b82f6" },
        { name: "Agent Requests", value: agentEscalations, fill: "#f59e0b" },
        { name: "No Lead", value: Math.max(0, uniqueUsers - totalLeads), fill: "#94a3b8" },
      ].filter(s => s.value > 0));
    } catch (err) {
      console.error("ChatbotReport error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Messages", value: stats.totalConversations, icon: MessageSquare, color: "text-primary" },
          { label: "Unique Users", value: stats.uniqueUsers, icon: Users, color: "text-blue-600" },
          { label: "Leads Created", value: stats.leadsCreated, icon: TrendingUp, color: "text-green-600" },
          { label: "Capture Rate", value: `${stats.conversionRate}%`, icon: Bot, color: "text-purple-600" },
          { label: "Agent Requests", value: stats.agentEscalations, icon: HeadphonesIcon, color: "text-amber-600" },
          { label: "Avg Msgs/User", value: stats.avgMessagesPerConvo, icon: MessageSquare, color: "text-cyan-600" },
        ].map(card => (
          <Card key={card.label} className="border-l-4 border-l-current">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{card.label}</span>
              </div>
              <p className={`text-xl font-bold ${card.color}`}>
                {typeof card.value === "number" ? card.value.toLocaleString("en-IN") : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Trend */}
        {dailyTrend.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Daily Chatbot Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="messages" fill="#8b5cf6" name="Messages" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="leads" fill="#22c55e" name="Leads" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="paid" fill="#3b82f6" name="Paid" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outcome Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Conversation Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceBreakdown.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={2}
                      dataKey="value" nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {sourceBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.fill || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatbotReport;
