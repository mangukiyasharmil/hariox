import { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface CannedResponsesProps {
  onSelect: (text: string) => void;
  customerName?: string;
  companyName?: string;
}

const CANNED_RESPONSES = [
  {
    label: "Greeting",
    text: "Hello {{name}}, thank you for reaching out to {{company}}! How can I help you today?",
  },
  {
    label: "Payment Link",
    text: "Hi {{name}}, to proceed with your loan application, please complete the ₹799 consultation fee. I'll send you the payment link shortly.",
  },
  {
    label: "Documents Needed",
    text: "Hi {{name}}, we need the following documents to process your loan:\n1. Aadhaar Card\n2. PAN Card\n3. Last 3 months Bank Statement\n4. Last 3 months Salary Slips\n\nPlease upload them on our portal.",
  },
  {
    label: "Follow-up",
    text: "Hi {{name}}, just following up on your loan application. Would you like to proceed? We have great offers from our partner banks.",
  },
  {
    label: "Application Status",
    text: "Hi {{name}}, your application is being processed. Our team is working on getting you the best offer. We'll update you shortly.",
  },
  {
    label: "Thank You",
    text: "Thank you {{name}} for choosing {{company}}! We appreciate your trust. Our team will be in touch soon.",
  },
  {
    label: "Callback Request",
    text: "Sure {{name}}, I'll arrange a callback for you. What time works best?",
  },
];

const CannedResponses = ({ onSelect, customerName = "", companyName = "Hariox" }: CannedResponsesProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const replaceVars = (text: string) =>
    text.replace(/\{\{name\}\}/g, customerName || "Sir/Madam").replace(/\{\{company\}\}/g, companyName);

  const handleSelect = (idx: number) => {
    const finalText = replaceVars(CANNED_RESPONSES[idx].text);
    onSelect(finalText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        title="Canned Responses"
      >
        <MessageSquare className={`w-5 h-5 ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 w-72 max-h-64 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20">
          <div className="p-2 border-b border-border">
            <p className="text-[11px] font-semibold text-muted-foreground">Quick Replies</p>
          </div>
          {CANNED_RESPONSES.map((resp, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{resp.label}</span>
                {copiedIdx === idx ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                {replaceVars(resp.text).substring(0, 80)}...
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CannedResponses;
