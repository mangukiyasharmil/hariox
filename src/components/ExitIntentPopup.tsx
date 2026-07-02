import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, ArrowRight, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackLead, setAdvancedMatchingData } from "@/components/MetaPixel";

interface ExitIntentPopupProps {
  companyId?: string;
  variant?: "discount" | "consultation" | "emi-calculator";
  onClose?: () => void;
}

const ExitIntentPopup = ({ companyId, variant = "discount", onClose: onCloseProp }: ExitIntentPopupProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  // No auto-trigger logic — popup visibility is controlled by parent

  const handleClose = () => {
    setIsVisible(false);
    onCloseProp?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Capture Meta fbc/fbp cookies for server-side CAPI attribution
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
      };

      // Create lead with exit-intent source
      const { error, data } = await supabase.functions.invoke("upsert-lead", {
        body: {
          full_name: formData.name,
          phone: formData.phone,
          email: `${formData.phone}@exitintent.temp`,
          city: "Not specified",
          loan_type: "personal",
          loan_amount: 100000,
          employment_type: "salaried",
          monthly_income: 30000,
          source: "exit_intent_popup",
          company_id: companyId,
          meta_fbc: getCookie('_fbc'),
          meta_fbp: getCookie('_fbp'),
        },
      });

      if (error) throw error;

      // Store for Meta Advanced Matching & fire Lead pixel event
      setAdvancedMatchingData(`${formData.phone}@exitintent.temp`, formData.phone);
      trackLead({ content_name: "exit_intent_popup", value: 100000 }, data?.id);

      toast.success("Thank you! Our team will contact you shortly.");
      setIsVisible(false);
    } catch (err) {
      console.error("Exit popup submit error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getContent = () => {
    switch (variant) {
      case "consultation":
        return {
          title: "Wait! Get Free Consultation",
          subtitle: "Our loan experts will call you within 5 minutes",
          cta: "Get Callback Now",
          icon: Phone,
        };
      case "emi-calculator":
        return {
          title: "Calculate Your EMI First!",
          subtitle: "Get personalized loan offers based on your income",
          cta: "Check Eligibility",
          icon: MessageCircle,
        };
      default:
        return {
          title: "Wait! Don't Miss Out",
          subtitle: "Get instant loan approval in 24 hours — Apply now & speak to our expert",
          cta: "Get Free Callback",
          icon: Gift,
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-md bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header with animation */}
            <div className="relative bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground overflow-hidden">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute top-4 right-12 opacity-20"
              >
                <Icon className="w-24 h-24" />
              </motion.div>
              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-4"
                >
                  <Icon className="w-7 h-7" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-1">{content.title}</h2>
                <p className="text-primary-foreground/80">{content.subtitle}</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-card">
              <div className="space-y-2">
                <Label htmlFor="exit-name">Your Name</Label>
                <Input
                  id="exit-name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exit-phone">Phone Number</Label>
                <Input
                  id="exit-phone"
                  placeholder="10-digit mobile number"
                  type="tel"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                variant="hero"
                className="w-full h-12 text-base group"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    {content.cta}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By submitting, you agree to our Terms & Privacy Policy
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExitIntentPopup;
