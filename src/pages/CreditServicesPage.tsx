import { lazy, Suspense, useState } from "react";
import Header from "@/components/Header";
const Footer = lazy(() => import("@/components/Footer"));
const SupportWidget = lazy(() => import("@/components/SupportWidget"));
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead from "@/components/SEOHead";
import { PublicCompanyProvider } from "@/contexts/PublicCompanyContext";
import { motion } from "framer-motion";
import { Home, Briefcase, GraduationCap, Car, Coins, Heart, Users, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ApplicationModal from "@/components/ApplicationModal";

const services = [
  { icon: Users, title: "Personal Loan", description: "Quick personal loans with minimal documentation and instant approval.", rate: "10.5%", maxAmount: "₹25 Lakhs", features: ["Minimal Documentation", "Instant Approval", "Flexible Tenure"] },
  { icon: Briefcase, title: "Business Loan", description: "Grow your business with collateral-free loans and quick disbursal.", rate: "12%", maxAmount: "₹50 Lakhs", features: ["Collateral Free", "Quick Disbursal", "MSME Special Rates"] },
  { icon: Home, title: "Home Loan", description: "Make your dream home a reality with competitive interest rates.", rate: "8.5%", maxAmount: "₹5 Crores", features: ["Lowest EMI", "Long Tenure", "Tax Benefits"] },
  { icon: GraduationCap, title: "Education Loan", description: "Invest in your future with comprehensive education financing.", rate: "9%", maxAmount: "₹50 Lakhs", features: ["Moratorium Period", "No Collateral up to ₹7.5L", "Tax Benefits"] },
  { icon: Car, title: "Vehicle Loan", description: "Drive your dream vehicle home with easy financing options.", rate: "8.5%", maxAmount: "₹1 Crore", features: ["Quick Processing", "Flexible EMI", "New & Used Vehicles"] },
  { icon: Coins, title: "Gold Loan", description: "Unlock the value of your gold with instant disbursal.", rate: "7%", maxAmount: "₹50 Lakhs", features: ["Instant Disbursal", "Safe Gold Storage", "No Income Proof"] },
  { icon: Building2, title: "Loan Against Property", description: "Leverage your property for high-value loans.", rate: "9.5%", maxAmount: "₹10 Crores", features: ["High Loan Value", "Long Tenure", "Lower Interest"] },
  { icon: Heart, title: "Medical Loan", description: "Quick medical loans for emergencies without financial stress.", rate: "11%", maxAmount: "₹25 Lakhs", features: ["Same Day Approval", "No Collateral", "Flexible Repayment"] },
];

const fadeUp = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

const CreditServicesPageContent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Credit Hariox | Personal, Home & Business Loans"
        description="Explore Credit Hariox loan services including personal, home, business, and education loans with an easy application process and trusted lenders across India."
        keywords="loan services, personal loan, home loan, business loan, education loan, vehicle loan, gold loan"
        canonicalUrl="https://credit.hariox.com/services"
      />
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-20 lg:py-28 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-72 h-72 rounded-full border border-white/20" />
            <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full border border-blue-400/30" />
          </div>
          <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center">
            <motion.span {...fadeUp} className="inline-block px-4 py-2 bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest mb-6">
              Our Services
            </motion.span>
            <motion.h1 {...fadeUp} transition={{ delay: 0.1 }} className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Loan Services
            </motion.h1>
            <motion.p {...fadeUp} transition={{ delay: 0.2 }} className="text-lg text-gray-300 max-w-2xl mx-auto">
              Fast loan approvals with minimal documentation. Choose from 8+ loan products from 30+ banks.
            </motion.p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-16 lg:py-24 bg-gray-50">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {services.map((service, i) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                    <service.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <span className="text-blue-600 font-bold">From {service.rate} p.a.</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">Up to {service.maxAmount}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {service.features.map(f => (
                      <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white"
                    onClick={() => setIsModalOpen(true)}
                  >
                    Apply Now <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="container mx-auto px-4 text-center">
            <motion.div {...fadeUp}>
              <h2 className="text-3xl font-bold text-white mb-4">Not Sure Which Loan is Right for You?</h2>
              <p className="text-blue-100 mb-8 max-w-lg mx-auto">Our experts will help you find the perfect loan product based on your needs.</p>
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-50" onClick={() => setIsModalOpen(true)}>
                Get Free Consultation
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}><Footer /></Suspense>
      <StickyMobileCTA />
      <Suspense fallback={null}><SupportWidget /></Suspense>
      <Suspense fallback={null}>
        <ApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </Suspense>
    </div>
  );
};

const CreditServicesPage = () => (
  <PublicCompanyProvider slug="hariox">
    <CreditServicesPageContent />
  </PublicCompanyProvider>
);

export default CreditServicesPage;
