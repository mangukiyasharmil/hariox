import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { MessageSquare, Send, CheckCircle, XCircle, Clock, IndianRupee, Filter, RefreshCw, Wallet, Route, Zap, AlertTriangle, ShieldCheck, ShieldX, Smartphone, Building2 } from "lucide-react";
import RemarketingCycleReport from "./RemarketingCycleReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useDateFilter } from "@/hooks/useDateFilter";
import DateFilterSelect from "./DateFilterSelect";
import { Badge } from "@/components/ui/badge";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import CompanySelector from "./CompanySelector";
import { SMS_TEMPLATES } from "@/config/smsTemplates";

interface SMSLog {
  id: string;
  phone: string;
  sms_type: string;
  message: string;
  status: string;
  cost_credits: number;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
}

interface SMSStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  submitted: number;
  rejected: number;
  totalCost: number;
  totalSegments: number;
  deliveredSegments: number;
  byType: Record<string, number>;
  byError: Record<string, number>;
}

interface CreditInfo {
  credits: number;
  sms_cost: number;
  estimated_sms_remaining: number;
  routes: unknown;
}

interface CompanyStats {
  company_id: string | null;
  company_name: string;
  company_slug: string;
  total_sent_count: number;
  delivered_count: number;
  failed_count: number;
  pending_count: number;
  delivered_segments: number;
  otp_count: number;
  remarketing_count: number;
  other_count: number;
  cost: number;
}

const SMS_COST_PER_MESSAGE = 0.11;

// Error code descriptions for GreenSMS
const ERROR_CODE_LABELS: Record<string, string> = {
  "74": "DND Number",
  "652": "Invalid Number",
  "651": "Network Error",
  "1004": "Operator Rejected",
  "001": "Unknown Error",
  "201": "Delivery Failed",
  "215": "Number Unreachable",
  "088": "Expired",
  "021": "Handset Error",
  "027": "Absent Subscriber",
  "20d": "Blocked",
  "206": "Barred",
  "013": "Timeout",
  "21b": "Network Busy",
  "220": "SIM Full",
};

