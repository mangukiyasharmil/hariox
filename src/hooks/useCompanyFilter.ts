import { useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Shared hook to apply company-scoped Supabase query filters.
 * Eliminates repeated filter logic across dashboard, reports, and admin modules.
 */
export const useCompanyFilter = () => {
  const { currentCompany, getCompanyFilter, showAllCompanies } = useCompany();

  const companyId = getCompanyFilter();
  const isHariox = currentCompany?.slug === "hariox";

  /** Apply the company filter to any Supabase query builder. */
  const applyCompanyFilter = useCallback(
    (query: any) => {
      if (!companyId) return query;
      // For hariox (Credit Hariox), also include null company_id records
      return isHariox
        ? query.or(`company_id.eq.${companyId},company_id.is.null`)
        : query.eq("company_id", companyId);
    },
    [companyId, isHariox]
  );

  return {
    companyId,
    currentCompany,
    isHariox,
    showAllCompanies,
    applyCompanyFilter,
  };
};
