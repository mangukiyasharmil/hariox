import FinanceHeader from "@/components/finance/FinanceHeader";
import FinanceFooter from "@/components/finance/FinanceFooter";
import FinanceSupportWidget from "@/components/finance/FinanceSupportWidget";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import SEOHead, { createFaqJsonLd } from "@/components/SEOHead";
import { PublicCompanyProvider } from "@/contexts/PublicCompanyContext";
import { motion } from "framer-motion";
import { Phone } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    category: "General",
    items: [
      {
        question: "What is Finance Hariox?",
        answer: "Finance Hariox is a trusted financial consulting firm that connects customers with RBI-registered banks and NBFCs to get the best loan rates. We are not a direct lender — we act as your advisor to find the most suitable loan product.",
      },
      {
        question: "Is Finance Hariox an RBI-registered company?",
        answer: "We are a loan aggregator and consulting firm. We partner exclusively with RBI-registered banks and NBFCs to ensure full regulatory compliance for every loan we facilitate.",
      },
    ],
  },
  {
    category: "Loan Process",
    items: [
      {
        question: "How do you offer the lowest interest rates?",
        answer: "We partner with 50+ RBI-registered banks and NBFCs. Our technology compares rates from all partners in real-time, ensuring you get the most competitive offer based on your credit profile.",
      },
      {
        question: "How long does the loan approval process take?",
        answer: "Most loans are approved within 24-48 hours after document verification. For home loans and larger amounts, it may take 3-5 business days depending on the bank's verification process.",
      },
      {
        question: "What documents are required for a loan?",
        answer: "Basic documents include identity proof (Aadhaar/PAN), address proof, income proof (salary slips/ITR), and bank statements. Specific requirements may vary based on loan type and amount.",
      },
      {
        question: "Can I apply for a loan if I have a low CIBIL score?",
        answer: "Yes! We work with multiple NBFCs that consider applicants with CIBIL scores as low as 600. Our experts can guide you on improving your score and finding suitable loan options.",
      },
    ],
  },
  {
    category: "Fees & Charges",
    items: [
      {
        question: "Are there any hidden charges?",
        answer: "Absolutely not. We believe in 100% transparency. All charges including processing fees, documentation charges, and consulting fees are disclosed upfront before you proceed with the application.",
      },
      {
        question: "What is the consulting fee?",
        answer: "We charge a nominal consulting fee of ₹799 which covers your complete loan processing, document verification, and bank coordination. This fee is clearly communicated before you proceed.",
      },
      {
        question: "Can I prepay or foreclose my loan?",
        answer: "Yes, most of our banking partners allow prepayment and foreclosure. Some may charge a nominal fee. We'll provide complete details about prepayment terms before you finalize your loan.",
      },
    ],
  },
  {
    category: "Security & Support",
    items: [
      {
        question: "Is my personal information secure?",
        answer: "Yes, we use bank-grade 256-bit SSL encryption to protect your data. We are fully compliant with RBI guidelines and never share your information without consent.",
      },
      {
        question: "What happens if my loan is rejected?",
        answer: "If a loan application is rejected by one bank, we explore options with other banking partners. We also provide honest communication about rejection reasons and guide you on next steps.",
      },
      {
        question: "How can I track my loan application?",
        answer: "After applying, you'll receive a confirmation with your application ID. Our dedicated relationship manager will keep you updated via WhatsApp and phone calls throughout the process.",
      },
    ],
  },
];

const allFaqItems = faqs.flatMap(c => c.items);

const FinanceFAQPageContent = () => (
  <div className="min-h-screen bg-white">
    <SEOHead
      title="FAQs – Find Answers to Your Questions: Finance Hariox"
      description="Read helpful answers to common loan and finance questions. Finance Hariox makes it easy to understand important loan information and finance services."
      keywords="faqs, Finance Hariox, personal loan online"
      canonicalUrl="https://finance.hariox.com/faq"
      jsonLd={createFaqJsonLd(allFaqItems)}
    />
    <FinanceHeader />

    <main className="pt-20">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0d1b2a] via-[#1a365d] to-[#2c5282] py-16 lg:py-24">
        <div className="container mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Frequently Asked Questions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-300 max-w-xl mx-auto"
          >
            Everything you need to know about our loan services and process
          </motion.p>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          {faqs.map((category, catIdx) => (
            <motion.div
              key={catIdx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10"
            >
              <h2 className="text-xl font-bold text-[#1a365d] mb-4 flex items-center gap-3" style={{ fontFamily: "'Georgia', serif" }}>
                <span className="w-1.5 h-6 bg-[#c9a227] rounded-full" />
                {category.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-3">
                {category.items.map((faq, idx) => (
                  <AccordionItem
                    key={idx}
                    value={`cat-${catIdx}-item-${idx}`}
                    className="bg-gray-50 border border-gray-100 rounded-xl px-6 data-[state=open]:border-[#c9a227]/30 data-[state=open]:bg-white"
                  >
                    <AccordionTrigger className="text-left hover:no-underline py-5">
                      <span className="font-semibold text-[#1a365d]">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600 pb-5 leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          ))}

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 bg-gray-50 border border-gray-100 rounded-2xl">
              <div className="text-left">
                <p className="font-semibold text-[#1a365d]">Still have questions?</p>
                <p className="text-sm text-gray-500">Our loan experts are ready to help</p>
              </div>
              <a
                href="https://wa.me/918469391818?text=Hi%2C%20I%20have%20a%20question%20about%20loans"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
              >
                <Phone className="w-4 h-4" />
                Chat on WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </main>

    <FinanceFooter />
    <FinanceSupportWidget />
    <StickyMobileCTA />
  </div>
);

const FinanceFAQPage = () => (
  <PublicCompanyProvider slug="finance">
    <FinanceFAQPageContent />
  </PublicCompanyProvider>
);

export default FinanceFAQPage;
