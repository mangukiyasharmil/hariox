import { useCompany } from "@/contexts/CompanyContext";

export const useCompanyData = () => {
  const { currentCompany } = useCompany();

  const getCompanyFilter = () => {
    return currentCompany?.id || null;
  };

  return {
    currentCompanyId: currentCompany?.id,
    currentCompany,
    getCompanyFilter,
  };
};
