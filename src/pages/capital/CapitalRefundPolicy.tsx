import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CapitalHeader from "@/components/capital/CapitalHeader";
import CapitalFooter from "@/components/capital/CapitalFooter";

const CapitalRefundPolicy = () => {
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

            <h1 className="text-4xl font-bold text-gray-900 mb-2">Refund Policy</h1>
            <p className="text-gray-500 mb-8">Last updated: February 2026</p>

            <div className="prose prose-lg max-w-none text-gray-700">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Overview</h2>
                <p className="text-gray-600 leading-relaxed">
                  At Capital Hariox, we strive to provide transparent and fair services to all 
                  our customers. This Refund Policy outlines the terms and conditions regarding 
                  refunds for fees paid for our loan facilitation services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Processing Fee</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Capital Hariox charges a nominal processing fee (₹399 + GST = ₹471) for loan facilitation services. 
                  The refund terms for this fee are as follows:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li><strong>Before Application Submission:</strong> Full refund if you decide not to proceed before submitting your application</li>
                  <li><strong>After Application Submission:</strong> Processing fee is generally non-refundable once your application has been submitted to our lending partners</li>
                  <li><strong>Loan Rejection:</strong> If your loan is rejected by all our lending partners due to no fault of your own, you may be eligible for a partial refund</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Non-Refundable Situations</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Refunds will not be provided in the following circumstances:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Loan rejection due to ineligibility based on standard criteria</li>
                  <li>Loan rejection due to poor credit score or credit history</li>
                  <li>Submission of false, incorrect, or misleading information</li>
                  <li>Failure to provide required documents within the stipulated time</li>
                  <li>Voluntary withdrawal of application after document processing has begun</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Refund Timeline</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Once a refund is approved:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li><strong>Credit/Debit Card:</strong> 5-7 business days</li>
                  <li><strong>UPI:</strong> 2-3 business days</li>
                  <li><strong>Net Banking:</strong> 5-7 business days</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Contact Us</h2>
                <p className="text-gray-600 leading-relaxed">
                  For refund-related queries, please contact us at:
                </p>
                <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-gray-900 font-medium">Capital Hariox</p>
                  <p className="text-gray-600">Email: hariox@gmail.com</p>
                  <p className="text-gray-600">Phone: +91 9422799318</p>
                  <p className="text-gray-600">Working Hours: Mon-Sat, 10:00 AM - 6:00 PM IST</p>
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

export default CapitalRefundPolicy;
