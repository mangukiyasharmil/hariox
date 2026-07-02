import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Phone, QrCode, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";
import { trackAnalyticsEvent } from "@/hooks/useAnalyticsTracker";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  time: string;
}

const quickReplies = [
  "I want to apply for a loan",
  "Check my application status",
  "What documents are required?",
  "Talk to a human agent",
];

const WhatsAppChatWidget = () => {
  const { company } = usePublicCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: `👋 Hello! Welcome to ${company?.name || "Credit Hariox"}. How can I help you today?`,
      sender: "bot",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const whatsappNumber = company?.whatsapp_number || "918469391818";

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    // Simulate bot response
    setTimeout(() => {
      const botResponses: Record<string, string> = {
        "I want to apply for a loan": "Great! You can apply for a loan directly on our website. Would you like me to guide you through the process, or connect you with our team on WhatsApp?",
        "Check my application status": "To check your application status, please visit our payment portal and enter your registered mobile number. Or click 'Talk to Agent' to chat with our team.",
        "What documents are required?": "Required documents vary by loan type:\n\n📄 Personal Loan: ID Proof, Address Proof, Income Proof, Bank Statements\n\n🏠 Home Loan: Above + Property Documents\n\n💼 Business Loan: Above + Business Proof, ITR\n\nWould you like to apply now?",
        "Talk to a human agent": `I'll connect you with our team right away! Click the button below to chat on WhatsApp.`,
      };

      const response = botResponses[text] || 
        "Thank you for your message! For detailed assistance, please chat with our team on WhatsApp. Click the WhatsApp button below to connect instantly.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: response,
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  const openWhatsApp = () => {
    const companyName = company?.name || "Credit Hariox";
    const message = `Hi ${companyName}, I have a question about loans`;
    trackAnalyticsEvent({
      eventType: "whatsapp_click",
      companyId: company?.id || null,
      metadata: {
        source: "chat_widget",
        whatsapp_number: whatsappNumber,
        page: window.location.pathname,
      },
    });
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Generate QR code for direct WhatsApp chat
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://wa.me/${whatsappNumber}?text=Hello`;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <>
            <WhatsAppIcon size="lg" className="text-white" />
            <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
          </>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 z-50 w-[calc(100%-2rem)] max-w-sm bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#075E54] p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <WhatsAppIcon size="md" className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">{company?.name || "Credit Hariox"}</p>
                    <p className="text-xs text-white/70">Online • Replies instantly</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Scan QR Code"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                  <button
                    onClick={openWhatsApp}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Open WhatsApp"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* QR Code View */}
            {showQR ? (
              <div className="p-6 text-center bg-white">
                <div className="mb-4">
                  <Scan className="w-8 h-8 text-[#25D366] mx-auto mb-2" />
                  <p className="font-semibold text-foreground">Scan to Chat</p>
                  <p className="text-xs text-muted-foreground">Open WhatsApp on your phone and scan</p>
                </div>
                <div className="inline-block p-3 bg-white rounded-xl shadow-lg border">
                  <img 
                    src={qrCodeUrl} 
                    alt="WhatsApp QR Code" 
                    className="w-40 h-40"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  WhatsApp → Camera → Scan QR Code
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowQR(false)}
                >
                  Back to Chat
                </Button>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="h-72 overflow-y-auto p-4 space-y-3 bg-[#ECE5DD]">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 shadow-sm ${
                          msg.sender === "user"
                            ? "bg-[#DCF8C6] text-foreground"
                            : "bg-white text-foreground"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-line">{msg.text}</p>
                        <p className="text-[10px] text-muted-foreground text-right mt-1">{msg.time}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Replies */}
                <div className="px-3 py-2 bg-muted/50 border-t border-border flex gap-2 overflow-x-auto scrollbar-hide">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => sendMessage(reply)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 bg-card border border-border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="p-3 border-t border-border bg-card flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage(inputText)}
                    className="flex-1 h-10"
                  />
                  <Button
                    size="icon"
                    className="h-10 w-10 bg-[#25D366] hover:bg-[#20BD5A]"
                    onClick={() => sendMessage(inputText)}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                {/* WhatsApp CTA */}
                <div className="px-3 pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[#25D366] border-[#25D366] hover:bg-[#25D366] hover:text-white"
                    onClick={openWhatsApp}
                  >
                    <WhatsAppIcon size="sm" className="mr-2" />
                    Continue on WhatsApp
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default WhatsAppChatWidget;
