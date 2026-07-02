import { Suspense, useEffect, useState, forwardRef } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import GlobalPageTracker from "./components/GlobalPageTracker";
import { LanguageProvider } from "./contexts/LanguageContext";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { PublicCompanyProvider } from "@/contexts/PublicCompanyContext";
import DynamicBrandProvider from "@/components/DynamicBrandProvider";

// Eagerly load the main landing page for fastest FCP
import Index from "./pages/Index";

// Lazy load ALL other pages — they only load when navigated to
const CapitalIndex = lazyWithRetry(() => import("./pages/CapitalIndex"), "CapitalIndex");
const FinanceIndex = lazyWithRetry(() => import("./pages/FinanceIndex"), "FinanceIndex");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "NotFound");
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"), "PrivacyPolicy");
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"), "TermsOfService");
const RefundPolicy = lazyWithRetry(() => import("./pages/RefundPolicy"), "RefundPolicy");
const CapitalPrivacyPolicy = lazyWithRetry(() => import("./pages/capital/CapitalPrivacyPolicy"), "CapitalPrivacyPolicy");
const CapitalTermsOfService = lazyWithRetry(() => import("./pages/capital/CapitalTermsOfService"), "CapitalTermsOfService");
const CapitalRefundPolicy = lazyWithRetry(() => import("./pages/capital/CapitalRefundPolicy"), "CapitalRefundPolicy");
const CapitalAboutUs = lazyWithRetry(() => import("./pages/capital/CapitalAboutUs"), "CapitalAboutUs");
const CapitalFAQPage = lazyWithRetry(() => import("./pages/capital/CapitalFAQPage"), "CapitalFAQPage");
const CapitalContactUs = lazyWithRetry(() => import("./pages/capital/CapitalContactUs"), "CapitalContactUs");
const CapitalServicesPage = lazyWithRetry(() => import("./pages/capital/CapitalServicesPage"), "CapitalServicesPage");
const FinancePrivacyPolicy = lazyWithRetry(() => import("./pages/finance/FinancePrivacyPolicy"), "FinancePrivacyPolicy");
const FinanceTermsOfService = lazyWithRetry(() => import("./pages/finance/FinanceTermsOfService"), "FinanceTermsOfService");
const FinanceRefundPolicy = lazyWithRetry(() => import("./pages/finance/FinanceRefundPolicy"), "FinanceRefundPolicy");
const FinanceAboutUs = lazyWithRetry(() => import("./pages/finance/FinanceAboutUs"), "FinanceAboutUs");
const FinanceContactUs = lazyWithRetry(() => import("./pages/finance/FinanceContactUs"), "FinanceContactUs");
const FinanceServicesPage = lazyWithRetry(() => import("./pages/finance/FinanceServicesPage"), "FinanceServicesPage");
const CreditAboutUs = lazyWithRetry(() => import("./pages/CreditAboutUs"), "CreditAboutUs");
const CreditServicesPage = lazyWithRetry(() => import("./pages/CreditServicesPage"), "CreditServicesPage");
const FinanceFAQPage = lazyWithRetry(() => import("./pages/finance/FinanceFAQPage"), "FinanceFAQPage");
const PaymentPage = lazyWithRetry(() => import("./pages/PaymentPage"), "PaymentPage");
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"), "PaymentSuccess");
const DocumentUpload = lazyWithRetry(() => import("./pages/DocumentUpload"), "DocumentUpload");
const UniversalDocumentUpload = lazyWithRetry(() => import("./pages/UniversalDocumentUpload"), "UniversalDocumentUpload");
const CustomerPortal = lazyWithRetry(() => import("./pages/CustomerPortal"), "CustomerPortal");
const AdminLogin = lazyWithRetry(() => import("./pages/admin/AdminLogin"), "AdminLogin");
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"), "AdminDashboard");
const FranchiseAdminLogin = lazyWithRetry(() => import('./pages/admin/FranchiseAdminLogin'), 'FranchiseAdminLogin');
const TelecallerPayment = lazyWithRetry(() => import("./pages/TelecallerPayment"), "TelecallerPayment");
const Blog = lazyWithRetry(() => import("./pages/Blog"), "Blog");
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"), "BlogPost");
const ContactUs = lazyWithRetry(() => import("./pages/ContactUs"), "ContactUs");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Page loading spinner
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Detect which company domain we're on
const getCompanyFromHostname = (): "capital" | "finance" | "hariox" | null => {
  const hostname = window.location.hostname.toLowerCase();
  
  if (hostname.includes("capital.hariox") || hostname.startsWith("capital.") || hostname.includes("capital-hariox")) {
    return "capital";
  }
  if (hostname.includes("finance.hariox") || hostname.startsWith("finance.") || hostname.includes("finance-hariox")) {
    return "finance";
  }
  if (hostname.includes("credit.hariox") || hostname.startsWith("credit.") || hostname.includes("hariox")) {
    return "hariox";
  }
  
  return null;
};

