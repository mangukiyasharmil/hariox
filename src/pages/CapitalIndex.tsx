import { useState, useEffect, Suspense } from "react";
import CapitalHeader from "@/components/capital/CapitalHeader";
import CapitalHero from "@/components/capital/CapitalHero";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead, { organizationJsonLd, loanOrCreditJsonLd } from "@/components/SEOHead";
import MetaPixel from "@/components/MetaPixel";
import GoogleAnalytics from "@/components/GoogleAnalytics";

import { PublicCompanyProvider, usePublicCompany } from "@/contexts/PublicCompanyContext";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import CapitalApplicationModal from "@/components/capital/CapitalApplicationModal";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy load below-fold sections
const CapitalBankPartners = lazyWithRetry(() => import("@/components/capital/CapitalBankPartners"), "CapitalBankPartners");
const CapitalTrustSection = lazyWithRetry(() => import("@/components/capital/CapitalTrustSection"), "CapitalTrustSection");
const CapitalServices = lazyWithRetry(() => import("@/components/capital/CapitalServices"), "CapitalServices");
const CapitalHumanSection = lazyWithRetry(() => import("@/components/capital/CapitalHumanSection"), "CapitalHumanSection");
const EMICalculator = lazyWithRetry(() => import("@/components/EMICalculator"), "EMICalculatorCapital");
const CapitalProcess = lazyWithRetry(() => import("@/components/capital/CapitalProcess"), "CapitalProcess");
const CapitalSuccessStories = lazyWithRetry(() => import("@/components/capital/CapitalSuccessStories"), "CapitalSuccessStories");
const VideoTestimonialCarousel = lazyWithRetry(() => import("@/components/landing/VideoTestimonialCarousel"), "VideoTestimonialCarouselCapital");
const CapitalTestimonials = lazyWithRetry(() => import("@/components/capital/CapitalTestimonials"), "CapitalTestimonials");
const CapitalBlogSection = lazyWithRetry(() => import("@/components/capital/CapitalBlogSection"), "CapitalBlogSection");
const CapitalFAQ = lazyWithRetry(() => import("@/components/capital/CapitalFAQ"), "CapitalFAQ");
const CapitalCTA = lazyWithRetry(() => import("@/components/capital/CapitalCTA"), "CapitalCTA");
const CapitalFooter = lazyWithRetry(() => import("@/components/capital/CapitalFooter"), "CapitalFooter");
const CapitalSupportWidget = lazyWithRetry(() => import("@/components/capital/CapitalSupportWidget"), "CapitalSupportWidget");
const TrustBadgesSection = lazyWithRetry(() => import("@/components/TrustBadgesSection"), "TrustBadgesSectionCapital");


const SectionFallback = () => (
  <div className="py-16 flex items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
  </div>
);

const CapitalIndexContent = () => {
  const { company, isLoading: companyLoading } = usePublicCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calculatorData, setCalculatorData] = useState<{
    loanAmount?: number;
    interestRate?: number;
    tenure?: number;
    emi?: number;
  }>({});

  useAnalyticsTracker(company?.id);

  const handleApplyFromCalculator = (loanAmount: number, interestRate: number, tenure: number, emi: number) => {
    setCalculatorData({ loanAmount, interestRate, tenure, emi });
    setIsModalOpen(true);
  };

  const companyName = company?.name || "Capital Hariox";

  return (
    <div className="min-h-screen bg-white">
      <SEOHead 
        title="Get ₹10 Lakh Instant Personal Loan Online in 24 Hours"
        description="Get instant loan approval up to ₹10 Lakhs. Quick approvals, minimal documentation, funds in 24 hours. Trusted by 35,000+ customers. Apply now!"
        keywords="instant loan, quick loan approval, personal loan, home loan, business loan, education loan, fast loan, same day loan, India, capital hariox, hariox"
        canonicalUrl={company?.website_url || "https://capital.hariox.com"}
        jsonLd={[organizationJsonLd, loanOrCreditJsonLd]}
      />
      <MetaPixel pixelId={company?.meta_pixel_id} />
      <GoogleAnalytics measurementId="G-0J67L587VD" />



      <CapitalHeader />
      <main>
        <CapitalHero />

        <Suspense fallback={<SectionFallback />}>
          <TrustBadgesSection variant="grid" showCertifications={true} />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalBankPartners />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalTrustSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalServices />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalHumanSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <div id="calculator">
            <EMICalculator onApplyNow={handleApplyFromCalculator} />
          </div>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalProcess />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <div id="success-stories">
            <CapitalSuccessStories />
          </div>
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <VideoTestimonialCarousel variant="capital" />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalTestimonials />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalBlogSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalFAQ />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CapitalCTA />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <CapitalFooter />
      </Suspense>
      <div className="h-20 md:hidden" />
      <Suspense fallback={null}>
        <CapitalSupportWidget />
      </Suspense>
      <StickyMobileCTA />


      <CapitalApplicationModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
        }}
        prefillData={calculatorData}
      />

    </div>
  );
};

const CapitalIndex = () => {
  return (
    <PublicCompanyProvider slug="capital">
      <CapitalIndexContent />
    </PublicCompanyProvider>
  );
};

export default CapitalIndex;
