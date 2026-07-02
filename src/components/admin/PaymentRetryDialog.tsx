import { useState } from "react";
import { RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PaymentRetryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    full_name: string;
    phone: string;
    loan_type: string;
    loan_amount: number;
    company_id?: string | null;
  };
  onSuccess?: () => void;
}

const PaymentRetryDialog = ({
  isOpen,
  onClose,
  lead,
  onSuccess,
}: PaymentRetryDialogProps) => {
  const [channel, setChannel] = useState<"sms" | "whatsapp" | "both">("whatsapp");
  const [isSending, setIsSending] = useState(false);
  const [sentStatus, setSentStatus] = useState<{ sms?: boolean; whatsapp?: boolean } | null>(null);

  const handleSendRetry = async () => {
    setIsSending(true);
    setSentStatus(null);

    try {
      const response = await supabase.functions.invoke("send-payment-retry", {
        body: {
          lead_id: lead.id,
          channel,
          company_id: lead.company_id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to send payment retry");
      }

      setSentStatus(response.data.results);

      toast({
        title: "Payment Retry Sent! 🎉",
        description: `Retry link sent to ${lead.full_name} via ${channel === "both" ? "SMS & WhatsApp" : channel.toUpperCase()}`,
      });

      onSuccess?.();
    } catch (error: any) {
      console.error("Payment retry error:", error);
      toast({
        title: "Failed to send",
        description: error.message || "Could not send payment retry message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSentStatus(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Send Payment Retry
          </DialogTitle>
          <DialogDescription>
            Send a payment link to <strong>{lead.full_name}</strong> for their{" "}
            ₹{lead.loan_amount.toLocaleString("en-IN")} {lead.loan_type} loan application.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="text-sm font-medium mb-3 block">Send via</Label>
          <RadioGroup
            value={channel}
            onValueChange={(v) => setChannel(v as "sms" | "whatsapp" | "both")}
            className="grid grid-cols-3 gap-3"
          >
            <div>
              <RadioGroupItem value="sms" id="sms" className="peer sr-only" />
              <Label
                htmlFor="sms"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Send className="w-5 h-5 mb-1" />
                <span className="text-xs">SMS</span>
                {sentStatus?.sms !== undefined && (
                  <CheckCircle2 className={`w-4 h-4 mt-1 ${sentStatus.sms ? "text-green-500" : "text-red-500"}`} />
                )}
              </Label>
            </div>
            <div>
              <RadioGroupItem value="whatsapp" id="whatsapp" className="peer sr-only" />
              <Label
                htmlFor="whatsapp"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <WhatsAppIcon size="md" className="mb-1 text-[#25D366]" />
                <span className="text-xs">WhatsApp</span>
                {sentStatus?.whatsapp !== undefined && (
                  <CheckCircle2 className={`w-4 h-4 mt-1 ${sentStatus.whatsapp ? "text-green-500" : "text-red-500"}`} />
                )}
              </Label>
            </div>
            <div>
              <RadioGroupItem value="both" id="both" className="peer sr-only" />
              <Label
                htmlFor="both"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <div className="flex gap-1 mb-1">
                  <Send className="w-4 h-4" />
                  <WhatsAppIcon size="sm" className="text-[#25D366]" />
                </div>
                <span className="text-xs">Both</span>
              </Label>
            </div>
          </RadioGroup>

          {/* Preview info */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs">
            <p className="font-medium mb-1">Message will include:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Personalized greeting with customer name</li>
              <li>Loan details (₹{lead.loan_amount.toLocaleString("en-IN")} {lead.loan_type})</li>
              <li>Direct payment link</li>
              <li>Call-to-action for quick completion</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSendRetry} disabled={isSending}>
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Retry Link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentRetryDialog;
