import { motion } from "framer-motion";
import { Home, Briefcase, Building2, GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const Services = () => {
  const { t } = useLanguage();

  const services = [
  { icon: Home, title: t.homeLoan, description: t.homeLoanDesc, color: "bg-primary/10 text-primary" },
  { icon: Briefcase, title: t.businessLoan, description: t.businessLoanDesc, color: "bg-secondary/10 text-secondary" },
  { icon: Building2, title: t.propertyLoan, description: t.propertyLoanDesc, color: "bg-accent/10 text-accent" },
  { icon: GraduationCap, title: t.educationLoan, description: t.educationLoanDesc, color: "bg-success/10 text-success" }];


  return (
    <section id="services" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16">
          
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
            {t.ourServices}
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            {t.whatWeOffer.split(" ").slice(0, -1).join(" ")}{" "}
            <span className="text-gradient-brand">{t.whatWeOffer.split(" ").slice(-1)}</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.servicesSubtitle} Compare the options with lowest rates from 50+ partner banks. Apply today.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {services.map((service, index) =>
          <motion.div
            key={index}
            variants={itemVariants}
            className="group bg-card rounded-2xl p-8 border border-border hover:border-secondary/30 transition-all duration-300 hover:shadow-lg">
            
              <div className={`w-14 h-14 rounded-xl ${service.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <service.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{service.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{service.description}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>);

};

export default Services;