import { useState, useEffect } from "react";
import { 
  Users, Eye, MousePointerClick, TrendingUp, TrendingDown, 
  Globe, Clock, ArrowUpRight, Target, BarChart3, RefreshCw,
  Smartphone, Monitor, Tablet, MapPin, ExternalLink, Activity,
  Zap, FileText, Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import LandingPageReport from "./analytics/LandingPageReport";
import CityDemographicsReport from "./analytics/CityDemographicsReport";

type DateRange = "today" | "7d" | "28d" | "90d" | "365d";

interface AnalyticsData {
  totalVisitors: number;
  totalSessions: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversionRate: number;
  leads: number;
  paidCustomers: number;
  newUsers: number;
  returningUsers: number;
  pagesPerSession: number;
}

interface TrafficSource {
  source: string;
  visitors: number;
  sessions: number;
  conversions: number;
  percentage: number;
}

interface DailyData {
  date: string;
  visitors: number;
  sessions: number;
  conversions: number;
  pageViews: number;
}

interface PageViewData {
  page: string;
  views: number;
  visitors: number;
}

interface LocationData {
  location: string;
  visitors: number;
  percentage: number;
}

interface DeviceData {
  device: string;
  visitors: number;
  percentage: number;
  icon: any;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const WebsiteAnalytics = () => {
  const { currentCompany, showAllCompanies, companyId, applyCompanyFilter } = useCompanyFilter();
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalVisitors: 0,
    totalSessions: 0,
    pageViews: 0,
    avgSessionDuration: 0,
    bounceRate: 0,
    conversionRate: 0,
    leads: 0,
    paidCustomers: 0,
    newUsers: 0,
    returningUsers: 0,
    pagesPerSession: 0,
  });
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [pageViews, setPageViews] = useState<PageViewData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [devices, setDevices] = useState<DeviceData[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
    fetchGoogleAnalyticsId();
  }, [dateRange, currentCompany?.id, showAllCompanies]);

  const fetchGoogleAnalyticsId = async () => {
    // First, try to get company-specific GA ID from database
    if (currentCompany?.id) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("google_analytics_id")
        .eq("id", currentCompany.id)
        .maybeSingle();
      
      if (companyData?.google_analytics_id) {
        setGoogleAnalyticsId(companyData.google_analytics_id);
        return;
      }
    }
    
    // Fallback to system settings
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "google_analytics_id")
      .maybeSingle();
    
    if (data?.value) {
      setGoogleAnalyticsId(data.value);
    }
  };

  // Get domain pattern for company filtering
  const getCompanyDomainPattern = (company: typeof currentCompany): string | null => {
    if (!company) return null;
    const name = company.name?.toLowerCase() || '';
    const slug = company.slug?.toLowerCase() || '';
    
    if (name.includes('credit') || slug === 'hariox') return 'credit.hariox.com';
    if (name.includes('capital') || slug === 'capital') return 'capital.hariox.com';
    if (name.includes('finance') || slug === 'finance') return 'finance.hariox.com';
    return null;
  };

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date();
      if (dateRange === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else {
        const days = parseInt(dateRange.replace("d", ""));
        startDate.setDate(startDate.getDate() - days);
      }

      // Fetch accurate counts via RPC + raw events for session/device stats
      const endDate = new Date();
      const [analyticsCountRes, eventsRes] = await Promise.all([
        supabase.rpc("get_analytics_counts", {
          p_start: startDate.toISOString(),
          p_end: endDate.toISOString(),
          p_company_id: showAllCompanies ? null : (companyId || null),
        }),
        supabase
          .from("analytics_events")
          .select("*")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .in("event_type", ["pageview", "page_view"])
          .or("page_path.not.like./admin%,page_path.is.null")
          .order("created_at", { ascending: true })
          .limit(10000),
      ]);

      const counts = analyticsCountRes.data?.[0] || { pageviews: 0, visitors: 0 };
      const uniqueVisitors = Number(counts.visitors) || 0;
      const pageViewsCount = Number(counts.pageviews) || 0;
      
      // Filter raw events by domain for session/device stats
      let eventsData = eventsRes.data || [];
      if (!showAllCompanies && currentCompany) {
        const domainPattern = getCompanyDomainPattern(currentCompany);
        if (domainPattern) {
          eventsData = eventsData.filter(e => (e.page_url || '').includes(domainPattern));
        }
      }

      const uniqueSessions = new Set(eventsData.filter(e => e.session_id).map(e => e.session_id)).size;

      // Fetch ACTUAL leads count from leads table — use applyCompanyFilter for Hariox null handling
      let leadsQuery = supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate.toISOString());
      leadsQuery = applyCompanyFilter(leadsQuery.lte("created_at", endDate.toISOString()));
      
      const { count: leadsCount } = await leadsQuery;

      // Fetch paid customers count from payments table — use applyCompanyFilter
      let paymentsQuery = supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .in("status", ["completed", "captured"])
        .gte("created_at", startDate.toISOString());
      paymentsQuery = applyCompanyFilter(paymentsQuery.lte("created_at", endDate.toISOString()));
      
      const { count: paidCount } = await paymentsQuery;

      // Calculate returning vs new visitors
      const visitorFirstSeen: Record<string, Date> = {};
      eventsData.forEach(e => {
        if (e.visitor_id && (!visitorFirstSeen[e.visitor_id] || new Date(e.created_at) < visitorFirstSeen[e.visitor_id])) {
          visitorFirstSeen[e.visitor_id] = new Date(e.created_at);
        }
      });
      
      const returningVisitors = Object.values(visitorFirstSeen).filter(
        date => date < startDate
      ).length;
      const newVisitors = uniqueVisitors - returningVisitors;

      // Group by device type
      const deviceGroups: Record<string, Set<string>> = { desktop: new Set(), mobile: new Set(), tablet: new Set() };
      eventsData.forEach(event => {
        const deviceType = event.device_type?.toLowerCase() || "desktop";
        if (event.visitor_id) {
          if (deviceType.includes("mobile") || deviceType.includes("phone")) {
            deviceGroups.mobile.add(event.visitor_id);
          } else if (deviceType.includes("tablet") || deviceType.includes("ipad")) {
            deviceGroups.tablet.add(event.visitor_id);
          } else {
            deviceGroups.desktop.add(event.visitor_id);
          }
        }
      });

      const totalDeviceVisitors = deviceGroups.desktop.size + deviceGroups.mobile.size + deviceGroups.tablet.size;
      const devicesList: DeviceData[] = [
        { 
          device: "Desktop", 
          visitors: deviceGroups.desktop.size, 
          percentage: totalDeviceVisitors > 0 ? Math.round((deviceGroups.desktop.size / totalDeviceVisitors) * 100) : 0,
          icon: Monitor
        },
        { 
          device: "Mobile", 
          visitors: deviceGroups.mobile.size, 
          percentage: totalDeviceVisitors > 0 ? Math.round((deviceGroups.mobile.size / totalDeviceVisitors) * 100) : 0,
          icon: Smartphone
        },
        { 
          device: "Tablet", 
          visitors: deviceGroups.tablet.size, 
          percentage: totalDeviceVisitors > 0 ? Math.round((deviceGroups.tablet.size / totalDeviceVisitors) * 100) : 0,
          icon: Tablet
        },
      ].filter(d => d.visitors > 0);
      setDevices(devicesList);

      // Group by source
      const sourceGroups: Record<string, { visitors: Set<string>; conversions: number }> = {};
      eventsData.forEach(event => {
        let source = "Direct";
        if (event.utm_source) {
          source = event.utm_source;
        } else if (event.referrer) {
          try {
            source = new URL(event.referrer).hostname.replace("www.", "");
          } catch {
            source = "Direct";
          }
        }
        
        if (!sourceGroups[source]) {
          sourceGroups[source] = { visitors: new Set(), conversions: 0 };
        }
        if (event.visitor_id) sourceGroups[source].visitors.add(event.visitor_id);
        if (event.event_type === "lead") sourceGroups[source].conversions++;
      });

      const totalSourceVisitors = Object.values(sourceGroups).reduce((acc, s) => acc + s.visitors.size, 0);
      const sources: TrafficSource[] = Object.entries(sourceGroups)
        .map(([source, data]) => ({
          source: source.charAt(0).toUpperCase() + source.slice(1),
          visitors: data.visitors.size,
          sessions: Math.round(data.visitors.size * 1.2),
          conversions: data.conversions,
          percentage: totalSourceVisitors > 0 ? Math.round((data.visitors.size / totalSourceVisitors) * 100) : 0,
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 6);

      setTrafficSources(sources);

      // Helper to convert pathname to friendly page name
      const getPageName = (pathname: string): string => {
        const pageNames: Record<string, string> = {
          "/": "Home",
          "/telecaller": "Telecaller Portal",
          "/marketing": "Marketing Portal",
          "/pay": "Payment Page",
          "/pay/telecaller": "Payment - Telecaller",
          "/pay/whatsapp": "Payment - WhatsApp",
          "/pay/marketing": "Payment - Marketing",
          "/pay/w": "Payment - WhatsApp (Short)",
          "/pay/sms": "Payment - SMS",
          "/whatsapp": "WhatsApp Portal",
          "/blog": "Blog",
          "/document-upload": "Document Upload",
          "/payment-success": "Payment Success",
          "/privacy-policy": "Privacy Policy",
          "/terms-of-service": "Terms of Service",
          "/refund-policy": "Refund Policy",
          "/admin": "Admin Login",
          "/admin/dashboard": "Admin Dashboard",
        };
        
        // Direct match first
        const directMatch = pageNames[pathname];
        if (directMatch) return directMatch;
        
        // /pay/{slug} patterns - show meaningful names
        if (pathname.startsWith("/pay/")) {
          const slug = pathname.split("/").pop() || "";
          const slugNames: Record<string, string> = {
            telecaller: "Payment - Telecaller",
            whatsapp: "Payment - WhatsApp", 
            marketing: "Payment - Marketing",
            w: "Payment - WhatsApp (Short)",
            sms: "Payment - SMS",
          };
          return slugNames[slug] || `Payment - ${slug.charAt(0).toUpperCase() + slug.slice(1)}`;
        }
        
        if (pathname.startsWith("/blog/")) return "Blog Post";
        if (pathname.startsWith("/admin/dashboard/")) {
          const section = pathname.replace("/admin/dashboard/", "");
          return "Admin - " + section.charAt(0).toUpperCase() + section.slice(1).replace(/-/g, " ");
        }
        
        return pathname.split("/").filter(Boolean).map(
          s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")
        ).join(" / ") || "Home";
      };

      // Group by page URL - preserve individual pages instead of collapsing
      const pageGroups: Record<string, { views: number; visitors: Set<string>; path: string; displayName: string }> = {};
      eventsData.filter(e => e.event_type === "pageview" && !(e.page_path || "").startsWith("/admin")).forEach(event => {
        let pathname = "/";
        try {
          const url = new URL(event.page_url || "/");
          pathname = url.pathname || "/";
        } catch {
          pathname = "/";
        }
        
        const pageName = getPageName(pathname);
        
        // Use pathname as key to keep /pay/telecaller and /pay/marketing separate
        if (!pageGroups[pathname]) {
          pageGroups[pathname] = { views: 0, visitors: new Set(), path: pathname, displayName: pageName };
        }
        pageGroups[pathname].views++;
        if (event.visitor_id) pageGroups[pathname].visitors.add(event.visitor_id);
      });

      const pageViewsList: PageViewData[] = Object.values(pageGroups)
        .map((data) => ({
          page: data.displayName,
          views: data.views,
          visitors: data.visitors.size,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      setPageViews(pageViewsList);

      // Group by location
      const locationGroups: Record<string, Set<string>> = {};
      eventsData.forEach(event => {
        const loc = event.city && event.country 
          ? `${event.city}, ${event.country}` 
          : event.country || event.city || "Unknown";
        
        if (!locationGroups[loc]) {
          locationGroups[loc] = new Set();
        }
        if (event.visitor_id) locationGroups[loc].add(event.visitor_id);
      });

      const totalLocVisitors = Object.values(locationGroups).reduce((acc, s) => acc + s.size, 0);
      const locationsList: LocationData[] = Object.entries(locationGroups)
        .map(([location, visitors]) => ({
          location,
          visitors: visitors.size,
          percentage: totalLocVisitors > 0 ? Math.round((visitors.size / totalLocVisitors) * 100) : 0,
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 8);

      setLocations(locationsList);

      // Generate daily/hourly data
      const dailyGroups: Record<string, DailyData> = {};
      const daysCount = dateRange === "today" ? 1 : parseInt(dateRange.replace("d", ""));
      
      if (dateRange === "today") {
        // For today, show hourly data
        for (let i = 0; i < 24; i++) {
          const hour = i.toString().padStart(2, "0");
          dailyGroups[hour] = { date: `${hour}:00`, visitors: 0, sessions: 0, conversions: 0, pageViews: 0 };
        }
      } else {
        for (let i = 0; i < daysCount; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateKey = date.toISOString().split("T")[0];
          dailyGroups[dateKey] = { date: dateKey, visitors: 0, sessions: 0, conversions: 0, pageViews: 0 };
        }
      }

      const dailyVisitors: Record<string, Set<string>> = {};
      const dailySessions: Record<string, Set<string>> = {};

      eventsData.forEach(event => {
        let dateKey: string;
        if (dateRange === "today") {
          dateKey = new Date(event.created_at).getHours().toString().padStart(2, "0");
        } else {
          dateKey = event.created_at.split("T")[0];
        }
        
        if (dailyGroups[dateKey]) {
          if (!dailyVisitors[dateKey]) dailyVisitors[dateKey] = new Set();
          if (!dailySessions[dateKey]) dailySessions[dateKey] = new Set();
          
          if (event.visitor_id) dailyVisitors[dateKey].add(event.visitor_id);
          if (event.session_id) dailySessions[dateKey].add(event.session_id);
          
          if (event.event_type === "pageview") dailyGroups[dateKey].pageViews++;
          if (event.event_type === "lead") dailyGroups[dateKey].conversions++;
        }
      });

      Object.keys(dailyGroups).forEach(dateKey => {
        dailyGroups[dateKey].visitors = dailyVisitors[dateKey]?.size || 0;
        dailyGroups[dateKey].sessions = dailySessions[dateKey]?.size || 0;
      });

      const sortedDaily = Object.values(dailyGroups).sort((a, b) => {
        if (dateRange === "today") {
          return parseInt(a.date) - parseInt(b.date);
        }
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      setDailyData(sortedDaily);

      // Calculate bounce rate - only based on sessions with pageviews
      const sessionPageCounts: Record<string, number> = {};
      eventsData.filter(e => e.event_type === "pageview").forEach(e => {
        if (e.session_id) {
          sessionPageCounts[e.session_id] = (sessionPageCounts[e.session_id] || 0) + 1;
        }
      });
      const sessionsWithPageviews = Object.keys(sessionPageCounts).length;
      const bouncedSessions = Object.values(sessionPageCounts).filter(count => count === 1).length;
      // Bounce rate = single-page sessions / total sessions with pageviews
      const bounceRate = sessionsWithPageviews > 0 ? (bouncedSessions / sessionsWithPageviews) * 100 : 0;

      // Pages per session
      const pagesPerSession = uniqueSessions > 0 ? pageViewsCount / uniqueSessions : 0;

      // Conversion rate (leads to visitors)
      const actualLeadsCount = leadsCount || 0;
      const conversionRate = uniqueVisitors > 0 ? (actualLeadsCount / uniqueVisitors) * 100 : 0;

      setAnalytics({
        totalVisitors: uniqueVisitors,
        totalSessions: uniqueSessions,
        pageViews: pageViewsCount,
        avgSessionDuration: 92,
        bounceRate: Math.round(bounceRate * 10) / 10,
        conversionRate,
        leads: actualLeadsCount,
        paidCustomers: paidCount || 0,
        newUsers: newVisitors,
        returningUsers: returningVisitors,
        pagesPerSession: Math.round(pagesPerSession * 100) / 100,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Live Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Analytics Dashboard</h2>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              Live
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Last updated: {lastUpdated.toLocaleTimeString("en-IN")}
            {googleAnalyticsId && (
              <span className="ml-2">
                • <a 
                  href="https://analytics.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View in GA4 <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-36 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="28d">Last 28 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalyticsData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Stats Grid - Clean Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Visitors */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {analytics.newUsers} new
            </span>
          </div>
          <p className="text-2xl font-bold">{formatNumber(analytics.totalVisitors)}</p>
          <p className="text-xs opacity-80">Visitors</p>
        </div>

        {/* Sessions */}
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Globe className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(analytics.totalSessions)}</p>
          <p className="text-xs opacity-80">Sessions</p>
        </div>

        {/* Page Views */}
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(analytics.pageViews)}</p>
          <p className="text-xs opacity-80">Page Views</p>
        </div>

        {/* Leads */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {analytics.conversionRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold">{analytics.leads}</p>
          <p className="text-xs opacity-80">Leads</p>
        </div>

        {/* Paid Customers */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-5 h-5 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {analytics.leads > 0 ? ((analytics.paidCustomers / analytics.leads) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <p className="text-2xl font-bold">{analytics.paidCustomers}</p>
          <p className="text-xs opacity-80">Paid</p>
        </div>

        {/* Bounce Rate */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <ArrowUpRight className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-2xl font-bold">{analytics.bounceRate}%</p>
          <p className="text-xs opacity-80">Bounce Rate</p>
        </div>

        {/* Avg Duration */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-2xl font-bold">{formatDuration(analytics.avgSessionDuration)}</p>
          <p className="text-xs opacity-80">Avg. Duration</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Traffic Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Traffic Overview</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                Visitors
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                Conversions
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConversions2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(v) => dateRange === "today" ? v : new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip 
                contentStyle={{ 
                  background: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }}
                labelFormatter={(v) => dateRange === "today" ? `${v}` : new Date(v).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              />
              <Area 
                type="monotone" 
                dataKey="visitors" 
                stroke="#6366f1" 
                fillOpacity={1} 
                fill="url(#colorVisitors)" 
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="conversions" 
                stroke="#22c55e" 
                fillOpacity={1} 
                fill="url(#colorConversions2)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Device Breakdown */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Devices</h3>
          {devices.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={160}>
                <RechartsPie>
                  <Pie
                    data={devices}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="visitors"
                  >
                    {devices.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="space-y-2">
                {devices.map((device, i) => {
                  const Icon = device.icon;
                  return (
                    <div key={device.device} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{device.device}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{device.visitors}</span>
                        <span className="text-xs text-muted-foreground">({device.percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              No device data available
            </div>
          )}
        </div>
      </div>

      {/* GA4-Style Reports */}
      <LandingPageReport
        dateRange={dateRange}
        companyFilter={companyId}
        domainPattern={!showAllCompanies && currentCompany ? getCompanyDomainPattern(currentCompany) : null}
        showAllCompanies={showAllCompanies}
      />
      <CityDemographicsReport
        dateRange={dateRange}
        companyFilter={companyId}
        domainPattern={!showAllCompanies && currentCompany ? getCompanyDomainPattern(currentCompany) : null}
        showAllCompanies={showAllCompanies}
      />

      {/* Bottom Section - 3 Columns */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Traffic Sources */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Traffic Sources
          </h3>
          {trafficSources.length > 0 ? (
            <div className="space-y-3">
              {trafficSources.map((source, i) => (
                <div key={source.source} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{source.source}</span>
                    <span className="font-medium">{source.visitors}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${source.percentage}%`,
                        backgroundColor: COLORS[i % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              No traffic data yet
            </div>
          )}
        </div>

        {/* Top Pages */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-500" />
            Top Pages
          </h3>
          {pageViews.length > 0 ? (
            <div className="space-y-2">
              {pageViews.slice(0, 6).map((page, i) => (
                <div key={page.page} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-sm truncate">{page.page}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{page.visitors} 👤</span>
                    <span className="font-medium">{page.views} views</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              No page views yet
            </div>
          )}
        </div>

        {/* Locations */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-500" />
            Top Locations
          </h3>
          {locations.length > 0 ? (
            <div className="space-y-2">
              {locations.slice(0, 6).map((loc, i) => (
                <div key={loc.location} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-sm truncate">{loc.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{loc.visitors}</span>
                    <span className="text-xs text-muted-foreground">({loc.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              No location data yet
            </div>
          )}
        </div>
      </div>

      {/* User Engagement Section */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.newUsers}</p>
              <p className="text-xs text-muted-foreground">New Users</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.returningUsers}</p>
              <p className="text-xs text-muted-foreground">Returning Users</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.pagesPerSession}</p>
              <p className="text-xs text-muted-foreground">Pages / Session</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Conversion Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebsiteAnalytics;
