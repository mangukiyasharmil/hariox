import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FinanceHeader from "@/components/finance/FinanceHeader";
import FinanceFooter from "@/components/finance/FinanceFooter";
import CapitalHeader from "@/components/capital/CapitalHeader";
import CapitalFooter from "@/components/capital/CapitalFooter";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";

// Keep legacy hostname-based detection as a fallback only
const getLegacyCompanyFromHostname = (): "capital" | "finance" | "credit" => {
  const hostname = window.location.hostname.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const companyParam = urlParams.get("company");
  if (companyParam === "capital") return "capital";
  if (companyParam === "finance") return "finance";
  if (hostname.includes("capital.hariox") || hostname.startsWith("capital.") || hostname.includes("capital-hariox")) return "capital";
  if (hostname.includes("finance.hariox") || hostname.startsWith("finance.") || hostname.includes("finance-hariox")) return "finance";
  return "credit";
};

export const useDomainCompany = () => {
  // First try to get from PublicCompanyContext (DB-backed, supports any franchise domain)
  const { company } = usePublicCompany();
  const [legacyCompany] = useState(getLegacyCompanyFromHostname);
  
  // Map company slug to our internal brand keys
  if (company?.slug) {
    if (company.slug === 'capital') return 'capital' as const;
    if (company.slug === 'finance') return 'finance' as const;
  }
  return legacyCompany;
};

export const DomainHeader = ({ onApplyNow }: { onApplyNow?: () => void }) => {
  const company = useDomainCompany();
  if (company === "capital") return <CapitalHeader />;
  if (company === "finance") return <FinanceHeader />;
  return <Header onApplyNow={onApplyNow} />;
};

export const DomainFooter = () => {
  const company = useDomainCompany();
  if (company === "capital") return <CapitalFooter />;
  if (company === "finance") return <FinanceFooter />;
  return <Footer />;
};
