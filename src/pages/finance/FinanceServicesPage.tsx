import FinanceHeader from "@/components/finance/FinanceHeader";
import FinanceFooter from "@/components/finance/FinanceFooter";
import FinanceSupportWidget from "@/components/finance/FinanceSupportWidget";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead from "@/components/SEOHead";
import { PublicCompanyProvider } from "@/contexts/PublicCompanyContext";
import { motion } from "framer-motion";
import { useState } from "react";
import { Home, Briefcase, GraduationCap, Car, Coins, Heart, Users, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import FinanceApplicationModal from "@/components/finance/FinanceApplicationModal";

const services = [
  { icon: Users, title: "Personal Loan", description: "Quick personal loans up to ₹25 Lakhs with competitive interest rates starting 10.5% p.a.", rate: "10.5%", maxAmount: "₹25 Lakhs", features: ["Minimal Documentation", "Instant Approval", "Flexible Tenure"] },
  { icon: Briefcase, title: "Business Loan", description: "Fuel your business growth with loans up to ₹50 Lakhs. Special rates for MSMEs.", rate: "12%", maxAmount: "₹50 Lakhs", features: ["Collateral Free", "Quick Disbursal", "MSME Special Rates"] },
  { icon: Home, title: "Home Loan", description: "Make your dream home a reality with our lowest interest rates starting 8.5% p.a.", rate: "8.5%", maxAmount: "₹5 Crores", features: ["Lowest EMI", "Long Tenure", "Tax Benefits"] },
  { icon: GraduationCap, title: "Education Loan", description: "Invest in your future with education loans covering tuition, hostel, and more.", rate: "9%", maxAmount: "₹50 Lakhs", features: ["Moratorium Period", "No Collateral up to ₹7.5L", "Tax Benefits"] },
  { icon: Car, title: "Vehicle Loan", description: "Drive your dream car or bike home with easy vehicle loan options.", rate: "8.5%", maxAmount: "₹1 Crore", features: ["Quick Processing", "Flexible EMI", "New & Used Vehicles"] },
  { icon: Coins, title: "Gold Loan", description: "Unlock the value of your gold with instant gold loans at lowest interest rates.", rate: "7%", maxAmount: "₹50 Lakhs", features: ["Instant Disbursal", "Safe Gold Storage", "No Income Proof"] },
  { icon: Building2, title: "Loan Against Property", description: "Leverage your property to get high-value loans at competitive rates.", rate: "9.5%", maxAmount: "₹10 Crores", features: ["High Loan Value", "Long Tenure", "Lower Interest"] },
  { icon: Heart, title: "Medical Loan", description: "Don't let medical emergencies stress you financially. Get quick medical loans.", rate: "11%", maxAmount: "₹25 Lakhs", features: ["Same Day Approval", "No Collateral", "Flexible Repayment"] },
];

const fadeUp = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

const FinanceServicesPageContent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Finance Hariox | Personal, Home & Business Loans"
        description="Explore Finance Hariox loan services including personal, home, business, education and other loans with a quick approval, and trusted lenders in India."
        keywords="loan services, personal loan, home loan, business loan, education loan, vehicle loan, gold loan"
        canonicalUrl="https://finance.hariox.com/services"
      />
      <FinanceHeader />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-[#0d1b2a] via-[#1a365d] to-[#2c5282] py-20 lg:py-28 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-72 h-72 rounded-full border border-white/20" />
            <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full border border-[#c9a227]/30" />
          </div>
          <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center">
            <motion.span {...fadeUp} className="inline-block px-4 py-2 bg-[#c9a227]/20 text-[#c9a227] text-xs font-bold uppercase tracking-widest mb-6 rounded">
              Our Services
            </motion.span>
            <motion.h1 {...fadeUp} transition={{ delay: 0.1 }} className="text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Georgia', serif" }}>
              Loan Services
            </motion.h1>
            <motion.p {...fadeUp} transition={{ delay: 0.2 }} className="text-lg text-gray-300 max-w-2xl mx-auto">
              Compare and choose from 8+ loan products with the best interest rates from India's top banks & NBFCs.
            </motion.p>
          </div>
        </section>

        {/* Services Grid - matching homepage card design */}
        <section className="py-16 lg:py-24 bg-gray-50">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
              {services.map((service, idx) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white border border-gray-200 rounded-xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:border-[#c9a227]/30 group"
                >
                  {/* Icon and Rate Row */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 bg-[#1a365d] rounded-lg flex items-center justify-center group-hover:bg-[#c9a227] transition-colors">
                      <service.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#c9a227]" style={{ fontFamily: "'Georgia', serif" }}>
                        {service.rate}
                      </div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">P.A. Onwards</div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-[#1a365d] mb-2" style={{ fontFamily: "'Georgia', serif" }}>
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-600 text-sm mb-5 leading-relaxed">
                    {service.description}
                  </p>

                  {/* Features */}
                  <div className="space-y-2.5 mb-6">
                    {service.features.map((f) => (
                      <div key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <div className="w-1.5 h-1.5 bg-[#c9a227] rounded-full flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>

                  {/* Bottom: Max Amount & Apply */}
                  <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Up to</div>
                      <div className="text-lg font-bold text-[#1a365d]" style={{ fontFamily: "'Georgia', serif" }}>{service.maxAmount}</div>
                    </div>
                    <button
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a365d] uppercase tracking-widest hover:text-[#c9a227] transition-colors"
                      onClick={() => setIsModalOpen(true)}
                    >
                      Apply Now
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-[#1a365d] to-[#0d1b2a]">
          <div className="container mx-auto px-4 text-center">
            <motion.div {...fadeUp}>
              <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "'Georgia', serif" }}>Not Sure Which Loan is Right for You?</h2>
              <p className="text-gray-300 mb-8 max-w-lg mx-auto">Our experts will help you find the perfect loan product based on your needs and eligibility.</p>
              <Button size="lg" className="bg-[#c9a227] hover:bg-[#b8911f] text-white" onClick={() => setIsModalOpen(true)}>
                Get Free Consultation
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      <FinanceFooter />
      <StickyMobileCTA />
      <FinanceSupportWidget />
      <FinanceApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

const FinanceServicesPage = () => (
  <PublicCompanyProvider slug="finance">
    <FinanceServicesPageContent />
  </PublicCompanyProvider>
);

export default FinanceServicesPage;
