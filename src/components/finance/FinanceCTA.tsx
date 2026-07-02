import { motion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { useState } from "react";
import FinanceApplicationModal from "./FinanceApplicationModal";

const FinanceCTA = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section className="py-16 lg:py-24 bg-gradient-to-br from-[#1a365d] via-[#0d1b2a] to-[#1a365d] relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#c9a227]/50 to-transparent" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-64 h-64 border border-[#c9a227] rotate-45" />
          <div className="absolute bottom-10 left-10 w-48 h-48 border border-[#c9a227] -rotate-12" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}>
              
              <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6" style={{ fontFamily: "'Georgia', serif" }}>
                Ready to Get the <span className="text-[#c9a227]">Best Rate</span>?
              </h2>
              <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">Compare offers from 50+ banks and save thousands in interest payments. Instant personal loan online and start your application today.

                <strong></strong> — start your application today.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#c9a227] to-[#daa520] hover:from-[#b8941f] hover:to-[#c9a227] text-[#0d1b2a] font-bold px-10 py-7 rounded-none uppercase tracking-wider text-base shadow-lg shadow-[#c9a227]/30"
                  onClick={() => setIsModalOpen(true)}>
                  
                  Get Free Quote
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <a href="tel:+919422799318">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-2 border-[#c9a227] text-[#c9a227] hover:bg-[#c9a227]/10 px-10 py-7 rounded-none uppercase tracking-wider text-base font-bold">
                    
                    <Phone className="w-5 h-5 mr-2" />
                    Call Now
                  </Button>
                </a>
              </div>

              {/* WhatsApp */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="mt-8">
                
                <a
                  href="https://wa.me/918469391818?text=Hi,%20I%20want%20to%20know%20about%20loan%20rates"
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-[#c9a227] transition-colors">
                  
                  <WhatsAppIcon size="md" className="text-[#25D366]" />
                  <span>Or chat with us on WhatsApp</span>
                </a>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <FinanceApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>);

};

export default FinanceCTA;