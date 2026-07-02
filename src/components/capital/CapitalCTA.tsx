import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Phone, Shield, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import ApplicationModal from "../ApplicationModal";

const features = [
  { icon: Clock, text: "24-Hour Disbursal" },
  { icon: Shield, text: "100% Safe & Secure" },
  { icon: CheckCircle, text: "No Hidden Charges" },
];

const CapitalCTA = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <>
      <section id="contact" className="py-20 lg:py-28 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              Join over 35,000+ customers who trusted us. <strong>Get instant personal loan online</strong> — apply today and get funds within 24 hours!
            </p>

            {/* Features */}
            <div className="flex flex-wrap justify-center gap-6 mb-10">
              {features.map((feature, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/15 backdrop-blur-sm rounded-full border border-white/20"
                >
                  <feature.icon className="w-5 h-5 text-white" />
                  <span className="text-white font-medium">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                className="bg-white text-emerald-600 hover:bg-gray-50 font-bold text-lg px-8 py-6 rounded-full shadow-xl transition-all group w-full sm:w-auto"
                onClick={() => setIsModalOpen(true)}
              >
                Apply Now - It's Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <a href="https://wa.me/918469391818?text=Hello,%20I%20need%20loan%20assistance" target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline" 
                  className="border-2 border-white/40 text-white hover:bg-white/10 hover:border-white/60 text-lg px-8 py-6 rounded-full w-full sm:w-auto bg-transparent"
                >
                  <WhatsAppIcon size="md" className="mr-2" />
                  Chat on WhatsApp
                </Button>
              </a>
            </div>

            {/* Contact Info */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-white/70">
              <a href="tel:+919422799318" className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-5 h-5" />
                <span className="font-medium">+91 9422799318</span>
              </a>
              <span className="hidden sm:block text-white/30">•</span>
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Available 24/7
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <ApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default CapitalCTA;
