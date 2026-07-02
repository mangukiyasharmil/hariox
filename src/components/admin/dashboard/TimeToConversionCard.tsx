import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, TrendingDown, Zap, Timer, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface TimeToConversionCardProps {
  dateFilter: string;
  dateEndFilter?: string;
}

interface ConversionMetrics {
  avgTimeMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  under1Hour: number;
  under24Hours: number;
  over24Hours: number;
  totalConversions: number;
}

const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
};

const TimeToConversionCard = ({ dateFilter, dateEndFilter }: TimeToConversionCardProps) => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConversionMetrics();
  }, [dateFilter, dateEndFilter, currentCompany?.id]);

  const fetchConversionMetrics = async () => {
    try {
      setIsLoading(true);
      const companyId = getCompanyFilter();
      const isHariox = currentCompany?.slug === "hariox";

      // Fetch leads with their creation time
      let leadsQuery = supabase
        .from("leads")
        .select("id, created_at")
        .gte("created_at", dateFilter);

      if (dateEndFilter) {
        leadsQuery = leadsQuery.lte("created_at", dateEndFilter);
      }

      if (companyId) {
        leadsQuery = isHariox
          ? leadsQuery.or(`company_id.eq.${companyId},company_id.is.null`)
          : leadsQuery.eq("company_id", companyId);
      }

      const { data: leads } = await leadsQuery;

      if (!leads || leads.length === 0) {
        setMetrics(null);
        setIsLoading(false);
        return;
      }

      const leadIds = leads.map(l => l.id);
      const leadCreatedMap = new Map(leads.map(l => [l.id, new Date(l.created_at).getTime()]));

      // Fetch payments for these leads - include all payment statuses that indicate success
      const { data: payments } = await supabase
        .from("payments")
        .select("lead_id, created_at, status")
        .in("lead_id", leadIds)
        .in("status", ["completed", "captured"]);

      console.log("TimeToConversion - leads found:", leads?.length, "payments found:", payments?.length);

      if (!payments || payments.length === 0) {
        setMetrics(null);
        setIsLoading(false);
        return;
      }

      // Calculate time to conversion for each payment
      const conversionTimes: number[] = [];
      
      payments.forEach(payment => {
        const leadCreatedTime = leadCreatedMap.get(payment.lead_id);
        if (leadCreatedTime) {
          const paymentTime = new Date(payment.created_at).getTime();
          const timeDiffMinutes = (paymentTime - leadCreatedTime) / (1000 * 60);
          if (timeDiffMinutes > 0) {
            conversionTimes.push(timeDiffMinutes);
          }
        }
      });

      if (conversionTimes.length === 0) {
        setMetrics(null);
        setIsLoading(false);
        return;
      }

      // Calculate metrics
      const avgTimeMinutes = conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length;
      const fastestMinutes = Math.min(...conversionTimes);
      const slowestMinutes = Math.max(...conversionTimes);
      const under1Hour = conversionTimes.filter(t => t <= 60).length;
      const under24Hours = conversionTimes.filter(t => t > 60 && t <= 1440).length;
      const over24Hours = conversionTimes.filter(t => t > 1440).length;

      setMetrics({
        avgTimeMinutes,
        fastestMinutes,
        slowestMinutes,
        under1Hour,
        under24Hours,
        over24Hours,
        totalConversions: conversionTimes.length,
      });
    } catch (error) {
      console.error("Error fetching conversion metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Time to Conversion</h3>
        </div>
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Time to Conversion</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
          <CalendarClock className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-xs">No conversion data available</p>
        </div>
      </div>
    );
  }

  // Calculate percentages for the distribution bar
  const total = metrics.under1Hour + metrics.under24Hours + metrics.over24Hours;
  const under1HourPct = total > 0 ? (metrics.under1Hour / total) * 100 : 0;
  const under24HoursPct = total > 0 ? (metrics.under24Hours / total) * 100 : 0;
  const over24HoursPct = total > 0 ? (metrics.over24Hours / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Time to Conversion</h3>
        </div>
        <span className="text-xs text-muted-foreground">{metrics.totalConversions} conversions</span>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-primary/5">
          <Clock className="w-4 h-4 mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-primary">{formatTime(metrics.avgTimeMinutes)}</p>
          <p className="text-[10px] text-muted-foreground">Avg Time</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
          <Zap className="w-4 h-4 mx-auto text-green-600 mb-1" />
          <p className="text-lg font-bold text-green-600">{formatTime(metrics.fastestMinutes)}</p>
          <p className="text-[10px] text-muted-foreground">Fastest</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30">
          <TrendingDown className="w-4 h-4 mx-auto text-orange-600 mb-1" />
          <p className="text-lg font-bold text-orange-600">{formatTime(metrics.slowestMinutes)}</p>
          <p className="text-[10px] text-muted-foreground">Slowest</p>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground font-medium">Conversion Speed Distribution</p>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          {under1HourPct > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${under1HourPct}%` }}
              className="bg-green-500 h-full"
              title={`Under 1 hour: ${metrics.under1Hour}`}
            />
          )}
          {under24HoursPct > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${under24HoursPct}%` }}
              className="bg-yellow-500 h-full"
              title={`1-24 hours: ${metrics.under24Hours}`}
            />
          )}
          {over24HoursPct > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${over24HoursPct}%` }}
              className="bg-orange-500 h-full"
              title={`Over 24 hours: ${metrics.over24Hours}`}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>&lt;1h: {metrics.under1Hour}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>1-24h: {metrics.under24Hours}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>&gt;24h: {metrics.over24Hours}</span>
          </div>
        </div>
      </div>

      {/* Insight */}
      {metrics.under1Hour > metrics.over24Hours && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg p-2">
            <TrendingUp className="w-4 h-4" />
            <p className="text-[10px] font-medium">
              Great! Most leads convert within 1 hour. Keep following up quickly!
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default TimeToConversionCard;
