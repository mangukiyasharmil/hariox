import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger } from
"@/components/ui/accordion";
import { HelpCircle, Shield, Clock, BadgePercent, FileText, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const faqs = [
{
  icon: BadgePercent,
  question: "What is the interest rate for personal loans?",
  answer: "Our personal loan interest rates start from just 8% p.a., varying based on your credit score, income, and loan amount. We work with 30+ banks and NBFCs to get you the best possible rate."
},
{
  icon: FileText,
  question: "What documents are required to apply for a loan?",
  answer: "Basic documents include: Aadhaar Card, PAN Card, 3 months bank statements, latest salary slips (for salaried), ITR (for self-employed), and address proof. Our team guides you through the entire documentation process."
},
{
  icon: Clock,
  question: "How long does the loan approval take?",
  answer: "Once all documents are submitted and verified, loan approval typically takes 24-48 hours. For pre-approved customers with good credit scores, same-day disbursement is possible."
},
{
  icon: Shield,
  question: "Is my personal information safe with you?",
  answer: "Absolutely! We use bank-grade encryption and follow strict data protection protocols. Your information is only shared with the bank/NBFC you choose for your loan application. We are RBI-compliant."
},
{
  icon: HelpCircle,
  question: "Can I apply for a loan if I have a low CIBIL score?",
  answer: "Yes! We work with multiple NBFCs that consider applicants with CIBIL scores as low as 600. Our experts can guide you on improving your score and finding suitable loan options."
},
{
  icon: Phone,
  question: "How can I track my loan application status?",
  answer: "After applying, you'll receive a confirmation with your application ID. Our dedicated relationship manager will keep you updated via WhatsApp and phone. You can also call our support team anytime."
}];


const FAQ = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-muted/30 to-background" id="faq">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            <HelpCircle className="w-4 h-4" />
            {t.faqTitle}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t.gotQuestions.split("?")[0]}? <span className="text-primary">{t.gotQuestions.split("?")[1]?.replace(/We've Got |हमारे पास |பதில்கள் /g, "").trim()}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t.faqSubtitle} Find answers about <strong className="text-primary">instant personal loan india</strong> applications, eligibility, and how to get the rates.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) =>
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card border border-border rounded-xl px-6 shadow-sm hover:shadow-md transition-shadow">
              
                <AccordionTrigger className="hover:no-underline py-5 gap-4">
                  <div className="flex items-center gap-4 text-left">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <faq.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-semibold text-foreground">{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 pl-14">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 bg-card border border-border rounded-2xl shadow-sm">
            <div className="text-left">
              <p className="font-semibold text-foreground">{t.stillHaveQuestions}</p>
              <p className="text-sm text-muted-foreground">{t.loanExpertsHelp}</p>
            </div>
            <a
              href="https://wa.me/918469391818?text=Hi%2C%20I%20have%20a%20question%20about%20loans"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors">
              
              <Phone className="w-4 h-4" />
              {t.chatOnWhatsApp}
            </a>
          </div>
        </div>
      </div>
    </section>);

};

export default FAQ;