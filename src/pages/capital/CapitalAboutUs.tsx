import CapitalHeader from "@/components/capital/CapitalHeader";
import CapitalFooter from "@/components/capital/CapitalFooter";
import CapitalSupportWidget from "@/components/capital/CapitalSupportWidget";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead from "@/components/SEOHead";
import { PublicCompanyProvider } from "@/contexts/PublicCompanyContext";
import { motion } from "framer-motion";
import {
  Eye, Target, Heart, TrendingUp, Shield, Users, Clock,
  Building2, Handshake, MessageSquare, Lock, HeartHandshake,
  BadgeCheck, Headphones, Globe, BarChart3
} from "lucide-react";

const visionMissionData = {
  vision: "To become one of India's most trusted, system-driven financial consulting brands, known for ethical practices and high approval accuracy.",
  mission: [
    "Deliver transparent financial guidance",
    "Process loans strictly as per eligibility",
    "Partner only with compliant banks & NBFCs",
    "Build a reporting-first team culture",
    "Use CRM, automation, and AI for scale",
  ],
  coreValues: [
    "Integrity & Transparency",
    "Customer Respect",
    "Accountability at Every Level",
    "Discipline in Time & Data",
    "Continuous Improvement",
  ],
  goals: [
    "Pan-India 21 States Physical presence",
    "Multi-vertical financial services",
    "Dubai, Singapore with Asia Start Consulting Firm",
    "By 2027 Daily 1200+ Customer Convert",
    "By 2030 ₹10 Million+ Revenue",
  ],
};

const whyChooseItems = [
  { icon: BadgeCheck, title: "Clear consulting fees policy" },
  { icon: Globe, title: "100% Online & Hassle free" },
  { icon: Building2, title: "Multi-bank & NBFC partnerships" },
  { icon: Users, title: "Dedicated verification & login teams" },
  { icon: BarChart3, title: "CRM-based lead tracking" },
  { icon: Clock, title: "Structured follow-up systems" },
  { icon: Lock, title: "Data security & confidentiality" },
  { icon: MessageSquare, title: "Honest rejection communication" },
  { icon: HeartHandshake, title: "Long-term relationship mindset" },
  { icon: Headphones, title: "Strong post-payment support" },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const CapitalAboutUsContent = () => (
  <div className="min-h-screen bg-white">
    <SEOHead
      title="About Us | Trusted Financial Consulting India"
      description="Learn about Capital Hariox's vision, mission, core values and goals. India's trusted financial consulting brand with fast loan approvals and ethical practices."
      keywords="about capital hariox, financial consulting India, loan company, trusted loan partner, capital hariox mission"
      canonicalUrl="https://capital.hariox.com/about"
    />
    <CapitalHeader />

    <main className="pt-20">
      {/* Hero Banner */}
      <section className="relative bg-gradient-to-br from-gray-900 via-emerald-900 to-teal-900 py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full border border-white/20" />
          <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full border border-emerald-400/30" />
        </div>
        <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center">
          <motion.span {...fadeUp} className="inline-block px-4 py-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-6">
            About Us
          </motion.span>
          <motion.h1 {...fadeUp} transition={{ delay: 0.1 }} className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Capital Hariox
          </motion.h1>
          <motion.p {...fadeUp} transition={{ delay: 0.2 }} className="text-lg text-gray-300 max-w-2xl mx-auto">
            Your Trusted Financial Partner — Fast loan approvals with minimal documentation and transparent guidance.
          </motion.p>
        </div>
      </section>

      {/* Vision, Mission, Core Values, Goals */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div {...fadeUp} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Vision</h2>
              </div>
              <p className="text-gray-600 leading-relaxed">{visionMissionData.vision}</p>
            </motion.div>

            <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Target className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Mission</h2>
              </div>
              <ul className="space-y-3">
                {visionMissionData.mission.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-teal-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Core Values</h2>
              </div>
              <ul className="space-y-3">
                {visionMissionData.coreValues.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-teal-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Goals</h2>
              </div>
              <ul className="space-y-3">
                {visionMissionData.goals.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Choose */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-14 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Choose <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Capital Hariox</span>
            </h2>
            <p className="text-gray-600">Your Trusted Financial Partner for Fast & Hassle-Free Loans</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {whyChooseItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-50 rounded-xl p-5 text-center border border-gray-100 hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                  <item.icon className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="container mx-auto px-4 text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-emerald-100 mb-8 max-w-lg mx-auto">
              Apply now and get fast loan approvals from 30+ RBI-registered banking partners.
            </p>
            <a
              href="/#home"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-600 font-bold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Apply for a Loan
            </a>
          </motion.div>
        </div>
      </section>
    </main>

    <CapitalFooter />
    <CapitalSupportWidget />
    <StickyMobileCTA />
  </div>
);

const CapitalAboutUs = () => (
  <PublicCompanyProvider slug="capital">
    <CapitalAboutUsContent />
  </PublicCompanyProvider>
);

export default CapitalAboutUs;
