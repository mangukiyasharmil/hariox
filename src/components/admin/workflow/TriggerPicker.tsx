import { useState } from "react";
import { FileText, Users, DollarSign, Code, Clock, Upload, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TriggerCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  triggers?: { id: string; label: string; description?: string }[];
}

const triggerCategories: TriggerCategory[] = [
  {
    id: "forms",
    label: "Forms",
    icon: FileText,
    triggers: [
      { id: "form_filled", label: "Form Filled", description: "When a new lead submits the form" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    triggers: [
      { id: "lead_created", label: "New Lead Created", description: "When a lead is created" },
      { id: "status_changed", label: "Stage Changed", description: "When lead status changes" },
      { id: "documents_verified", label: "Documents Verified", description: "When documents are approved" },
      { id: "loan_approved", label: "Loan Approved", description: "When loan is approved by bank" },
      { id: "loan_rejected", label: "Loan Rejected", description: "When application is rejected" },
      { id: "loan_disbursed", label: "Loan Disbursed", description: "When loan amount is disbursed" },
      { id: "follow_up", label: "Follow Up Due", description: "When follow-up date is reached" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    icon: Upload,
    triggers: [
      { id: "document_uploaded", label: "Document Uploaded", description: "When customer uploads documents" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: DollarSign,
    triggers: [
      { id: "payment_received", label: "Payment Received", description: "When payment is completed" },
      { id: "payment_failed", label: "Payment Failed", description: "When payment attempt fails" },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    triggers: [
      { id: "whatsapp_button_click", label: "Button Click", description: "When customer clicks a template button (Quick Reply)" },
      { id: "whatsapp_message_received", label: "Message Received", description: "When customer sends any WhatsApp message" },
      { id: "whatsapp_no_reply", label: "No Reply (Timeout)", description: "When customer doesn't reply within a timeframe" },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: Clock,
    triggers: [
      { id: "scheduled_time", label: "Scheduled Time", description: "Run at specific times" },
      { id: "recurring", label: "Recurring Schedule", description: "Daily/Weekly/Monthly" },
    ],
  },
  {
    id: "api",
    label: "External API",
    icon: Code,
    triggers: [
      { id: "webhook", label: "Webhook Received", description: "External API call" },
      { id: "external_event", label: "External Event", description: "Third-party integration event" },
    ],
  },
];

interface TriggerPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (categoryId: string, triggerId: string, label: string) => void;
}

const TriggerPicker = ({ open, onOpenChange, onSelect }: TriggerPickerProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedCategory(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selectedCategory ? "Select Trigger" : "Trigger"}</DialogTitle>
        </DialogHeader>

        {!selectedCategory ? (
          <div className="grid grid-cols-3 gap-4 pt-4">
            {triggerCategories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Icon className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm font-medium">{category.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-primary hover:underline mb-4"
            >
              ← Back to categories
            </button>
            
            {triggerCategories
              .find((c) => c.id === selectedCategory)
              ?.triggers?.map((trigger) => (
                <button
                  key={trigger.id}
                  onClick={() => {
                    onSelect(selectedCategory, trigger.id, trigger.label);
                    setSelectedCategory(null);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    {triggerCategories.find((c) => c.id === selectedCategory)?.icon && (
                      <span className="text-green-500">
                        {(() => {
                          const Icon = triggerCategories.find((c) => c.id === selectedCategory)!.icon;
                          return <Icon className="w-5 h-5" />;
                        })()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{trigger.label}</p>
                    {trigger.description && (
                      <p className="text-xs text-muted-foreground">{trigger.description}</p>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TriggerPicker;
