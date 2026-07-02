import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface CityData {
  city: string;
  state: string;
  leads: number;
  paid: number;
  revenue: number;
  conversionRate: number;
}

interface CityConversionReportProps {
  dateFilter: string;
  dateEndFilter?: string;
}

const CityConversionReport = ({ dateFilter, dateEndFilter }: CityConversionReportProps) => {
  const { currentCompany, getCompanyFilter } = useCompany();
  const [cities, setCities] = useState<CityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCityData();
  }, [dateFilter, dateEndFilter, currentCompany?.id]);

  const fetchCityData = async () => {
    try {
      setIsLoading(true);
      const companyId = getCompanyFilter();
      const isHariox = currentCompany?.slug === "hariox";

      let leadsQuery = supabase
        .from("leads")
        .select("id, city, state, status")
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
        setCities([]);
        setIsLoading(false);
        return;
      }

      const leadIds = leads.map(l => l.id);

      const { data: payments } = await supabase
        .from("payments")
        .select("lead_id, total_amount")
        .in("lead_id", leadIds)
        .in("status", ["completed", "captured"]);

      const paymentMap = new Map<string, number>();
      (payments || []).forEach(p => {
        paymentMap.set(p.lead_id, (paymentMap.get(p.lead_id) || 0) + p.total_amount);
      });
      const paidLeadIds = new Set(payments?.map(p => p.lead_id) || []);

      // Group by city
      const cityMap = new Map<string, CityData>();
      
      leads.forEach(lead => {
        const city = lead.city || "Unknown";
        const state = lead.state || "";
        const key = city.toLowerCase();
        
        if (!cityMap.has(key)) {
          cityMap.set(key, { city, state, leads: 0, paid: 0, revenue: 0, conversionRate: 0 });
        }
        
        const data = cityMap.get(key)!;
        data.leads++;
        if (paidLeadIds.has(lead.id)) {
          data.paid++;
          data.revenue += paymentMap.get(lead.id) || 0;
        }
      });

      const cityList = Array.from(cityMap.values())
        .map(c => ({ ...c, conversionRate: c.leads > 0 ? Math.round((c.paid / c.leads) * 100) : 0 }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);

      setCities(cityList);
    } catch (error) {
      console.error("Error fetching city data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">City-wise Conversion</h3>
        </div>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (cities.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">City-wise Conversion</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <MapPin className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-xs">No city data available</p>
        </div>
      </div>
    );
  }

  const avgConversion = Math.round(cities.reduce((s, c) => s + c.conversionRate, 0) / cities.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">City-wise Conversion</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          Avg: <span className="font-medium text-foreground">{avgConversion}%</span>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {cities.map((city, index) => (
          <motion.div
            key={city.city}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{index + 1}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{city.city}</p>
              {city.state && (
                <p className="text-[10px] text-muted-foreground">{city.state}</p>
              )}
            </div>

            <div className="flex items-center gap-3 text-right text-xs">
              <div>
                <p className="font-medium">{city.leads}</p>
                <p className="text-[10px] text-muted-foreground">leads</p>
              </div>
              <div>
                <p className="font-medium text-green-600">{city.paid}</p>
                <p className="text-[10px] text-muted-foreground">paid</p>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                city.conversionRate >= avgConversion 
                  ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
              }`}>
                {city.conversionRate >= avgConversion ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span className="text-[10px] font-medium">{city.conversionRate}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default CityConversionReport;