const getCompany = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const companyParam = urlParams.get('company');
  if (companyParam === 'capital') return 'capital';
  if (companyParam === 'finance') return 'finance';
  
  const pathParts = window.location.pathname.split('/');
  if (pathParts[1] === 'c' && pathParts[2]) {
    const pSlug = pathParts[2].toLowerCase();
    if (pSlug === 'capital') return 'capital';
    if (pSlug === 'finance') return 'finance';
    if (pSlug === 'credit' || pSlug === 'hariox') return 'hariox';
  }
  
  return getCompanyFromHostname();
};

// Global manifest handler that runs on initial load
const ManifestHandler = () => {
  const location = useLocation();

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith("/admin");
    const company = getCompany();
    
    const existingManifest = document.querySelector('link[rel="manifest"]');
    const newManifestHref = isAdminRoute ? '/admin-manifest.json' : '/manifest.json';
    
    if (existingManifest) {
      if (existingManifest.getAttribute('href') !== newManifestHref) {
        existingManifest.remove();
        const newManifestLink = document.createElement('link');
        newManifestLink.rel = 'manifest';
        newManifestLink.href = newManifestHref;
        document.head.appendChild(newManifestLink);
      }
    }

    const appNameMeta = document.querySelector('meta[name="application-name"]');
    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (isAdminRoute) {
      document.title = "Hariox Admin";
      if (appNameMeta) appNameMeta.setAttribute("content", "Hariox Admin");
      if (appleTitleMeta) appleTitleMeta.setAttribute("content", "Hariox Admin");
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#0f172a");
    } else if (company === "capital") {
      document.title = "Capital Hariox - Fast Loan Approvals";
      if (appNameMeta) appNameMeta.setAttribute("content", "Capital Hariox");
      if (appleTitleMeta) appleTitleMeta.setAttribute("content", "Capital Hariox");
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#0f2744");
    } else {
      if (appNameMeta) appNameMeta.setAttribute("content", "Credit Hariox");
      if (appleTitleMeta) appleTitleMeta.setAttribute("content", "Credit Hariox");
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#1e3a5f");
    }
  }, [location.pathname]);

  return null;
};

// Domain-aware home page component
const DomainAwareHome = forwardRef<HTMLDivElement>((_, ref) => {
  const [company] = useState(getCompany);
  
  if (company === "capital") {
    return <Suspense fallback={<PageLoader />}><CapitalIndex /></Suspense>;
  }
  if (company === "finance") {
    return <Suspense fallback={<PageLoader />}><FinanceIndex /></Suspense>;
  }
  return <Index />;
});

// Domain-aware legal pages
const DomainAwareLegalPage = ({ page }: { page: 'privacy' | 'terms' | 'refund' }) => {
  const [company] = useState(getCompany);

  if (company === 'capital') {
    if (page === 'privacy') return <CapitalPrivacyPolicy />;
    if (page === 'terms') return <CapitalTermsOfService />;
    if (page === 'refund') return <CapitalRefundPolicy />;
  }

  if (company === 'finance') {
    if (page === 'privacy') return <FinancePrivacyPolicy />;
    if (page === 'terms') return <FinanceTermsOfService />;
    if (page === 'refund') return <FinanceRefundPolicy />;
  }

  if (page === 'privacy') return <PrivacyPolicy />;
  if (page === 'terms') return <TermsOfService />;
  return <RefundPolicy />;
};

// Domain-aware About Us page
const DomainAwareAboutPage = () => {
  const [company] = useState(getCompany);
  if (company === 'capital') return <CapitalAboutUs />;
  if (company === 'finance') return <FinanceAboutUs />;
  return <CreditAboutUs />;
};

// Domain-aware FAQ page
const DomainAwareFAQPage = () => {
  const [company] = useState(getCompany);
  if (company === 'capital') return <CapitalFAQPage />;
  return <FinanceFAQPage />;
};

// Domain-aware Contact page
const DomainAwareContactPage = () => {
  const [company] = useState(getCompany);
  if (company === 'capital') return <CapitalContactUs />;
  if (company === 'finance') return <FinanceContactUs />;
  return <ContactUs />;
};

// Domain-aware Services page
const DomainAwareServicesPage = () => {
  const [company] = useState(getCompany);
  if (company === 'capital') return <CapitalServicesPage />;
  if (company === 'finance') return <FinanceServicesPage />;
  return <CreditServicesPage />;
};

