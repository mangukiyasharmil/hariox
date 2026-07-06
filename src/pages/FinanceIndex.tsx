import { useState, useEffect, Suspense } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import FinanceHero from "@/components/finance/FinanceHero";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead, { organizationJsonLd, loanOrCreditJsonLd } from "@/components/SEOHead";
import MetaPixel from "@/components/MetaPixel";
import GoogleAnalytics from "@/components/GoogleAnalytics";

import { PublicCompanyProvider, usePublicCompany } from "@/contexts/PublicCompanyContext";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import FinanceApplicationModal from "@/components/finance/FinanceApplicationModal";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy load below-fold sections
const FinanceBankPartners = lazyWithRetry(() => import("@/components/finance/FinanceBankPartners"), "FinanceBankPartners");
const FinanceWhyChoose = lazyWithRetry(() => import("@/components/finance/FinanceWhyChoose"), "FinanceWhyChoose");
const FinanceServices = lazyWithRetry(() => import("@/components/finance/FinanceServices"), "FinanceServices");
const FinanceHumanSection = lazyWithRetry(() => import("@/components/finance/FinanceHumanSection"), "FinanceHumanSection");
const EMICalculator = lazyWithRetry(() => import("@/components/EMICalculator"), "EMICalculatorFinance");
const FinanceProcess = lazyWithRetry(() => import("@/components/finance/FinanceProcess"), "FinanceProcess");
const FinanceSuccessStories = lazyWithRetry(() => import("@/components/finance/FinanceSuccessStories"), "FinanceSuccessStories");
const FinanceTestimonials = lazyWithRetry(() => import("@/components/finance/FinanceTestimonials"), "FinanceTestimonials");
const VideoTestimonialCarousel = lazyWithRetry(() => import("@/components/landing/VideoTestimonialCarousel"), "VideoTestimonialCarouselFinance");
const FinanceBlogSection = lazyWithRetry(() => import("@/components/finance/FinanceBlogSection"), "FinanceBlogSection");
const FinanceFAQ = lazyWithRetry(() => import("@/components/finance/FinanceFAQ"), "FinanceFAQ");
const FinanceCTA = lazyWithRetry(() => import("@/components/finance/FinanceCTA"), "FinanceCTA");
const FinanceFooter = lazyWithRetry(() => import("@/components/finance/FinanceFooter"), "FinanceFooter");
const FinanceSupportWidget = lazyWithRetry(() => import("@/components/finance/FinanceSupportWidget"), "FinanceSupportWidget");
const TrustBadgesSection = lazyWithRetry(() => import("@/components/TrustBadgesSection"), "TrustBadgesSectionFinance");


const SectionFallback = () => (
  <div className="py-16 flex items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
  </div>
);

const FinanceIndexContent = () => {
  const { company, isLoading: companyLoading } = usePublicCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calculatorData, setCalculatorData] = useState<{
    loanAmount?: number;
    interestRate?: number;
    tenure?: number;
    emi?: number;
  }>({});

  useAnalyticsTracker(company?.id);

  // Google Search Console verification
  useEffect(() => {
    let meta = document.querySelector('meta[name="google-site-verification"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "google-site-verification");
      meta.setAttribute("content", "YTHTMZEqL1kj38M9TGVg1ynDqxs8-7dAjyUcO-t0F1k");
      document.head.appendChild(meta);
    } else {
      meta.setAttribute("content", "YTHTMZEqL1kj38M9TGVg1ynDqxs8-7dAjyUcO-t0F1k");
    }
  }, []);

  const googleAnalyticsId = company?.google_analytics_id || null;

  const handleApplyFromCalculator = (loanAmount: number, interestRate: number, tenure: number, emi: number) => {
    setCalculatorData({ loanAmount, interestRate, tenure, emi });
    setIsModalOpen(true);
  };

  const companyName = company?.name || "Finance Hariox";

  return (
    <div className="min-h-screen bg-white">
      <SEOHead 
        title="Get ₹10 Lakh Instant Personal Loan Online in 24 Hours"
        description="Get instant personal loan online starting 8.5% p.a. Compare loans from 50+ RBI-registered banks. Fast approval & 24hr disbursal. Apply now at Hariox!"
        keywords="instant personal loan online, get instant personal loan, instant personal loan apply online, instant personal loan india, instant personal loan low cibil, best instant personal loan, hariox finance"
        canonicalUrl={company?.website_url || "https://finance.hariox.com"}
        jsonLd={[organizationJsonLd, loanOrCreditJsonLd]}
      />
      <MetaPixel pixelId={company?.meta_pixel_id} />
      <GoogleAnalytics measurementId={googleAnalyticsId} />



      <FinanceHeader />
      <main>
        <FinanceHero />

        <Suspense fallback={<SectionFallback />}>
          <TrustBadgesSection variant="grid" showCertifications={true} />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceBankPartners />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceWhyChoose />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceServices />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceHumanSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <div id="calculator">
            <EMICalculator onApplyNow={handleApplyFromCalculator} />
          </div>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceProcess />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceSuccessStories />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <VideoTestimonialCarousel variant="credit" />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceTestimonials />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceBlogSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceFAQ />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinanceCTA />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <FinanceFooter />
      </Suspense>
      <div className="h-20 md:hidden" />
      <Suspense fallback={null}>
        <FinanceSupportWidget />
      </Suspense>
      <StickyMobileCTA />


      <FinanceApplicationModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
        }}
        prefillData={calculatorData}
      />

    </div>
  );
};

const FinanceIndex = () => {
  return (
    <PublicCompanyProvider slug="hariox">
      <FinanceIndexContent />
    </PublicCompanyProvider>
  );
};

export default FinanceIndex;
