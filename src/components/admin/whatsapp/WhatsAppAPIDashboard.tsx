import { useState, useEffect, useRef } from "react";
import { Send, CheckCircle, XCircle, Clock, Calendar, RefreshCw, Wifi, WifiOff, ShieldCheck, TrendingUp, ArrowDownToLine, ArrowUpFromLine, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface AccountStatus {
  connected: boolean;
  status: string;
  phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  messaging_limit?: string;
  today_stats?: { sent: number; delivered: number };
  meta_insights?: MetaInsights | null;
}

interface MetaInsights {
  all_messages?: { sent: number; delivered: number; received: number };
  messages_delivered?: {
    marketing: number;
    marketing_lite: number;
    utility: number;
    authentication: number;
    authentication_international: number;
    service: number;
    total: number;
  };
  free_messages?: { customer_service: number; entry_point: number; total: number };
  paid_messages?: { marketing: number; utility: number; authentication: number; total: number };
  charges?: { marketing: number; utility: number; authentication: number; service: number; total: number };
  error?: string;
}

interface MessageStats {
  total: number; sent: number; delivered: number; read: number; failed: number; pending: number; incoming: number; outgoing: number;
}

interface CostBreakdown {
  marketing: number;
  utility: number;
  service: number;
  totalCharge: number;
}

interface CategoryStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  total: number;
}

interface WhatsAppAPIDashboardProps {
  accountId: string | null;
}

