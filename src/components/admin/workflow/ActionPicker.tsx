import { useState } from "react";
import { MessageCircle, Mail, UserPlus, Clock, ArrowRight, Filter, Phone, FileText, Bell, StopCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ActionCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  actions: { id: string; label: string; description?: string }[];
}

const actionCategories: ActionCategory[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    color: "bg-green-500",
    actions: [
      { id: "send_whatsapp", label: "Send WhatsApp Message", description: "Send a templated message" },
      { id: "send_whatsapp_media", label: "Send WhatsApp Media", description: "Send image/document" },
    ],
  },
  {
    id: "sms",
    label: "SMS",
    icon: Phone,
    color: "bg-blue-500",
    actions: [
      { id: "send_sms", label: "Send SMS", description: "Send text message" },
      { id: "start_remarketing", label: "Start Remarketing Cycle", description: "Start 3-day SMS remarketing sequence" },
      { id: "stop_remarketing", label: "Stop Remarketing Cycle", description: "Stop active remarketing for lead" },
    ],
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    color: "bg-purple-500",
    actions: [
      { id: "send_email", label: "Send Email", description: "Send email notification" },
    ],
  },
  {
    id: "crm",
    label: "CRM Actions",
    icon: UserPlus,
    color: "bg-cyan-500",
    actions: [
      { id: "add_to_crm", label: "Add/Update to CRM", description: "Create or update lead" },
      { id: "assign_to_staff", label: "Assign to Staff", description: "Auto-assign to team member" },
      { id: "update_status", label: "Update Status", description: "Change lead status" },
      { id: "add_note", label: "Add Note", description: "Add note to lead" },
      { id: "add_tag", label: "Add Tag", description: "Tag the lead" },
    ],
  },
  {
    id: "condition",
    label: "Condition",
    icon: Filter,
    color: "bg-orange-500",
    actions: [
      { id: "if_lead", label: "If Lead Condition", description: "Branch based on lead data" },
      { id: "if_status", label: "If Status Equals", description: "Check lead status" },
      { id: "if_payment", label: "If Payment Status", description: "Check payment state" },
    ],
  },
  {
    id: "delay",
    label: "Delay",
    icon: Clock,
    color: "bg-gray-500",
    actions: [
      { id: "wait_minutes", label: "Wait Minutes", description: "Delay execution" },
      { id: "wait_hours", label: "Wait Hours" },
      { id: "wait_days", label: "Wait Days" },
      { id: "wait_until", label: "Wait Until Time", description: "Wait until specific time" },
    ],
  },
  {
    id: "notification",
    label: "Notification",
    icon: Bell,
    color: "bg-yellow-500",
    actions: [
      { id: "notify_staff", label: "Notify Staff", description: "Send internal notification" },
    ],
  },
  {
    id: "control",
    label: "Stop / Control",
    icon: StopCircle,
    color: "bg-red-500",
    actions: [
      { id: "stop_automation", label: "Stop All Automations", description: "Stop all running workflows and remarketing for this lead" },
      { id: "stop_remarketing", label: "Stop Remarketing Only", description: "Stop active SMS remarketing cycle" },
    ],
  },
];

interface ActionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (categoryId: string, actionId: string, label: string) => void;
}

const ActionPicker = ({ open, onOpenChange, onSelect }: ActionPickerProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getNodeType = (categoryId: string): "action" | "condition" | "delay" => {
    if (categoryId === "condition") return "condition";
    if (categoryId === "delay") return "delay";
    return "action";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selectedCategory ? "Select Action" : "Add Action"}</DialogTitle>
        </DialogHeader>

        {!selectedCategory ? (
          <div className="grid grid-cols-3 gap-4 pt-4">
            {actionCategories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
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
            
            {actionCategories
              .find((c) => c.id === selectedCategory)
              ?.actions?.map((action) => {
                const category = actionCategories.find((c) => c.id === selectedCategory)!;
                const Icon = category.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      onSelect(selectedCategory, action.id, action.label);
                      setSelectedCategory(null);
                      onOpenChange(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{action.label}</p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ActionPicker;
