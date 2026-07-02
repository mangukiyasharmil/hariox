import { motion } from "framer-motion";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";
import { trackAnalyticsEvent } from "@/hooks/useAnalyticsTracker";

const WhatsAppWidget = () => {
  const { company } = usePublicCompany();
  const companyName = company?.name || "Credit Hariox";
  const whatsappNumber = company?.whatsapp_number || "918469391818";
  const message = `Hi ${companyName}, I have a question about loans`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  const handleClick = () => {
    trackAnalyticsEvent({
      eventType: "whatsapp_click",
      companyId: company?.id || null,
      metadata: {
        source: "floating_widget",
        whatsapp_number: whatsappNumber,
        page: window.location.pathname,
        referrer: document.referrer || null,
      },
    });
  };
  
  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-28 md:bottom-6 right-4 md:right-6 z-40 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:bg-[#20BD5A] group"
    >
      <WhatsAppIcon size="lg" className="text-white group-hover:scale-110 transition-transform" />
      
      {/* Pulse animation */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
    </motion.a>
  );
};

export default WhatsAppWidget;