const WhatsAppAPIDashboard = ({ accountId }: WhatsAppAPIDashboardProps) => {
  const [stats, setStats] = useState<MessageStats>({ total: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, incoming: 0, outgoing: 0 });
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown>({ marketing: 0, utility: 0, service: 0, totalCharge: 0 });
  const [categoryStats, setCategoryStats] = useState<Record<string, CategoryStats>>({
    marketing: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
    utility: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
    service: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
  });
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "week" | "month" | "all">("today");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (accountId) {
      fetchMessages();
      fetchAccountAndInsights();
    }

    // Refresh every hour
    intervalRef.current = setInterval(() => {
      if (accountId) {
        fetchMessages();
        fetchAccountAndInsights();
      }
    }, 3600000); // 1 hour

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [accountId, dateRange]);

  const fetchMessages = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const now = new Date();
      // Use IST-aligned dates
      const istOffset = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(now.getTime() + istOffset);
      const todayMidnightIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - istOffset);
      
      let startDate: Date;
      let endDate: Date | null = null; // null = no upper bound
      if (dateRange === "today") {
        startDate = todayMidnightIST;
      } else if (dateRange === "yesterday") {
        startDate = new Date(todayMidnightIST.getTime() - 86400000);
        endDate = todayMidnightIST; // end at today midnight (exclusive)
      } else if (dateRange === "week") {
        startDate = new Date(todayMidnightIST.getTime() - 7 * 86400000);
      } else if (dateRange === "month") {
        startDate = new Date(todayMidnightIST.getTime() - 30 * 86400000);
      } else {
        startDate = new Date("2020-01-01");
      }

      const startISO = startDate.toISOString();
      const endISO = endDate ? endDate.toISOString() : null;
      const baseQuery = () => {
        let q = supabase
          .from("whatsapp_messages")
          .select("*", { count: "exact", head: true })
          .eq("account_id", accountId)
          .gte("created_at", startISO);
        if (endISO) q = q.lt("created_at", endISO);
        return q;
      };

      // Use exact counts for each status/direction in parallel
      const [total, rawSent, rawDelivered, rawRead, failed, pending, incoming, outgoing] = await Promise.all([
        baseQuery().then(r => r.count || 0),
        baseQuery().eq("status", "sent").then(r => r.count || 0),
        baseQuery().eq("status", "delivered").then(r => r.count || 0),
        baseQuery().eq("status", "read").then(r => r.count || 0),
        baseQuery().eq("status", "failed").then(r => r.count || 0),
        baseQuery().eq("status", "pending").then(r => r.count || 0),
        baseQuery().eq("direction", "incoming").then(r => r.count || 0),
        baseQuery().eq("direction", "outgoing").then(r => r.count || 0),
      ]);

      // Cumulative: read implies delivered, delivered implies sent
      const read = rawRead;
      const delivered = rawDelivered + rawRead;
      const sent = rawSent + rawDelivered + rawRead;

      setStats({ total, sent, delivered, read, failed, pending, incoming, outgoing });

      // Fetch outgoing messages for cost classification
      // Fetch ALL outgoing messages with status for category breakdown
      let allOutMsgs: { message_type: string | null; content: string | null; status: string | null }[] = [];
      let outOffset = 0;
      const OUT_BATCH = 5000;
      while (true) {
        let outQ = supabase
          .from("whatsapp_messages")
          .select("message_type, content, status")
          .eq("account_id", accountId)
          .eq("direction", "outgoing")
          .gte("created_at", startISO);
        if (endISO) outQ = outQ.lt("created_at", endISO);
        const { data: batch } = await outQ.range(outOffset, outOffset + OUT_BATCH - 1);
        if (!batch || batch.length === 0) break;
        allOutMsgs = allOutMsgs.concat(batch);
        if (batch.length < OUT_BATCH) break;
        outOffset += OUT_BATCH;
      }
      const outMsgs = allOutMsgs;

      // Fetch template categories to match
      const { data: templates } = await supabase
        .from("whatsapp_templates")
        .select("name, category")
        .eq("account_id", accountId);

      const templateCategoryMap = new Map<string, string>();
      (templates || []).forEach(t => templateCategoryMap.set(t.name.toLowerCase(), t.category || "UTILITY"));

      // Classify each message and track per-category status
      const catStats: Record<string, CategoryStats> = {
        marketing: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
        utility: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
        service: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
      };
      let marketing = 0, utility = 0, service = 0;

      (outMsgs || []).forEach(m => {
        let cat: "marketing" | "utility" | "service" = "service";
        if (m.message_type === "template") {
          const content = (m.content || "").toLowerCase();
          let category = "MARKETING";
          for (const [name, tCat] of templateCategoryMap) {
            const nameWithSpaces = name.replace(/_/g, " ");
            if (content.includes(name) || content.includes(nameWithSpaces)) {
              category = tCat;
              break;
            }
          }
          cat = category === "MARKETING" ? "marketing" : "utility";
        }

        catStats[cat].total++;
        const st = m.status || "";
        // Only count delivered/read for cost — Meta charges on delivery, not send
        if (st === "delivered" || st === "read") {
          if (cat === "marketing") marketing++;
          else if (cat === "utility") utility++;
          else service++;
        }
        // Cumulative status tracking
        if (st === "read") { catStats[cat].read++; catStats[cat].delivered++; catStats[cat].sent++; }
        else if (st === "delivered") { catStats[cat].delivered++; catStats[cat].sent++; }
        else if (st === "sent") { catStats[cat].sent++; }
        else if (st === "failed") { catStats[cat].failed++; }
      });

      setCategoryStats(catStats);

      // Meta India rates (approx): Marketing ₹0.8631, Utility ₹0.1150 per message
      const MARKETING_RATE = 0.8631;
      const UTILITY_RATE = 0.1150;
      const totalCharge = (marketing * MARKETING_RATE) + (utility * UTILITY_RATE);
      setCostBreakdown({ marketing, utility, service, totalCharge });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccountAndInsights = async () => {
    if (!accountId) return;
    setIsCheckingStatus(true);
    try {
      // Determine date for insights
      const targetDate = dateRange === "yesterday"
        ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1).toISOString()
        : new Date().toISOString();

      const { data, error } = await supabase.functions.invoke("whatsapp-account-status", {
        body: { account_id: accountId, fetch_insights: true, date: targetDate },
      });
      if (error) throw error;
      setAccountStatus(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
      setAccountStatus({ connected: false, status: "error" });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const getQualityColor = (r: string) => {
    if (r === "GREEN") return "text-green-600";
    if (r === "YELLOW") return "text-yellow-600";
    if (r === "RED") return "text-red-600";
    return "text-muted-foreground";
  };

  if (!accountId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <WhatsAppIcon size="xl" className="mx-auto mb-4 opacity-30 text-[#25D366]" />
        <p>Select a WhatsApp account to view dashboard</p>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Top Row: Connection + Quality + Today + Cost */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Connection</p>
            <div className="flex items-center gap-1.5 mt-1">
              {accountStatus?.connected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
              <p className="text-sm font-bold capitalize">{isCheckingStatus ? "..." : accountStatus?.status || "Unknown"}</p>
            </div>
            {accountStatus?.phone_number && <p className="text-[10px] text-muted-foreground mt-0.5">{accountStatus.phone_number}</p>}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Quality</p>
            <p className={`text-xl font-bold ${getQualityColor(accountStatus?.quality_rating || "")}`}>
              {accountStatus?.quality_rating || "N/A"}
            </p>
            <p className="text-[10px] text-muted-foreground">Limit: {accountStatus?.messaging_limit || "N/A"}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Today Sent</p>
            <p className="text-xl font-bold text-purple-600">{accountStatus?.today_stats?.sent || 0}</p>
            <p className="text-[10px] text-muted-foreground">Delivered: {accountStatus?.today_stats?.delivered || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <IndianRupee className="w-3 h-3" /> Approx. Cost
            </p>
            <p className="text-xl font-bold">₹{costBreakdown.totalCharge.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Mktg: {costBreakdown.marketing} | Util: {costBreakdown.utility}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" /> Message Cost Breakdown
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Marketing</p>
              <p className="font-bold">{costBreakdown.marketing} msgs</p>
              <p className="text-xs text-muted-foreground">₹{(costBreakdown.marketing * 0.8631).toFixed(2)} @ ₹0.8631/msg</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Utility</p>
              <p className="font-bold">{costBreakdown.utility} msgs</p>
              <p className="text-xs text-muted-foreground">₹{(costBreakdown.utility * 0.1150).toFixed(2)} @ ₹0.1150/msg</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Service (Free)</p>
              <p className="font-bold">{costBreakdown.service} msgs</p>
              <p className="text-xs text-muted-foreground">₹0.00 (24h window)</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Approx. Cost</p>
              <p className="font-bold text-amber-600">₹{costBreakdown.totalCharge.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{costBreakdown.marketing + costBreakdown.utility + costBreakdown.service} paid+free msgs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category-wise Status Breakdown */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold text-sm mb-3">📊 Category-wise Delivery Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Sent</th>
                  <th className="pb-2 font-medium text-right">Delivered</th>
                  <th className="pb-2 font-medium text-right">Read</th>
                  <th className="pb-2 font-medium text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "marketing", label: "📢 Marketing", color: "text-purple-600" },
                  { key: "utility", label: "⚙️ Utility", color: "text-blue-600" },
                  { key: "service", label: "💬 Service (Free)", color: "text-emerald-600" },
                ].map(row => {
                  const cs = categoryStats[row.key];
                  return (
                    <tr key={row.key} className="border-b border-border/50">
                      <td className={`py-2 font-medium ${row.color}`}>{row.label}</td>
                      <td className="py-2 text-right font-bold">{cs.total}</td>
                      <td className="py-2 text-right">{cs.sent}</td>
                      <td className="py-2 text-right">{cs.delivered}</td>
                      <td className="py-2 text-right">{cs.read}</td>
                      <td className="py-2 text-right text-red-500">{cs.failed}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">{categoryStats.marketing.total + categoryStats.utility.total + categoryStats.service.total}</td>
                  <td className="py-2 text-right">{categoryStats.marketing.sent + categoryStats.utility.sent + categoryStats.service.sent}</td>
                  <td className="py-2 text-right">{categoryStats.marketing.delivered + categoryStats.utility.delivered + categoryStats.service.delivered}</td>
                  <td className="py-2 text-right">{categoryStats.marketing.read + categoryStats.utility.read + categoryStats.service.read}</td>
                  <td className="py-2 text-right text-red-500">{categoryStats.marketing.failed + categoryStats.utility.failed + categoryStats.service.failed}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* DB Stats Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: "Total", value: stats.total, color: "border-l-blue-500" },
          { label: "Sent", value: stats.sent, color: "border-l-cyan-500" },
          { label: "Delivered", value: stats.delivered, color: "border-l-green-500" },
          { label: "Read", value: stats.read, color: "border-l-emerald-500" },
          { label: "Failed", value: stats.failed, color: "border-l-red-500" },
          { label: "Pending", value: stats.pending, color: "border-l-yellow-500" },
        ].map(s => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="p-2.5">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{stats.total ? `${((s.value / stats.total) * 100).toFixed(0)}%` : "0%"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Direction */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50">
              <div className="flex items-center gap-1.5"><ArrowDownToLine className="w-4 h-4 text-blue-600" /><span className="text-xs font-medium">Incoming</span></div>
              <span className="font-bold text-sm text-blue-600">{stats.incoming}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-green-50">
              <div className="flex items-center gap-1.5"><ArrowUpFromLine className="w-4 h-4 text-green-600" /><span className="text-xs font-medium">Outgoing</span></div>
              <span className="font-bold text-sm text-green-600">{stats.outgoing}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Filter + Refresh */}
      <div className="flex items-center gap-2 bg-card rounded-lg p-2 border border-border">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <select
          className="px-2 py-1 rounded border border-input bg-background text-xs"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { fetchMessages(); fetchAccountAndInsights(); }} disabled={isCheckingStatus}>
          <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingStatus ? "animate-spin" : ""}`} /> Refresh
        </Button>
        {lastRefresh && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            Refreshes hourly • Last: {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
};

export default WhatsAppAPIDashboard;