const AppRoutes = () => {
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const isAdminRoute = location.pathname.startsWith("/admin") ||
    (pathParts.length >= 3 && (pathParts[2] === 'admin' || pathParts[2] === 'franchise-admin')) ||
    (pathParts.length >= 2 && pathParts[1] === 'admin');

  return (
    <>
      <ManifestHandler />
      {!isAdminRoute && <GlobalPageTracker />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<DomainAwareHome />} />
          <Route path="/privacy-policy" element={<DomainAwareLegalPage page="privacy" />} />
          <Route path="/terms-conditions" element={<DomainAwareLegalPage page="terms" />} />
          <Route path="/refund-policy" element={<DomainAwareLegalPage page="refund" />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/upload-documents" element={<DocumentUpload />} />
          <Route path="/upload" element={<UniversalDocumentUpload />} />
          <Route path="/my-account" element={<CustomerPortal />} />
          <Route path="/customer" element={<CustomerPortal />} />
          <Route path="/about-us" element={<DomainAwareAboutPage />} />
          <Route path="/faq" element={<DomainAwareFAQPage />} />
          <Route path="/contact-us" element={<DomainAwareContactPage />} />
          <Route path="/services" element={<DomainAwareServicesPage />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/pay/:slug" element={<TelecallerPayment />} />
          <Route path="/marketing" element={<TelecallerPayment />} />
          <Route path="/whatsapp" element={<TelecallerPayment />} />
          <Route path="/telecaller" element={<TelecallerPayment />} />

          {/* Slug-based paths */}
          <Route path="/c/:companySlug" element={<DomainAwareHome />} />
          <Route path="/c/:companySlug/privacy-policy" element={<DomainAwareLegalPage page="privacy" />} />
          <Route path="/c/:companySlug/terms-conditions" element={<DomainAwareLegalPage page="terms" />} />
          <Route path="/c/:companySlug/refund-policy" element={<DomainAwareLegalPage page="refund" />} />
          <Route path="/c/:companySlug/payment" element={<PaymentPage />} />
          <Route path="/c/:companySlug/payment/success" element={<PaymentSuccess />} />
          <Route path="/c/:companySlug/upload-documents" element={<DocumentUpload />} />
          <Route path="/c/:companySlug/upload" element={<UniversalDocumentUpload />} />
          <Route path="/c/:companySlug/my-account" element={<CustomerPortal />} />
          <Route path="/c/:companySlug/customer" element={<CustomerPortal />} />
          <Route path="/c/:companySlug/about-us" element={<DomainAwareAboutPage />} />
          <Route path="/c/:companySlug/faq" element={<DomainAwareFAQPage />} />
          <Route path="/c/:companySlug/contact-us" element={<DomainAwareContactPage />} />
          <Route path="/c/:companySlug/services" element={<DomainAwareServicesPage />} />
          <Route path="/c/:companySlug/blog" element={<Blog />} />
          <Route path="/c/:companySlug/blog/:slug" element={<BlogPost />} />
          <Route path="/c/:companySlug/pay/:slug" element={<TelecallerPayment />} />
          <Route path="/c/:companySlug/marketing" element={<TelecallerPayment />} />
          <Route path="/c/:companySlug/whatsapp" element={<TelecallerPayment />} />
          <Route path="/c/:companySlug/telecaller" element={<TelecallerPayment />} />
          <Route path="/c/:companySlug/admin" element={<AdminLogin />} />
          <Route path="/c/:companySlug/admin/dashboard/*" element={<AdminDashboard />} />
          <Route path="/c/:companySlug/franchise-admin" element={<FranchiseAdminLogin />} />
          <Route path="/c/:companySlug/franchise-admin/dashboard/*" element={<AdminDashboard />} />

          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
          <Route path="/franchise-admin" element={<FranchiseAdminLogin />} />
          <Route path="/franchise-admin/dashboard/*" element={<AdminDashboard />} />

          {/* Short admin routes: hariox.com/:companySlug/admin */}
          <Route path="/:companySlug/admin" element={<AdminLogin />} />
          <Route path="/:companySlug/admin/dashboard/*" element={<AdminDashboard />} />
          <Route path="/:companySlug/franchise-admin" element={<FranchiseAdminLogin />} />
          <Route path="/:companySlug/franchise-admin/dashboard/*" element={<AdminDashboard />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <PublicCompanyProvider>
            <DynamicBrandProvider>
              <AppRoutes />
            </DynamicBrandProvider>
          </PublicCompanyProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
