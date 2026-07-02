import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PublicCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  website_url: string | null;
  meta_pixel_id: string | null;
  google_analytics_id: string | null;
  custom_domain: string | null;
  setup_fee: number | null;
  setup_fee_paid: boolean | null;
  royalty_per_lead: number | null;
  monthly_fee: number | null;
}

interface PublicCompanyContextType {
  company: PublicCompany | null;
  isLoading: boolean;
}

const PublicCompanyContext = createContext<PublicCompanyContextType | undefined>(undefined);

export const usePublicCompany = () => {
  const context = useContext(PublicCompanyContext);
  if (!context) {
    // Return default values if not wrapped in provider (backwards compatibility)
    return { company: null, isLoading: false };
  }
  return context;
};

interface PublicCompanyProviderProps {
  children: ReactNode;
  slug?: string;
}

export const PublicCompanyProvider = ({ children, slug }: PublicCompanyProviderProps) => {
  const [company, setCompany] = useState<PublicCompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCompany();
  }, [slug]);

  const fetchCompany = async () => {
    try {
      const hostname = window.location.hostname.toLowerCase();
      let companySlug = slug;
      let foundByCustomDomain = false;
      
      if (!companySlug) {
        // 0. Check pathname for /c/:slug or /:slug/admin
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] === 'c' && pathParts[2]) {
          companySlug = pathParts[2];
        } else if (pathParts[1] && (pathParts[2] === 'admin' || pathParts[2] === 'franchise-admin')) {
          companySlug = pathParts[1];
        }
        
        // 1. Try custom domain lookup first (for SaaS clients with their own domains)
        if (!companySlug) {
          const { data: domainMatch } = await supabase
            .rpc("lookup_company_by_domain", { _domain: hostname });
          
          if (domainMatch && domainMatch.length > 0) {
            setCompany(domainMatch[0] as unknown as PublicCompany);
            localStorage.setItem("publicCompanySlug", domainMatch[0].slug);
            localStorage.setItem("publicCompanyId", domainMatch[0].id);
            foundByCustomDomain = true;
            setIsLoading(false);
            return;
          }
        }
        
        // 2. Single brand: all Hariox domains resolve to slug 'hariox'
        companySlug = 'hariox';
      }

      let query = supabase
        .from("companies")
        .select("*")
        .eq("is_active", true);

      if (companySlug) {
        query = query.eq("slug", companySlug);
      }

      const { data, error } = await query.order("created_at").limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const companyData = data[0] as PublicCompany;
        setCompany(companyData);
        // Store for current session only
        localStorage.setItem("publicCompanySlug", companyData.slug);
        localStorage.setItem("publicCompanyId", companyData.id);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicCompanyContext.Provider value={{ company, isLoading }}>
      {children}
    </PublicCompanyContext.Provider>
  );
};

// Helper to get current company ID for forms
export const getCurrentCompanyId = (): string | null => {
  return localStorage.getItem("publicCompanyId");
};
