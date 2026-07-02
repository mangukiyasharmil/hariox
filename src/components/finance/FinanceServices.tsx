import { motion } from "framer-motion";
import { Home, Briefcase, GraduationCap, Car, Coins, Users, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import FinanceApplicationModal from "./FinanceApplicationModal";

const services = [
{
  icon: Users,
  title: "Personal Loan",
  description: "Quick personal loans up to ₹25 Lakhs with competitive interest rates starting 10.5% p.a.",
  rate: "10.5%",
  maxAmount: "₹25 Lakhs",
  features: ["Minimal Documentation", "Instant Approval", "Flexible Tenure"]
},
{
  icon: Briefcase,
  title: "Business Loan",
  description: "Fuel your business growth with loans up to ₹50 Lakhs. Special rates for MSMEs.",
  rate: "12%",
  maxAmount: "₹50 Lakhs",
  features: ["Collateral Free", "Quick Disbursal", "MSME Special Rates"]
},
{
  icon: Home,
  title: "Home Loan",
  description: "Make your dream home a reality with our lowest interest rates starting 8.5% p.a.",
  rate: "8.5%",
  maxAmount: "₹5 Crores",
  features: ["Lowest EMI", "Long Tenure", "Tax Benefits"]
},
{
  icon: GraduationCap,
  title: "Education Loan",
  description: "Invest in your future with education loans covering domestic and international courses.",
  rate: "9%",
  maxAmount: "₹1 Crore",
  features: ["Moratorium Period", "No Collateral*", "Covers All Expenses"]
},
{
  icon: Car,
  title: "Vehicle Loan",
  description: "Drive home your dream car with attractive financing options and quick approval.",
  rate: "8.5%",
  maxAmount: "₹1 Crore",
  features: ["100% On-Road Funding", "Instant Approval", "Flexible EMI"]
},
{
  icon: Coins,
  title: "Gold Loan",
  description: "Unlock the value of your gold with instant loans at the lowest interest rates.",
  rate: "7%",
  maxAmount: "₹50 Lakhs",
  features: ["Instant Disbursal", "Flexible Repayment", "Safe Custody"]
}];


const FinanceServices = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section id="services" className="py-16 lg:py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 lg:mb-16">
            
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a365d]/5 border border-[#1a365d]/10 mb-4">
              <Building2 className="w-4 h-4 text-[#c9a227]" />
              <span className="text-[#1a365d] text-xs font-semibold uppercase tracking-widest">Our Loan Products</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a365d] mb-4" style={{ fontFamily: "'Georgia', serif" }}>
              Best Rates Across All Loan Types
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Compare interest rates from 50+ banks and choose the best deal. Instant personal loan in india with the lowest rates.


            </p>
          </motion.div>

          {/* Services Grid - Matching reference design */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {services.map((service, idx) => <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group bg-white border border-gray-200 rounded-xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:border-[#c9a227]/30">
              
                {/* Icon and Rate Row */}
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 bg-[#1a365d] rounded-lg flex items-center justify-center">
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

                {/* Features as bullet list */}
                <div className="space-y-2.5 mb-6">
                  {service.features.map((feature, fidx) =>
                <div key={fidx} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 bg-[#c9a227] rounded-full flex-shrink-0" />
                      {feature}
                    </div>
                )}
                </div>

                {/* Bottom: Max Amount & Apply */}
                <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Up to</div>
                    <div className="text-lg font-bold text-[#1a365d]" style={{ fontFamily: "'Georgia', serif" }}>{service.maxAmount}</div>
                  </div>
                  <button
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a365d] uppercase tracking-widest hover:text-[#c9a227] transition-colors"
                  onClick={() => setIsModalOpen(true)}>
                  
                    Apply Now
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      <FinanceApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>);

};

export default FinanceServices;