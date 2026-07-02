import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "How quickly can I get my loan approved?",
    answer: "Most loans are approved within 4-24 hours. Once approved, funds are transferred to your bank account the same day or within 24 hours.",
  },
  {
    question: "What documents do I need to apply?",
    answer: "You typically need PAN Card, Aadhaar Card, last 3 months' salary slips (for salaried), bank statements, and address proof. Our team will guide you through the exact requirements.",
  },
  {
    question: "What is the minimum and maximum loan amount?",
    answer: "Loan amounts range from ₹50,000 to ₹10 Lakhs depending on your eligibility and loan type. For home loans and property loans, higher amounts are available.",
  },
  {
    question: "What are the interest rates?",
    answer: "Interest rates vary based on loan type and your credit profile. Personal loans start from 10.5% p.a., home loans from 8.5% p.a., and business loans from 12% p.a.",
  },
  {
    question: "Is there any processing fee?",
    answer: "Yes, there's a minimal processing fee that varies by loan type. All fees are transparently disclosed before you proceed with the application.",
  },
  {
    question: "Can I prepay my loan?",
    answer: "Yes, you can prepay your loan partially or fully after a certain period. Prepayment terms depend on the loan product and will be clearly mentioned in your agreement.",
  },
];

const CapitalFAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 lg:py-28 bg-gradient-to-br from-slate-50 to-gray-50">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-sm font-semibold mb-4">
            FAQs
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-lg text-gray-600">
            Find answers to common questions about our loan products and process.
          </p>
        </motion.div>

        {/* FAQ List */}
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 pr-8">{faq.question}</span>
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  {openIndex === index ? (
                    <Minus className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Plus className="w-4 h-4 text-emerald-600" />
                  )}
                </span>
              </button>
              
              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? "auto" : 0,
                  opacity: openIndex === index ? 1 : 0,
                }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                  {faq.answer}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <a 
            href="https://wa.me/918469391818" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 font-semibold rounded-full hover:bg-emerald-100 transition-colors"
          >
            Chat with us on WhatsApp
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default CapitalFAQ;
