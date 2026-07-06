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
      // Force single company slug 'hariox' for Hariox CRM
      const companySlug = 'hariox';

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("slug", companySlug)
        .eq("is_active", true)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const companyData = data[0] as PublicCompany;
        setCompany(companyData);
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
