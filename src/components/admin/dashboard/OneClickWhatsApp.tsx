import { Send, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface OneClickWhatsAppProps {
  leadName: string;
  leadPhone: string;
  loanAmount: number;
  loanType: string;
  paymentLink?: string;
  variant?: "icon" | "button" | "full";
  onSent?: () => void;
}

const generatePaymentMessage = (
  leadName: string,
  loanAmount: number,
  loanType: string,
  paymentLink?: string
) => {
  const firstName = leadName.split(" ")[0];
  const formattedAmount = new Intl.NumberFormat("en-IN").format(loanAmount);
  
  const messages = [
    // Payment collection message
    `🙏 नमस्ते ${firstName} जी,

मैं *Hariox* से बात कर रहा हूँ। आपने ₹${formattedAmount} के ${loanType} loan के लिए apply किया था।

🎯 *आपका loan processing के लिए ready है!*

अभी ₹799 की processing fees pay करें और अपना loan 24 घंटे में पाएं।

${paymentLink ? `💳 *Payment Link:* ${paymentLink}` : ""}

📞 किसी भी सवाल के लिए मुझे call करें।`,
    
    // Follow-up message
    `🔔 Hi ${firstName},

Your ₹${formattedAmount} ${loanType} loan application is *pending*.

Complete your payment of ₹799 to proceed:
${paymentLink || "[Payment Link]"}

*Benefits:*
✅ Same-day processing
✅ Lowest interest rates
✅ No hidden charges

Reply "HELP" for assistance.`,
  ];

  return messages[0]; // Default to Hindi message
};

const OneClickWhatsApp = ({
  leadName,
  leadPhone,
  loanAmount,
  loanType,
  paymentLink,
  variant = "icon",
  onSent,
}: OneClickWhatsAppProps) => {
  const [copied, setCopied] = useState(false);

  // Clean phone number
  const cleanPhone = leadPhone.replace(/\D/g, "").replace(/^0+/, "");
  const fullPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

  const message = generatePaymentMessage(leadName, loanAmount, loanType, paymentLink);
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;

  const handleClick = () => {
    window.open(whatsappUrl, "_blank");
    onSent?.();
    toast({
      title: "WhatsApp opened",
      description: `Message ready for ${leadName}`,
    });
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast({
        title: "Message copied!",
        description: "Paste it in WhatsApp",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  if (variant === "icon") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-[#25D366] hover:text-[#20BD5A] hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Send Payment Link via WhatsApp</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-[#25D366] border-[#25D366]/50 hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-all"
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
      >
        <WhatsAppIcon size="sm" className="mr-2" />
        Send Payment Link
      </Button>
    );
  }

  // Full variant with preview
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shadow-sm">
            <WhatsAppIcon size="sm" className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium">Quick WhatsApp</p>
            <p className="text-[10px] text-muted-foreground">Pre-filled payment message</p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handleCopyMessage}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Message Preview */}
      <div className="bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto border border-border/50">
        {message}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          className="flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white"
          onClick={handleClick}
        >
          <Send className="w-4 h-4 mr-2" />
          Open WhatsApp
          <ExternalLink className="w-3 h-3 ml-2" />
        </Button>
      </div>

      {/* Tip */}
      <p className="text-[10px] text-muted-foreground text-center">
        💡 Message will open in WhatsApp Web/App
      </p>
    </div>
  );
};

// Export message generator for external use
export { generatePaymentMessage };
export default OneClickWhatsApp;
