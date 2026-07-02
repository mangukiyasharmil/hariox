import { useEffect } from "react";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";

interface DynamicBrandProviderProps {
  children: React.ReactNode;
}

export const DynamicBrandProvider = ({ children }: DynamicBrandProviderProps) => {
  const { company, isLoading } = usePublicCompany();

  useEffect(() => {
    if (!company || isLoading) return;

    // Inject brand colors as CSS variables
    const root = document.documentElement;
    if (company.primary_color) {
      root.style.setProperty('--brand-primary', company.primary_color);
      // Convert hex to HSL for Tailwind-compatible CSS vars
      root.style.setProperty('--brand-primary-hex', company.primary_color);
    }
    if (company.secondary_color) {
      root.style.setProperty('--brand-secondary', company.secondary_color);
      root.style.setProperty('--brand-secondary-hex', company.secondary_color);
    }

    // Update page title
    if (company.name) {
      const currentTitle = document.title;
      if (!currentTitle.includes(company.name)) {
        document.title = `${company.name} - Fast Loan Approvals`;
      }
    }

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && company.name) {
      metaDesc.setAttribute('content', 
        `${company.name} - Get instant personal, business, and home loans with fast approvals. Apply online today.`
      );
    }

    // Update theme-color
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor && company.primary_color) {
      themeColor.setAttribute('content', company.primary_color);
    }

    // Update application-name
    const appName = document.querySelector('meta[name="application-name"]');
    if (appName && company.name) {
      appName.setAttribute('content', company.name);
    }

    // Update favicon if logo_url exists
    if (company.logo_url) {
      const existingFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (existingFavicon) {
        existingFavicon.href = company.logo_url;
      }
    }
  }, [company, isLoading]);

  return <>{children}</>;
};

export default DynamicBrandProvider;
