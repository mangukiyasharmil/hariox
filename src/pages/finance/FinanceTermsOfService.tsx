import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FinanceHeader from "@/components/finance/FinanceHeader";
import FinanceFooter from "@/components/finance/FinanceFooter";

const FinanceTermsOfService = () => {
  const backUrl = '/';

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="General Terms and Conditions | Finance Hariox"
        description="Read Finance Hariox's Terms of Service to understand the rules, conditions, and guidelines for using our website and loan services safely and responsibly."
        keywords="Terms of Service, General Terms and Conditions, personal loan"
        canonicalUrl="https://finance.hariox.com/terms-of-service"
      />
      <FinanceHeader />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <Link to={backUrl}>
              <Button variant="ghost" className="mb-6 text-[#1a365d] hover:text-[#c9a227]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>

            <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-gray-500 mb-8">Last updated: February 2026</p>

            <div className="prose prose-lg max-w-none text-gray-700">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Acceptance of Terms</h2>
                <p className="text-gray-600 leading-relaxed">
                  By accessing and using the Finance Hariox website and services, you accept and 
                  agree to be bound by these Terms of Service. If you do not agree to these terms, 
                  please do not use our services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Services Description</h2>
                <p className="text-gray-600 leading-relaxed">
                  Finance Hariox is a loan facilitation platform that connects borrowers with 
                  various lending partners including banks and Non-Banking Financial Companies (NBFCs). 
                  We act as an intermediary and do not directly lend money. Final loan approval and 
                  terms are subject to the lending partner's policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Eligibility</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  To use our services, you must:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Be at least 21 years of age</li>
                  <li>Be a resident citizen of India</li>
                  <li>Have a valid PAN card and Aadhaar card</li>
                  <li>Have a regular source of income</li>
                  <li>Not have been declared insolvent or bankrupt</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Fees and Charges</h2>
                <p className="text-gray-600 leading-relaxed">
                  Finance Hariox may charge a processing fee for loan facilitation services. 
                  All applicable fees will be clearly disclosed before you proceed with your 
                  application.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Governing Law</h2>
                <p className="text-gray-600 leading-relaxed">
                  These Terms of Service shall be governed by and construed in accordance with 
                  the laws of India. Any disputes arising from these terms shall be subject to 
                  the exclusive jurisdiction of the courts in Surat, Gujarat.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">6. Contact Us</h2>
                <p className="text-gray-600 leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <div className="mt-4 p-4 bg-[#1a365d]/5 rounded-lg border border-[#1a365d]/10">
                  <p className="text-gray-900 font-medium">Finance Hariox</p>
                  <p className="text-gray-600">Email: hariox@gmail.com</p>
                  <p className="text-gray-600">Phone: +91 9422799318</p>
                  <p className="text-gray-600">Address: Surat, Gujarat, India</p>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      </main>
      <FinanceFooter />
    </div>
  );
};

export default FinanceTermsOfService;
