import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CapitalHeader from "@/components/capital/CapitalHeader";
import CapitalFooter from "@/components/capital/CapitalFooter";

const CapitalPrivacyPolicy = () => {
  const backUrl = '/';

  return (
    <div className="min-h-screen bg-white">
      <CapitalHeader />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <Link to={backUrl}>
              <Button variant="ghost" className="mb-6 text-emerald-600 hover:text-emerald-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>

            <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 mb-8">Last updated: February 2026</p>

            <div className="prose prose-lg max-w-none text-gray-700">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Introduction</h2>
                <p className="text-gray-600 leading-relaxed">
                  Capital Hariox ("we," "our," or "us") is committed to protecting your privacy. 
                  This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                  information when you visit our website or use our loan services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Information We Collect</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  We may collect information about you in a variety of ways:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li><strong>Personal Data:</strong> Name, email address, phone number, date of birth, PAN number, Aadhaar number, address, employment details, and income information.</li>
                  <li><strong>Financial Data:</strong> Bank account details, credit history, loan requirements, and payment information.</li>
                  <li><strong>Device Data:</strong> IP address, browser type, operating system, and device identifiers.</li>
                  <li><strong>Usage Data:</strong> Pages visited, time spent on pages, and navigation patterns.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. How We Use Your Information</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  We use the information we collect to:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Process your loan applications and verify your eligibility</li>
                  <li>Communicate with you about your application status and our services</li>
                  <li>Comply with legal and regulatory requirements</li>
                  <li>Prevent fraud and ensure security of our platform</li>
                  <li>Improve our services and user experience</li>
                  <li>Send promotional communications (with your consent)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Information Sharing</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  We may share your information with:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li><strong>Partner Banks and NBFCs:</strong> To process and evaluate your loan application</li>
                  <li><strong>Credit Bureaus:</strong> To verify your credit history and score</li>
                  <li><strong>Service Providers:</strong> Third-party vendors who assist in our operations</li>
                  <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Data Security</h2>
                <p className="text-gray-600 leading-relaxed">
                  We implement appropriate technical and organizational security measures to protect 
                  your personal information against unauthorized access, alteration, disclosure, or 
                  destruction. All data transmission is encrypted using SSL technology.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">6. Contact Us</h2>
                <p className="text-gray-600 leading-relaxed">
                  If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-gray-900 font-medium">Capital Hariox</p>
                  <p className="text-gray-600">Email: hariox@gmail.com</p>
                  <p className="text-gray-600">Phone: +91 9422799318</p>
                  <p className="text-gray-600">Address: Surat, Gujarat, India</p>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      </main>
      <CapitalFooter />
    </div>
  );
};

export default CapitalPrivacyPolicy;
