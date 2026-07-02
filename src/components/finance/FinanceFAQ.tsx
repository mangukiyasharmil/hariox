import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "How do you offer the lowest interest rates?",
    answer: "We partner with 50+ RBI-registered banks and NBFCs. Our technology compares rates from all partners in real-time, ensuring you get the most competitive offer based on your credit profile.",
  },
  {
    question: "Are there any hidden charges?",
    answer: "Absolutely not. We believe in 100% transparency. All charges including processing fees, documentation charges, and any other applicable fees are disclosed upfront before you proceed with the application.",
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
    question: "Is my personal information secure?",
    answer: "Yes, we use bank-grade 256-bit SSL encryption to protect your data. We are fully compliant with RBI guidelines and never share your information without consent.",
  },
  {
    question: "Can I prepay or foreclose my loan?",
    answer: "Yes, most of our banking partners allow prepayment and foreclosure. Some may charge a nominal fee. We'll provide complete details about prepayment terms before you finalize your loan.",
  },
];

const FinanceFAQ = () => {
  return (
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a365d]/5 border border-[#1a365d]/10 mb-4">
              <HelpCircle className="w-4 h-4 text-[#c9a227]" />
              <span className="text-[#1a365d] text-xs font-semibold uppercase tracking-widest">FAQ</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a365d] mb-4" style={{ fontFamily: "'Georgia', serif" }}>
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600">
              Find answers to common questions about our loan services
            </p>
          </motion.div>

          {/* FAQ Accordion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, idx) => (
                <AccordionItem
                  key={idx}
                  value={`item-${idx}`}
                  className="bg-white border-2 border-gray-100 px-6 data-[state=open]:border-[#c9a227]/30"
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
        </div>
      </div>
    </section>
  );
};

export default FinanceFAQ;
