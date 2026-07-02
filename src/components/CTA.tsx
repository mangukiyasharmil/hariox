import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import ApplicationModal from "./ApplicationModal";
import { useLanguage } from "@/contexts/LanguageContext";

const CTA = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <section id="contact" className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 gradient-brand" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNHMxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvZz48L3N2Zz4=')] opacity-30" />

        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
              {t.readyToStart}
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
              {t.ctaSubtitle} — Apply and get your <strong>instant personal loan online</strong> approved in just 24 hours.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="secondary" size="xl" className="group w-full sm:w-auto" onClick={() => setIsModalOpen(true)}>
                {t.startApplication}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <a href="https://wa.me/918469391818?text=Hello,%20I%20have%20a%20question%20about%20loans" target="_blank" rel="noopener noreferrer">
                <Button variant="ctaOutline" size="xl" className="w-full sm:w-auto">
                  <WhatsAppIcon size="md" className="mr-2" />
                  {t.chatOnWhatsApp}
                </Button>
              </a>
            </div>

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-primary-foreground/80">
              <a href="tel:+919422799318" className="flex items-center gap-2 hover:text-primary-foreground transition-colors">
                <Phone className="w-5 h-5" />
                <span className="font-medium">+91 9422799318</span>
              </a>
              <span className="hidden sm:block">•</span>
              <span>{t.available247}</span>
            </div>
          </motion.div>
        </div>
      </section>

      <ApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>);

};

export default CTA;