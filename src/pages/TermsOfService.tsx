import SEOHead from "@/components/SEOHead";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Terms of Service | Credit Hariox – User Guidelines"
        description="Read Credit Hariox's Terms of Service to know the rules, guidelines, and conditions for using our website and loan services safely and responsibly."
        keywords="Terms of Service, General Terms and Conditions, personal loan"
        canonicalUrl="https://credit.hariox.com/terms-of-service"
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

            <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

            <div className="prose prose-lg max-w-none text-foreground">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing and using the Credit Hariox website and services, you accept and 
                  agree to be bound by these Terms of Service. If you do not agree to these terms, 
                  please do not use our services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">2. Services Description</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Credit Hariox is a loan facilitation platform that connects borrowers with 
                  various lending partners including banks and Non-Banking Financial Companies (NBFCs). 
                  We act as an intermediary and do not directly lend money. Final loan approval and 
                  terms are subject to the lending partner's policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">3. Eligibility</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To use our services, you must:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Be at least 21 years of age</li>
                  <li>Be a resident citizen of India</li>
                  <li>Have a valid PAN card and Aadhaar card</li>
                  <li>Have a regular source of income</li>
                  <li>Not have been declared insolvent or bankrupt</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">4. User Obligations</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  As a user of our services, you agree to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Not submit false or misleading information</li>
                  <li>Not use the service for any unlawful purpose</li>
                  <li>Keep your login credentials confidential</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">5. Loan Application Process</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  When you apply for a loan through our platform:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Your application will be shared with our lending partners</li>
                  <li>Lending partners may conduct their own verification and credit checks</li>
                  <li>Approval is at the sole discretion of the lending partner</li>
                  <li>Interest rates and terms are determined by the lending partner</li>
                  <li>We do not guarantee approval of any loan application</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">6. Fees and Charges</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Credit Hariox may charge a processing fee for loan facilitation services. 
                  All applicable fees will be clearly disclosed before you proceed with your 
                  application. Additional charges by lending partners (such as processing fees, 
                  prepayment charges, late payment fees) are governed by the lending partner's 
                  terms and conditions.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  All content on this website, including text, graphics, logos, images, and software, 
                  is the property of Hariox Finance and is protected by intellectual property laws. 
                  You may not reproduce, distribute, or create derivative works without our express 
                  written permission.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Hariox Finance shall not be liable for any direct, indirect, incidental, 
                  consequential, or punitive damages arising from your use of our services, 
                  including but not limited to loss of profits, data, or business opportunities. 
                  Our total liability shall not exceed the fees paid by you for our services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our services are provided "as is" and "as available" without any warranties of 
                  any kind, either express or implied. We do not warrant that our services will be 
                  uninterrupted, error-free, or free of viruses or other harmful components.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">10. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms of Service shall be governed by and construed in accordance with 
                  the laws of India. Any disputes arising from these terms shall be subject to 
                  the exclusive jurisdiction of the courts in Mumbai, Maharashtra.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">11. Modifications</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms of Service at any time. Changes will 
                  be effective immediately upon posting on this page. Your continued use of our 
                  services after any changes constitutes acceptance of the new terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-foreground font-medium">Hariox Corporate Services Pvt. Ltd.</p>
                  <p className="text-muted-foreground">Email: hariox@gmail.com</p>
                  <p className="text-muted-foreground">Phone: +91 9422799318</p>
                  <p className="text-muted-foreground">WhatsApp: +91 8469391818</p>
                  <p className="text-muted-foreground">Address: Surat, Gujarat, India</p>
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

export default TermsOfService;
