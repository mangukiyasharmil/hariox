import { motion } from "framer-motion";
import { FileText, UserCheck, CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import FinanceApplicationModal from "./FinanceApplicationModal";

const steps = [
  {
    number: "01",
    icon: FileText,
    title: "Submit Application",
    description: "Fill out a simple online form with your basic details and loan requirements.",
  },
  {
    number: "02",
    icon: UserCheck,
    title: "Document Verification",
    description: "Upload minimal documents. Our team verifies your eligibility within hours.",
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Approval & Disbursement",
    description: "Compare offers from 50+ banks, get approved and receive funds directly to your account.",
  },
];

const FinanceProcess = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section id="process" className="py-16 lg:py-24 bg-[#0d1b2a] relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#c9a227]/30 to-transparent" />
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-20 w-64 h-64 border border-[#c9a227] rotate-45" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 lg:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-[#c9a227]/40 bg-[#c9a227]/10 mb-4">
              <Sparkles className="w-4 h-4 text-[#c9a227]" />
              <span className="text-[#c9a227] text-xs font-semibold uppercase tracking-widest">Simple Process</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Georgia', serif" }}>
              How It Works
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Get your loan approved in 3 simple steps
            </p>
          </motion.div>

          {/* Process Steps */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-4">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative group"
              >
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-[#c9a227]/50 to-transparent z-0" />
                )}

                <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 hover:border-[#c9a227]/30 transition-all relative z-10 h-full">
                  {/* Step Number */}
                  <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-[#c9a227] to-[#daa520] flex items-center justify-center text-[#0d1b2a] font-bold text-sm">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 bg-[#1a365d] flex items-center justify-center mb-4 mt-4">
                    <step.icon className="w-6 h-6 text-[#c9a227]" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>
                    {step.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#c9a227] to-[#daa520] hover:from-[#b8941f] hover:to-[#c9a227] text-[#0d1b2a] font-bold px-8 py-6 rounded-none uppercase tracking-wider text-sm shadow-lg shadow-[#c9a227]/20"
              onClick={() => setIsModalOpen(true)}
            >
              Start Your Application
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      <FinanceApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default FinanceProcess;
