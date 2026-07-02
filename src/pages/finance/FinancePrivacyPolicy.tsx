import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FinanceHeader from "@/components/finance/FinanceHeader";
import FinanceFooter from "@/components/finance/FinanceFooter";

const FinancePrivacyPolicy = () => {
  const backUrl = '/';

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Privacy & Security Policy | Finance Hariox"
        description="Read the Finance Hariox Privacy Policy to understand how we collect, use, and protect your personal information when you use our website and services."
        keywords="Privacy Policy, Finance Hariox"
        canonicalUrl="https://finance.hariox.com/privacy-policy"
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

            <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 mb-8">Last updated: February 2026</p>

            <div className="prose prose-lg max-w-none text-gray-700">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Information We Collect</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  At Finance Hariox, we collect information that you provide directly to us, including:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Personal identification information (Name, email address, phone number)</li>
                  <li>Financial information (Income details, employment type, loan requirements)</li>
                  <li>KYC documents (PAN, Aadhaar, address proof)</li>
                  <li>Bank statements and income documents for loan processing</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. How We Use Your Information</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  We use the information we collect to:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Process and facilitate your loan applications with our partner banks and NBFCs</li>
                  <li>Communicate with you about your application status and requirements</li>
                  <li>Provide customer support and respond to your inquiries</li>
                  <li>Send important updates about our services and loan products</li>
                  <li>Improve our services and user experience</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Information Sharing</h2>
                <p className="text-gray-600 leading-relaxed">
                  We share your information only with our authorized banking partners and NBFCs for the purpose 
                  of loan processing. We do not sell, trade, or rent your personal information to third parties 
                  for marketing purposes. Your data is transmitted securely and handled in accordance with 
                  applicable data protection regulations.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Data Security</h2>
                <p className="text-gray-600 leading-relaxed">
                  We implement industry-standard security measures to protect your personal information, including 
                  encryption, secure servers, and access controls. However, no method of transmission over the 
                  internet is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Your Rights</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  You have the right to:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Access and review your personal information</li>
                  <li>Request corrections to inaccurate data</li>
                  <li>Request deletion of your data (subject to legal requirements)</li>
                  <li>Opt-out of marketing communications</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">6. Contact Us</h2>
                <p className="text-gray-600 leading-relaxed">
                  If you have any questions about this Privacy Policy, please contact us at:
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

export default FinancePrivacyPolicy;
