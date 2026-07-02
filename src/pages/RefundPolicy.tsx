import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const RefundPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Credit Hariox Refund Policy – Know Your Rights"
        description="Check Credit Hariox's Refund Policy to learn about refund conditions, payment rules, and important details for using our loan services safely and reliably."
        keywords="Refund Policy"
        canonicalUrl="https://credit.hariox.com/refund-policy"
      />
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <Link to="/">
              <Button variant="ghost" className="mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>

            <h1 className="text-4xl font-bold text-foreground mb-2">Refund Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

            <div className="prose prose-lg max-w-none text-foreground">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
                <p className="text-muted-foreground leading-relaxed">
                  At Hariox Finance, we strive to provide transparent and fair services to all 
                  our customers. This Refund Policy outlines the terms and conditions regarding 
                  refunds for fees paid for our loan facilitation services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">2. Processing Fee</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Hariox Finance charges a nominal processing fee for loan facilitation services. 
                  The refund terms for this fee are as follows:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Before Application Submission:</strong> Full refund if you decide not to proceed before submitting your application</li>
                  <li><strong>After Application Submission:</strong> Processing fee is generally non-refundable once your application has been submitted to our lending partners</li>
                  <li><strong>Loan Rejection:</strong> If your loan is rejected by all our lending partners due to no fault of your own, you may be eligible for a partial refund (up to 50% of the processing fee)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">3. Eligibility for Refund</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You may be eligible for a refund if:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>You were charged in error or charged twice for the same service</li>
                  <li>Our services were not delivered as promised due to technical issues on our end</li>
                  <li>You cancel your application within 24 hours of payment and before your documents are processed</li>
                  <li>Your loan application was rejected due to an error from our side</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">4. Non-Refundable Situations</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Refunds will not be provided in the following circumstances:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Loan rejection due to ineligibility based on standard criteria</li>
                  <li>Loan rejection due to poor credit score or credit history</li>
                  <li>Submission of false, incorrect, or misleading information</li>
                  <li>Failure to provide required documents within the stipulated time</li>
                  <li>Voluntary withdrawal of application after document processing has begun</li>
                  <li>Change of mind after loan approval</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">5. Refund Request Process</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To request a refund, please follow these steps:
                </p>
                <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
                  <li>Contact our customer support within 7 days of the transaction</li>
                  <li>Provide your application ID, payment receipt, and reason for refund request</li>
                  <li>Our team will review your request within 3-5 business days</li>
                  <li>If approved, the refund will be processed within 7-10 business days</li>
                  <li>Refund will be credited to the original payment method</li>
                </ol>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">6. Refund Timeline</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Once a refund is approved:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Credit/Debit Card:</strong> 5-7 business days</li>
                  <li><strong>UPI:</strong> 2-3 business days</li>
                  <li><strong>Net Banking:</strong> 5-7 business days</li>
                  <li><strong>Wallet:</strong> 1-2 business days</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Please note that the actual time for the refund to reflect in your account may 
                  vary depending on your bank or payment provider.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">7. Third-Party Fees</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Fees charged directly by lending partners, banks, or other third parties are 
                  governed by their respective refund policies. Hariox Finance is not responsible 
                  for refunding any fees collected by third parties. Please contact the respective 
                  organization directly for their refund policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">8. Disputes</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you believe your refund request was unfairly denied, you may escalate the 
                  matter by writing to our grievance officer at grievance@hariox.com. We will 
                  review your case and respond within 15 business days.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify this Refund Policy at any time. Changes will be 
                  effective immediately upon posting on this page. Please review this policy 
                  periodically for updates.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For refund-related queries, please contact us at:
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-foreground font-medium">Hariox Finance</p>
                  <p className="text-muted-foreground">Email: hariox@gmail.com</p>
                  <p className="text-muted-foreground">Phone: +91 9422799318</p>
                  <p className="text-muted-foreground">Working Hours: Mon-Sat, 10:00 AM - 6:00 PM IST</p>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RefundPolicy;
