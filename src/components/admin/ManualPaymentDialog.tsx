import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { triggerStatusWorkflow } from "@/hooks/useWorkflowTrigger";

interface ManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onSuccess: () => void;
}

const ManualPaymentDialog = ({ open, onOpenChange, leadId, leadName, onSuccess }: ManualPaymentDialogProps) => {
  const [paymentId, setPaymentId] = useState("");
  const [gateway, setGateway] = useState<"razorpay" | "paytm" | "phonepe" | "cash">("razorpay");
  const [source, setSource] = useState<"telecaller" | "manual" | "direct" | "marketing">("telecaller");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!paymentId.trim()) {
      toast.error("Please enter a payment ID");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fetch lead details for invoice generation
      const { data: leadData, error: leadFetchError } = await supabase
        .from("leads")
        .select("full_name, email, phone, company_id")
        .eq("id", leadId)
        .single();
      
      if (leadFetchError) throw leadFetchError;
      
      const companyId = leadData?.company_id;
      
      // Update lead status to paid
      const { error: leadError } = await supabase
        .from("leads")
        .update({ status: "paid" })
        .eq("id", leadId);

      if (leadError) throw leadError;
      
      // Trigger workflow for payment received
      triggerStatusWorkflow(leadId, "unpaid", "paid");

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          lead_id: leadId,
          amount: 677,
          gst_amount: 122,
          total_amount: 799,
          payment_source: source,
          status: "completed",
          collected_by: session?.user?.id,
          payment_date: new Date().toISOString(),
          razorpay_payment_id: gateway === "razorpay" ? paymentId : paymentId,
          company_id: companyId,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;
      
      // Generate GST invoice
      try {
        // Generate invoice number using company-specific prefix
        const { data: invoiceNum, error: invoiceNumError } = await supabase.rpc(
          "generate_invoice_number",
          { p_company_id: companyId }
        );

        if (invoiceNumError) {
          console.error("Invoice number generation error:", invoiceNumError);
        }

        const invoiceNumber = invoiceNum || `INV/${Date.now()}`;

        const { error: invoiceInsertError } = await supabase.from("gst_invoices").insert({
          invoice_number: invoiceNumber,
          lead_id: leadId,
          payment_id: payment.id,
          company_id: companyId,
          customer_name: leadData.full_name,
          customer_email: leadData.email,
          customer_phone: leadData.phone,
          amount: 677,
          gst_amount: 122,
          total_amount: 799,
          invoice_date: new Date().toISOString().split("T")[0],
          status: "generated",
        });

        if (invoiceInsertError) {
          console.error("GST invoice insert error:", invoiceInsertError);
        } else {
          console.log("GST invoice generated", { payment_id: payment.id, invoiceNumber });
        }
      } catch (invoiceErr) {
        console.error("GST invoice generation exception:", invoiceErr);
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        lead_id: leadId,
        user_id: session?.user?.id,
        action: "manual_payment_marked",
        details: {
          payment_id: paymentId,
          gateway,
          source,
          amount: 799,
        },
      });

      // Send payment success SMS
      try {
        if (leadData?.phone) {
          await supabase.functions.invoke("send-sms", {
            body: {
              type: "payment_success",
              phone: leadData.phone,
              leadId: leadId,
            },
          });
          console.log("Manual payment: SMS sent to", leadData.phone);
        }
      } catch (smsErr) {
        console.error("Manual payment SMS error:", smsErr);
      }

      toast.success("Payment marked and invoice generated successfully");
      onOpenChange(false);
      onSuccess();
      
      // Reset form
      setPaymentId("");
      setGateway("razorpay");
      setSource("telecaller");
    } catch (error) {
      console.error("Error marking payment:", error);
      toast.error("Failed to mark payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Paid</DialogTitle>
          <DialogDescription>
            Enter payment details for {leadName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Payment ID / Transaction ID</Label>
            <Input
              placeholder="Enter payment/transaction ID"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Gateway</Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "razorpay", label: "Razorpay" },
                { value: "phonepe", label: "PhonePe" },
                { value: "paytm", label: "Paytm" },
                { value: "cash", label: "Cash" },
              ].map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGateway(g.value as any)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    gateway === g.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Source</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "telecaller", label: "Telecaller" },
                { value: "manual", label: "Manual" },
                { value: "direct", label: "Website" },
                { value: "marketing", label: "Marketing" },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value as any)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    source === s.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Mark as Paid
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualPaymentDialog;