import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Company {
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
  is_active: boolean;
  monthly_fee?: number | null;
  setup_fee?: number | null;
  setup_fee_paid?: boolean | null;
  royalty_per_lead?: number | null;
  custom_domain?: string | null;
  royalty_type?: string | null;
  royalty_percentage?: number | null;
  gst_rate?: number | null;
}

interface CompanyContextType {
  companies: Company[];
  currentCompany: Company | null;
  setCurrentCompany: (company: Company) => void;
  isLoading: boolean;
  refetchCompanies: () => Promise<void>;
  showAllCompanies: boolean;
  setShowAllCompanies: (show: boolean) => void;
  getCompanyFilter: () => string | null;
  isAdmin: boolean;
  isFranchiseOwner: boolean;
  franchiseCompanyId: string | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
};

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFranchiseOwner, setIsFranchiseOwner] = useState(false);
  const [franchiseCompanyId, setFranchiseCompanyId] = useState<string | null>(null);

  const fetchCompanies = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      const userId = session.user.id;

      // Check if user is admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const userIsAdmin = roles?.some(r => r.role === "admin") || false;
      setIsAdmin(userIsAdmin);

      // Check if user is a franchise owner (check franchise_owner_companies table)
      const { data: franchiseOwnerRecord } = await supabase
        .from('franchise_owner_companies')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      const userIsFranchiseOwner = !!franchiseOwnerRecord;
      const franchiseOwnedCompanyId = franchiseOwnerRecord?.company_id || null;
      setIsFranchiseOwner(userIsFranchiseOwner);
      setFranchiseCompanyId(franchiseOwnedCompanyId);

      if (userIsFranchiseOwner && franchiseOwnedCompanyId) {
        const { data: ownCompany, error: ownErr } = await supabase
          .from('companies')
          .select('*')
          .eq('id', franchiseOwnedCompanyId)
          .eq('is_active', true)
          .single();
        if (ownErr) throw ownErr;
        if (ownCompany) {
          setCompanies([ownCompany as Company]);
          setCurrentCompany(ownCompany as Company);
        }
        setIsLoading(false);
        return; // early exit — franchise owner only sees their company
      }

      let companiesData: Company[];

      if (userIsAdmin) {
        // Admins see all active companies
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        companiesData = (data || []) as Company[];
      } else {
        // Non-admins only see their assigned companies via company_users
        const { data: userCompanies, error: ucError } = await supabase
          .from("company_users")
          .select("company_id")
          .eq("user_id", userId);
        if (ucError) throw ucError;

        const companyIds = (userCompanies || []).map(uc => uc.company_id);
        if (companyIds.length === 0) {
          companiesData = [];
        } else {
          const { data, error } = await supabase
            .from("companies")
            .select("*")
            .in("id", companyIds)
            .eq("is_active", true)
            .order("name");
          if (error) throw error;
          companiesData = (data || []) as Company[];
        }

        // Non-admins cannot use "All Companies" mode
        setShowAllCompanies(false);
      }

      setCompanies(companiesData);

      // Set first company as current if none selected
      if (companiesData.length > 0 && !currentCompany) {
        const savedCompanyId = localStorage.getItem("currentCompanyId");
        const savedShowAll = localStorage.getItem("showAllCompanies") === "true";

        if (savedShowAll && userIsAdmin) {
          setShowAllCompanies(true);
        }

        const savedCompany = companiesData.find(c => c.id === savedCompanyId);
        setCurrentCompany(savedCompany || companiesData[0]);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleSetCurrentCompany = (company: Company) => {
    // Franchise owners cannot switch companies
    if (isFranchiseOwner) return;
    setCurrentCompany(company);
    localStorage.setItem("currentCompanyId", company.id);
  };

  const handleSetShowAllCompanies = (show: boolean) => {
    // Franchise owners cannot use "All Companies" mode
    if (isFranchiseOwner) return;
    // Only admins can enable "All Companies"
    if (show && !isAdmin) return;
    setShowAllCompanies(show);
    localStorage.setItem("showAllCompanies", show.toString());
  };

  const getCompanyFilter = (): string | null => {
    // Franchise owners are always scoped to their company
    if (isFranchiseOwner) return franchiseCompanyId;
    if (showAllCompanies && isAdmin) return null;
    return currentCompany?.id || null;
  };

  return (
    <CompanyContext.Provider
      value={{
        companies,
        currentCompany,
        setCurrentCompany: handleSetCurrentCompany,
        isLoading,
        refetchCompanies: fetchCompanies,
        showAllCompanies,
        setShowAllCompanies: handleSetShowAllCompanies,
        getCompanyFilter,
        isAdmin,
        isFranchiseOwner,
        franchiseCompanyId,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};
