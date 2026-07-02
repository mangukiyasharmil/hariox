import { useState, useEffect, Suspense } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead, { organizationJsonLd, creditHarioxFaqJsonLd, loanOrCreditJsonLd } from "@/components/SEOHead";
import MetaPixel from "@/components/MetaPixel";
import GoogleAnalytics from "@/components/GoogleAnalytics";

import { PublicCompanyProvider, usePublicCompany } from "@/contexts/PublicCompanyContext";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy load ALL below-fold sections AND heavy widgets for faster mobile FCP
const BankPartners = lazyWithRetry(() => import("@/components/BankPartners"), "BankPartners");
const TrustBadgesSection = lazyWithRetry(() => import("@/components/TrustBadgesSection"), "TrustBadgesSection");
const Services = lazyWithRetry(() => import("@/components/Services"), "Services");
const EMICalculator = lazyWithRetry(() => import("@/components/EMICalculator"), "EMICalculator");
const Process = lazyWithRetry(() => import("@/components/Process"), "Process");
const VideoTestimonialCarousel = lazyWithRetry(() => import("@/components/landing/VideoTestimonialCarousel"), "VideoTestimonialCarouselCredit");
const Testimonials = lazyWithRetry(() => import("@/components/Testimonials"), "Testimonials");
const BlogSection = lazyWithRetry(() => import("@/components/BlogSection"), "BlogSection");
const FAQ = lazyWithRetry(() => import("@/components/FAQ"), "FAQ");
const CTA = lazyWithRetry(() => import("@/components/CTA"), "CTA");
const Footer = lazyWithRetry(() => import("@/components/Footer"), "Footer");


// Heavy widgets — lazy loaded so they don't block initial paint
const SupportWidget = lazyWithRetry(() => import("@/components/SupportWidget"), "SupportWidget");
const ApplicationModal = lazyWithRetry(() => import("@/components/ApplicationModal"), "ApplicationModal");

const SectionFallback = () => (
  <div className="py-16 flex items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
  </div>
);

const IndexContent = () => {
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

  const companyName = company?.name || "Credit Hariox";

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Get ₹10 Lakh Instant Personal Loan Online in 24 Hours"
        description="Get instant personal loan online up to ₹10 Lakh in 24hrs. Compare personal, home & business loans from 50+ banks. Apply now at Credit Hariox!"
        keywords="instant personal loan online, get instant personal loan, apply instant personal loan, instant personal loan india, credit hariox, best loan rates"
        canonicalUrl={company?.website_url || "https://credit.hariox.com"}
        jsonLd={[organizationJsonLd, creditHarioxFaqJsonLd, loanOrCreditJsonLd]}
      />
      <MetaPixel pixelId={company?.meta_pixel_id} />
      <GoogleAnalytics />
      
      
      
      <Header onApplyNow={() => setIsModalOpen(true)} />
      <main>
        <Hero onApplyNow={() => setIsModalOpen(true)} />
        
        {/* Each section gets its own Suspense boundary for independent loading */}
        <Suspense fallback={<SectionFallback />}>
          <TrustBadgesSection variant="grid" showCertifications={true} />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <BankPartners />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <Services />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <EMICalculator onApplyNow={handleApplyFromCalculator} />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <Process />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <VideoTestimonialCarousel variant="credit" />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <Testimonials />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <BlogSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FAQ />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <CTA />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <div className="h-20 md:hidden" />
      <StickyMobileCTA />
      
      <Suspense fallback={null}>
        <SupportWidget />
      </Suspense>
      
      
      <Suspense fallback={null}>
        <ApplicationModal 
          isOpen={isModalOpen} 
          onClose={() => {
            setIsModalOpen(false);
          }}
          prefillData={calculatorData}
        />
      </Suspense>

    </div>
  );
};

const Index = () => {
  return (
    <PublicCompanyProvider>
      <IndexContent />
    </PublicCompanyProvider>
  );
};

export default Index;
