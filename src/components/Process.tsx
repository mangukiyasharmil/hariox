import { motion } from "framer-motion";
import { FileText, Search, Banknote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Process = () => {
  const { t } = useLanguage();

  const steps = [
  { icon: FileText, step: "01", title: t.step1Title, description: t.step1Desc },
  { icon: Search, step: "02", title: t.step2Title, description: t.step2Desc },
  { icon: Banknote, step: "03", title: t.step3Title, description: t.step3Desc }];


  return (
    <section id="process" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16">
          
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
            {t.howItWorksTitle}
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            {t.simple3Step.split("3")[0]}<span className="text-gradient-warm">3-{t.simple3Step.includes("Step") ? "Step" : t.simple3Step.includes("चरण") ? "चरण" : "படி"}</span> {t.simple3Step.split(" ").slice(-1)}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.processSubtitle} — Get the <strong className="text-primary">best instant personal loan</strong> approved in just 3 simple steps. Apply and get funds in 24 hours.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
          {steps.map((step, index) =>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="relative">
            
              {index < steps.length - 1 &&
            <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-border" />
            }
              <div className="relative bg-card rounded-2xl p-8 border border-border hover:border-primary/20 transition-all duration-300 h-full">
                <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full gradient-brand flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg">
                  {step.step}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                  <step.icon className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

};

export default Process;