const SMSDashboard = () => {
  const { companyId } = useCompanyFilter();
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [stats, setStats] = useState<SMSStats>({
    total: 0, sent: 0, delivered: 0, failed: 0, pending: 0,
    submitted: 0, rejected: 0, totalCost: 0, totalSegments: 0, deliveredSegments: 0,
    byType: {}, byError: {},
  });
  const [otpStats, setOtpStats] = useState({ total: 0, verified: 0, failed: 0, expired: 0 });
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingCredit, setIsCheckingCredit] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { dateRange, setDateRange, customStart, customEnd, setCustomStart, setCustomEnd, startDateISO, endDateISO, dateLabel } = useDateFilter("today");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [errorFilter, setErrorFilter] = useState<string>("all");
  
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [companyTemplateOverrides, setCompanyTemplateOverrides] = useState<Record<string, string>>({});
  
  const lastSyncRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<number>(2000);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  const fetchSMSData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: statsResult, error: statsError } = await supabase
        .rpc("get_sms_stats", { start_date: startDateISO, end_date: endDateISO, p_company_id: companyId || null });
      
      if (statsError) {
        console.error("Error fetching SMS stats:", statsError);
      } else if (statsResult && statsResult.length > 0) {
        const result = statsResult[0];
        setStats({
          total: Number(result.total_count) || 0,
          sent: Number(result.sent_count) || 0,
          delivered: Number(result.delivered_count) || 0,
          failed: Number(result.failed_count) || 0,
          pending: Number(result.pending_count) || 0,
          submitted: Number(result.submitted_count) || 0,
          rejected: Number(result.rejected_count) || 0,
          totalCost: Number(result.total_cost) || 0,
          totalSegments: Number(result.total_segments) || 0,
          deliveredSegments: Number(result.delivered_segments) || 0,
          byType: (result.by_type as Record<string, number>) || {},
          byError: (result.by_error as Record<string, number>) || {},
        });
      }

      // Fetch OTP verification stats — use sms_logs OTP count as total (matches SMS by Type)
      const [
        { count: otpSmsCount },
        { count: verifiedOtps },
        { count: expiredOtps },
      ] = await Promise.all([
        supabase.from("sms_logs").select("*", { count: "exact", head: true })
          .eq("sms_type", "otp")
          .gte("created_at", startDateISO).lte("created_at", endDateISO),
        supabase.from("otp_codes").select("*", { count: "exact", head: true })
          .gte("created_at", startDateISO).lte("created_at", endDateISO)
          .eq("verified", true),
        supabase.from("otp_codes").select("*", { count: "exact", head: true })
          .gte("created_at", startDateISO).lte("created_at", endDateISO)
          .eq("verified", false).lt("expires_at", new Date().toISOString()),
      ]);
      const total = otpSmsCount || 0;
      const verified = verifiedOtps || 0;
      const expired = expiredOtps || 0;
      setOtpStats({ total, verified, failed: total - verified, expired });

      // Fetch company-wise SMS stats
      const { data: companyStatsData } = await supabase
        .rpc("get_sms_stats_by_company", { start_date: startDateISO, end_date: endDateISO });
      if (companyStatsData && companyStatsData.length > 0) {
        const { data: companiesData } = await supabase
          .from("companies").select("id, name, slug").eq("is_active", true);
        const companyMap = new Map((companiesData || []).map((c: any) => [c.id, c]));
        const mapped: CompanyStats[] = companyStatsData.map((row: any) => {
          const comp = row.company_id ? companyMap.get(row.company_id) : null;
          const deliveredSegs = Number(row.delivered_segments) || 0;
          return {
            company_id: row.company_id,
            company_name: comp?.name || "Unassigned",
            company_slug: comp?.slug || "unknown",
            total_sent_count: Number(row.total_sent_count) || 0,
            delivered_count: Number(row.delivered_count) || 0,
            failed_count: Number(row.failed_count) || 0,
            pending_count: Number(row.pending_count) || 0,
            delivered_segments: deliveredSegs,
            otp_count: Number(row.otp_count) || 0,
            remarketing_count: Number(row.remarketing_count) || 0,
            other_count: Number(row.other_count) || 0,
            cost: deliveredSegs * SMS_COST_PER_MESSAGE,
          };
        });
        setCompanyStats(mapped.sort((a, b) => b.total_sent_count - a.total_sent_count));
      }

      let query = supabase
        .from("sms_logs")
        .select("*")
        .gte("created_at", startDateISO)
        .lte("created_at", endDateISO)
        .order("created_at", { ascending: false })
        .limit(200);

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      if (typeFilter !== "all") query = query.eq("sms_type", typeFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (errorFilter !== "all") {
        if (errorFilter === "no_error") {
          query = query.is("error_message", null);
        } else {
          query = query.ilike("error_message", `%${errorFilter}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const logsData = data || [];
      setLogs(logsData);
      if (logsData.length > 0) lastSyncRef.current = logsData[0].created_at;
    } catch (error) {
      console.error("Error fetching SMS data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDateISO, endDateISO, typeFilter, statusFilter, errorFilter, companyId]);

  const fetchCreditInfo = async () => {
    setIsCheckingCredit(true);
    try {
      const { data, error } = await supabase.functions.invoke("sms-credit-check", {
        body: { company_id: companyId || null }
      });
      if (error) throw error;
      if (data?.success) setCreditInfo(data);
    } catch (error) {
      console.error("Error fetching credit info:", error);
    } finally {
      setIsCheckingCredit(false);
    }
  };

  const fetchTemplateOverrides = useCallback(async () => {
    if (!companyId) {
      setCompanyTemplateOverrides({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from("company_integrations")
        .select("config")
        .eq("company_id", companyId)
        .eq("service_type", "sms")
        .maybeSingle();

      if (error) throw error;
      if (data?.config && typeof data.config === "object") {
        const config = data.config as Record<string, any>;
        if (config.dlt_template_ids) {
          setCompanyTemplateOverrides(config.dlt_template_ids);
          return;
        }
      }
      setCompanyTemplateOverrides({});
    } catch (err) {
      console.error("Error fetching template overrides:", err);
      setCompanyTemplateOverrides({});
    }
  }, [companyId]);

  useEffect(() => {
    fetchSMSData();
    fetchCreditInfo();
    fetchTemplateOverrides();
    
    const channel = supabase
      .channel(`sms-logs-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_logs' }, () => {
        fetchSMSData();
        pollIntervalRef.current = 2000;
      })
      .subscribe();

    const pollData = async () => {
      try {
        const { data } = await supabase
          .from("sms_logs")
          .select("id, status, created_at")
          .gt("created_at", lastSyncRef.current || "1970-01-01")
          .order("created_at", { ascending: false })
          .limit(50);
        if (data && data.length > 0) {
          fetchSMSData();
          pollIntervalRef.current = 2000;
        } else {
          pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 30000);
        }
      } catch (error) {
        console.error("Poll error:", error);
      }
      pollTimeoutRef.current = setTimeout(pollData, pollIntervalRef.current);
    };
    pollTimeoutRef.current = setTimeout(pollData, pollIntervalRef.current);

    return () => {
      supabase.removeChannel(channel);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [dateRange, customStart, customEnd, typeFilter, statusFilter, errorFilter, companyId, fetchSMSData]);

  const checkDeliveryStatus = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-sms-delivery");
      if (error) throw error;
      if (data?.updated > 0) {
        await fetchSMSData();
        toast.success(`Updated ${data.updated} SMS statuses`);
      } else {
        toast.info("No pending deliveries to update");
      }
    } catch (error) {
      console.error("Error checking delivery status:", error);
      toast.error("Failed to check delivery status");
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  };

  // Auto-sync SMS delivery status
  useEffect(() => {
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
      autoSyncIntervalRef.current = null;
    }
    const runSync = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        const { data, error } = await supabase.functions.invoke("check-sms-delivery");
        if (!error && data?.updated > 0) {
          await fetchSMSData();
          console.log(`[SMS] Auto-synced ${data.updated} statuses`);
        }
      } catch (error) {
        console.error("[SMS] Auto-sync error:", error);
      } finally {
        isSyncingRef.current = false;
      }
    };
    const initTimer = setTimeout(runSync, 2000);
    // Auto-sync every 1 hour (3600000ms)
    autoSyncIntervalRef.current = setInterval(runSync, 3600000);
    
    // Schedule final sync at 11:57 PM IST daily
    const scheduleNightSync = () => {
      const now = new Date();
      const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const target = new Date(istNow);
      target.setUTCHours(23 - 5, 57 - 30, 0, 0); // 11:57 PM IST in UTC
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      const delay = target.getTime() - now.getTime();
      return setTimeout(() => {
        runSync();
        // Reschedule for next day
        scheduleNightSync();
      }, delay);
    };
    const nightTimer = scheduleNightSync();
    
    return () => {
      clearTimeout(initTimer);
      clearTimeout(nightTimer);
      if (autoSyncIntervalRef.current) clearInterval(autoSyncIntervalRef.current);
    };
  }, [fetchSMSData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent": return "bg-blue-100 text-blue-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "otp": return "bg-purple-100 text-purple-800";
      case "status": return "bg-blue-100 text-blue-800";
      case "marketing": return "bg-orange-100 text-orange-800";
      case "reminder": return "bg-cyan-100 text-cyan-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const extractErrorCode = (msg: string | null) => {
    if (!msg) return null;
    const match = msg.match(/Failed \(Error: ([^)]+)\)/);
    return match ? match[1] : msg;
  };

  // Get sorted error codes for filter dropdown
  const sortedErrors = useMemo(() => {
    return Object.entries(stats.byError)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
  }, [stats.byError]);

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <TabsList>
          <TabsTrigger value="dashboard">SMS Dashboard</TabsTrigger>
          <TabsTrigger value="remarketing">Remarketing Cycles</TabsTrigger>
          <TabsTrigger value="templates">DLT Templates</TabsTrigger>
        </TabsList>
        <CompanySelector />
      </div>

      <TabsContent value="dashboard" className="space-y-6">
      {/* Credit & Balance Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">SMS Credits</p>
                <p className="text-2xl font-bold text-primary">
                  {isCheckingCredit ? "..." : (creditInfo?.credits || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">@ ₹{SMS_COST_PER_MESSAGE}/SMS</p>
              </div>
              <Wallet className="w-10 h-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{dateLabel} Spend</p>
                <p className="text-2xl font-bold text-cyan-600">
                  ₹{stats.totalCost.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{stats.deliveredSegments} delivered segments × ₹{SMS_COST_PER_MESSAGE}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total: {stats.totalSegments} segments (incl. failed/pending)</p>
              </div>
              <Zap className="w-10 h-10 text-cyan-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="text-lg font-bold text-orange-600">TRANS (Transactional)</p>
                <p className="text-xs text-muted-foreground">DLT Compliant</p>
              </div>
              <Route className="w-10 h-10 text-orange-500 opacity-50" />
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={fetchCreditInfo} disabled={isCheckingCredit}>
              <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingCredit ? "animate-spin" : ""}`} />
              Refresh Balance
            </Button>
          </CardContent>
        </Card>
      </div>



      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">{stats.totalSegments} total / {stats.deliveredSegments} delivered segments</p>
              </div>
              <MessageSquare className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold text-blue-600">{stats.submitted + stats.sent}</p>
              </div>
              <Send className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Est. Cost</p>
                <p className="text-2xl font-bold text-emerald-600">₹{stats.totalCost.toFixed(2)}</p>
              </div>
              <IndianRupee className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company-wise SMS Breakdown */}
      {companyStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Company-wise SMS Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Total Sent</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Delivered</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Failed</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Pending</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Segments</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">OTP</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Remarketing</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Other</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {companyStats.map((cs) => (
                    <tr key={cs.company_id || "unassigned"} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-medium">{cs.company_name}</td>
                      <td className="p-3 text-right font-bold">{cs.total_sent_count}</td>
                      <td className="p-3 text-right font-bold text-green-600">{cs.delivered_count}</td>
                      <td className="p-3 text-right text-red-600">{cs.failed_count}</td>
                      <td className="p-3 text-right text-amber-600">{cs.pending_count}</td>
                      <td className="p-3 text-right">{cs.delivered_segments}</td>
                      <td className="p-3 text-right">{cs.otp_count}</td>
                      <td className="p-3 text-right">{cs.remarketing_count}</td>
                      <td className="p-3 text-right">{cs.other_count}</td>
                      <td className="p-3 text-right font-medium">₹{cs.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-border bg-muted/30 font-bold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">{companyStats.reduce((s, c) => s + c.total_sent_count, 0)}</td>
                    <td className="p-3 text-right text-green-600">{companyStats.reduce((s, c) => s + c.delivered_count, 0)}</td>
                    <td className="p-3 text-right text-red-600">{companyStats.reduce((s, c) => s + c.failed_count, 0)}</td>
                    <td className="p-3 text-right text-amber-600">{companyStats.reduce((s, c) => s + c.pending_count, 0)}</td>
                    <td className="p-3 text-right">{companyStats.reduce((s, c) => s + c.delivered_segments, 0)}</td>
                    <td className="p-3 text-right">{companyStats.reduce((s, c) => s + c.otp_count, 0)}</td>
                    <td className="p-3 text-right">{companyStats.reduce((s, c) => s + c.remarketing_count, 0)}</td>
                    <td className="p-3 text-right">{companyStats.reduce((s, c) => s + c.other_count, 0)}</td>
                    <td className="p-3 text-right">₹{companyStats.reduce((s, c) => s + c.cost, 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OTP Verification Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            OTP Verification Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Total OTPs Sent</p>
                <p className="text-xl font-bold">{otpStats.total}</p>
              </div>
              <MessageSquare className="w-6 h-6 text-primary opacity-50" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <div>
                <p className="text-xs text-muted-foreground">Verified</p>
                <p className="text-xl font-bold text-green-600">{otpStats.verified}</p>
                <p className="text-[10px] text-muted-foreground">
                  {otpStats.total > 0 ? ((otpStats.verified / otpStats.total) * 100).toFixed(1) : 0}% success
                </p>
              </div>
              <ShieldCheck className="w-6 h-6 text-green-500 opacity-50" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <div>
                <p className="text-xs text-muted-foreground">Not Verified</p>
                <p className="text-xl font-bold text-red-600">{otpStats.failed}</p>
                <p className="text-[10px] text-muted-foreground">
                  {otpStats.total > 0 ? ((otpStats.failed / otpStats.total) * 100).toFixed(1) : 0}% drop-off
                </p>
              </div>
              <ShieldX className="w-6 h-6 text-red-500 opacity-50" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <div>
                <p className="text-xs text-muted-foreground">Expired</p>
                <p className="text-xl font-bold text-orange-600">{otpStats.expired}</p>
                <p className="text-[10px] text-muted-foreground">
                  {otpStats.total > 0 ? ((otpStats.expired / otpStats.total) * 100).toFixed(1) : 0}% expired
                </p>
              </div>
              <Clock className="w-6 h-6 text-orange-500 opacity-50" />
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">SMS by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getTypeColor(type)}`}>{type}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
            {Object.keys(stats.byType).length === 0 && (
              <p className="col-span-4 text-center text-muted-foreground py-4">No SMS data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg p-3 border border-border">
        <DateFilterSelect
          dateRange={dateRange} setDateRange={setDateRange}
          customStart={customStart} customEnd={customEnd}
          setCustomStart={setCustomStart} setCustomEnd={setCustomEnd}
          showYesterday={true} showCustom={true}
        />

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="otp">OTP</option>
            <option value="status">Status</option>
            <option value="marketing">Marketing</option>
            <option value="remarketing">Remarketing</option>
            <option value="reminder">Reminder</option>
          </select>
        </div>

        <select className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>

        <select className="px-3 py-1.5 rounded-md border border-input bg-background text-sm" value={errorFilter} onChange={(e) => setErrorFilter(e.target.value)}>
          <option value="all">All Errors</option>
          <option value="no_error">No Error</option>
          {sortedErrors.map(([code, count]) => (
            <option key={code} value={code}>
              Error {code} ({ERROR_CODE_LABELS[code] || "Other"}) — {Number(count)}
            </option>
          ))}
        </select>

        <Button variant="outline" size="sm" onClick={fetchSMSData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={checkDeliveryStatus} disabled={isSyncing}>
          <CheckCircle className={`w-4 h-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync Delivery Status"}
          {(stats.pending > 0 || stats.submitted > 0) && (
            <span className="ml-1 text-xs text-amber-600">({stats.pending + stats.submitted} pending)</span>
          )}
        </Button>
        {errorFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setErrorFilter("all")} className="text-red-600">
            ✕ Clear Error Filter
          </Button>
        )}
      </div>

      {/* SMS Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            SMS Logs {errorFilter !== "all" && <Badge variant="destructive" className="ml-2 text-xs">Filtered: Error {errorFilter}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Message</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Error</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No SMS logs found</td></tr>
                ) : (
                  logs.map((log) => {
                    const errCode = extractErrorCode(log.error_message);
                    return (
                      <tr key={log.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3 text-xs">{formatDateTime(log.created_at)}</td>
                        <td className="p-3 font-mono text-xs">+91 {log.phone}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getTypeColor(log.sms_type)}`}>{log.sms_type}</span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-xs text-muted-foreground">{log.message}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(log.status)}`}>{log.status}</span>
                        </td>
                        <td className="p-3">
                          {errCode ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-mono text-red-600 font-bold">{errCode}</span>
                              <span className="text-[10px] text-red-500">{ERROR_CODE_LABELS[errCode] || ""}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right text-xs">₹{Number(log.cost_credits || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="remarketing" className="space-y-6">
        <RemarketingCycleReport />
      </TabsContent>

      <TabsContent value="templates" className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">DLT Approved Templates</CardTitle>
              <p className="text-xs text-muted-foreground">
                List of system-wide templates and company-specific overrides mapped dynamically.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="p-3 text-xs font-semibold text-muted-foreground">Template Name</th>
                    <th className="p-3 text-xs font-semibold text-muted-foreground">Category</th>
                    <th className="p-3 text-xs font-semibold text-muted-foreground">System DLT ID</th>
                    <th className="p-3 text-xs font-semibold text-muted-foreground">Active Override DLT ID</th>
                    <th className="p-3 text-xs font-semibold text-muted-foreground">Variables</th>
                    <th className="p-3 text-xs font-semibold text-muted-foreground">SMS Message Template Text</th>
                  </tr>
                </thead>
                <tbody>
                  {SMS_TEMPLATES.map((tpl) => {
                    // Try to resolve the specific override
                    let activeOverride = "";
                    if (companyTemplateOverrides) {
                      // e.g. mapping telecaller_credit -> telecaller, or remarketing_credit -> remarketing
                      if (companyTemplateOverrides[tpl.value]) {
                        activeOverride = companyTemplateOverrides[tpl.value];
                      } else if (
                        (tpl.value === "remarketing_credit" || 
                         tpl.value === "remarketing_finance" || 
                         tpl.value === "remarketing_capital" ||
                         tpl.value === "marketing") && 
                        companyTemplateOverrides["remarketing"]
                      ) {
                        activeOverride = companyTemplateOverrides["remarketing"];
                      } else if (
                        (tpl.value === "payment_success" || 
                         tpl.value === "welcome" ||
                         tpl.value === "account_sms") && 
                        companyTemplateOverrides["welcome"]
                      ) {
                        activeOverride = companyTemplateOverrides["welcome"];
                      } else if (
                        (tpl.value === "telecaller_credit" || 
                         tpl.value === "telecaller_finance" || 
                         tpl.value === "telecaller_capital" ||
                         tpl.value === "telecaller") && 
                        companyTemplateOverrides["telecaller"]
                      ) {
                        activeOverride = companyTemplateOverrides["telecaller"];
                      }
                    }

                    return (
                      <tr key={tpl.value} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3 text-xs font-medium">
                          {tpl.label}
                          {tpl.companySlug && (
                            <Badge variant="outline" className="ml-2 text-[9px] uppercase">
                              {tpl.companySlug}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          <span className="capitalize px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                            {tpl.category}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {tpl.templateId}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {activeOverride ? (
                            <Badge variant="secondary" className="font-mono bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">
                              {activeOverride}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40 text-[11px] italic">Using System ID</span>
                          )}
                        </td>
                        <td className="p-3 text-xs font-semibold text-center sm:text-left">
                          {tpl.varCount}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground font-sans max-w-md break-words">
                          {tpl.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default SMSDashboard;
