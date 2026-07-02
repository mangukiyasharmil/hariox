import { motion } from "framer-motion";
import { FileText, Search, Banknote, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Apply Online",
    description: "Fill a simple form in just 2 minutes. No paperwork needed.",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50",
  },
  {
    icon: Search,
    step: "02",
    title: "Quick Verification",
    description: "Our team verifies your documents instantly with AI-powered checks.",
    color: "from-purple-500 to-violet-500",
    bgColor: "bg-purple-50",
  },
  {
    icon: Banknote,
    step: "03",
    title: "Approved & Funded",
    description: "Receive approval within hours and funds transferred to your bank account the same day.",
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-50",
  },
];

const CapitalProcess = () => {
  return (
    <section id="process" className="py-20 lg:py-28 bg-gradient-to-br from-slate-50 to-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-sm font-semibold mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Get Funded in{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              3 Simple Steps
            </span>
          </h2>
          <p className="text-lg text-gray-600">
            Our streamlined process ensures you get funds faster than ever. No complicated procedures.
          </p>
        </motion.div>

        {/* Process Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-14 left-[60%] w-full h-0.5 bg-gradient-to-r from-gray-200 to-transparent z-0" />
                )}

                <div className="relative bg-white rounded-2xl p-6 lg:p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 h-full z-10">
                  {/* Step Number */}
                  <div className={`absolute -top-3 -right-3 w-10 h-10 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                    {step.step}
                  </div>

                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl ${step.bgColor} flex items-center justify-center mb-6`}>
                    <step.icon className="w-8 h-8 text-gray-700" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <a 
            href="#hero-form"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-full shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
          >
            Start Your Application
            <ArrowRight className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default CapitalProcess;
