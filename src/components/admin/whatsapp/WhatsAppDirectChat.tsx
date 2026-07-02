import { useState, useEffect, useRef } from "react";
import { Send, X, Check, CheckCheck, Loader2, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  content: string;
  direction: string;
  status: string;
  created_at: string;
  message_type: string;
  media_url?: string | null;
  media_mime_type?: string | null;
}

interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number: string | null;
  connection_type: string;
  status: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[] | null;
  category: string | null;
  language: string | null;
  meta_variables_count: number | null;
}

interface WhatsAppDirectChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadPhone: string;
  leadName: string;
  leadId?: string;
  leadData?: {
    loan_amount?: number;
    loan_type?: string;
    city?: string;
  };
}

const WhatsAppDirectChat = ({ 
  open, 
  onOpenChange, 
  leadPhone, 
  leadName,
  leadId,
  leadData
}: WhatsAppDirectChatProps) => {
  const { currentCompany } = useCompany();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [noAccount, setNoAccount] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");

  const DEFAULT_MESSAGE = `Hello ${leadName},

Thank you for showing interest in our loan services!

🏦 Credit Hariox is here to help you get your loan approved quickly.

👉 Next Step: Complete your ₹799 consultation fee payment to start the process.

💳 Pay Now: https://credit.hariox.com/telecaller

✅ 30+ Partner Banks
✅ Quick Approval
✅ 24hr Disbursal

For any queries, feel free to reply to this message.`;

  // Auto-select Hariox WhatsApp account (8469391818)
  useEffect(() => {
    if (open) {
      fetchAndAutoSelectAccount();
      if (!selectedTemplate) {
        setNewMessage(DEFAULT_MESSAGE);
      }
    }
  }, [open, leadName, currentCompany?.id]);

  // Fetch messages when account is selected
  useEffect(() => {
    if (selectedAccountId && leadPhone) {
      fetchMessages();
      fetchTemplates();
    }
  }, [selectedAccountId, leadPhone]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchAndAutoSelectAccount = async () => {
    // First try to find a WhatsApp account linked to the current company
    if (currentCompany?.id) {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("id, name, phone_number, connection_type, status")
        .eq("connection_type", "meta_api")
        .eq("status", "connected")
        .eq("company_id", currentCompany.id)
        .limit(1);

      if (!error && data && data.length > 0) {
        setSelectedAccountId(data[0].id);
        setNoAccount(false);
        return;
      }
    }

    // Fallback to any connected account
    const { data: fallback } = await supabase
      .from("whatsapp_accounts")
      .select("id, name, phone_number, connection_type, status")
      .eq("connection_type", "meta_api")
      .eq("status", "connected")
      .limit(1);
    if (fallback && fallback.length > 0) {
      setSelectedAccountId(fallback[0].id);
      setNoAccount(false);
    } else {
      setNoAccount(true);
    }
  };

  const fetchTemplates = async () => {
    if (!selectedAccountId) return;
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("id, name, content, variables, category, language, meta_variables_count")
      .eq("account_id", selectedAccountId)
      .eq("is_active", true)
      .order("name");
    setTemplates((data || []) as Template[]);
  };

  const fetchMessages = async () => {
    if (!selectedAccountId) return;

    setIsLoading(true);
    const cleanPhone = leadPhone.replace(/[\s+\-()]/g, "");
    const phoneVariants = [cleanPhone, `91${cleanPhone}`, cleanPhone.replace(/^91/, "")];

    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("id, content, direction, status, created_at, message_type, media_url, media_mime_type")
      .eq("account_id", selectedAccountId)
      .or(phoneVariants.map(p => `phone_number.eq.${p}`).join(","))
      .order("created_at", { ascending: true })
      .limit(100);

    if (!error) {
      setMessages((data || []) as Message[]);
    }
    setIsLoading(false);
  };

  const handleSelectTemplate = (template: Template) => {
    // Use meta_variables_count (from Meta API) to determine how many params to show
    const metaVarCount = template.meta_variables_count || 0;
    const paramLabels = ["Name", "Amount", "Loan Type", "City"];
    
    let params: string[] = [];
    if (metaVarCount > 0) {
      params = Array.from({ length: metaVarCount }, (_, i) => {
        const label = paramLabels[i]?.toLowerCase() || "";
        if (label.includes("name")) return leadName || "";
        if (label.includes("amount")) return leadData?.loan_amount?.toLocaleString("en-IN") || "";
        if (label.includes("loan")) return leadData?.loan_type || "";
        if (label.includes("city")) return leadData?.city || "";
        return "";
      });
    }

    setSelectedTemplate(template);
    setTemplateParams(params);
    setNewMessage(`📋 Template: ${template.name}`);
    setShowTemplates(false);
    setTemplateSearch("");
  };

  const clearSelectedTemplate = () => {
    setSelectedTemplate(null);
    setTemplateParams([]);
    setNewMessage("");
  };

  const handleSendMessage = async () => {
    if (!selectedAccountId) return;
    if (!selectedTemplate && !newMessage.trim()) return;

    setIsSending(true);
    try {
      const body: any = {
        account_id: selectedAccountId,
        phone_number: leadPhone,
        lead_id: leadId,
        contact_name: leadName,
        message_source: "direct_chat",
      };

      if (selectedTemplate) {
        body.template_name = selectedTemplate.name;
        body.template_language = selectedTemplate.language || "en";
        if (templateParams.length > 0) {
          body.template_params = templateParams;
        }
      } else {
        body.message = newMessage;
      }

      const { data, error } = await supabase.functions.invoke("send-whatsapp", { body });

      if (error) throw error;

      if (data.success) {
        toast.success(selectedTemplate ? "Template sent via WhatsApp" : "Message sent via WhatsApp");
        setNewMessage("");
        clearSelectedTemplate();
        fetchMessages();
      } else {
        throw new Error(data.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error("Error sending WhatsApp message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      default:
        return <Check className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const openWebWhatsApp = () => {
    const cleanPhone = leadPhone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const message = `Hello ${leadName}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const filteredTemplates = templates
    .filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
    .sort((a, b) => {
      // Prioritize telecaller templates at the top
      const aIsTelecaller = a.name.toLowerCase().includes("telecaller");
      const bIsTelecaller = b.name.toLowerCase().includes("telecaller");
      if (aIsTelecaller && !bIsTelecaller) return -1;
      if (!aIsTelecaller && bIsTelecaller) return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b bg-[#25D366]/10">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-[#25D366] text-white">
                {leadName?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-left">{leadName}</SheetTitle>
              <p className="text-xs text-muted-foreground">+91 {leadPhone}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={openWebWhatsApp}>
              <WhatsAppIcon size="sm" className="text-[#25D366]" />
            </Button>
          </div>
        </SheetHeader>

        {noAccount ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <p>No WhatsApp API accounts connected.</p>
            <p className="text-xs mt-1">Configure Meta API in WhatsApp Marketing → Accounts</p>
            <Button variant="outline" className="mt-2" onClick={openWebWhatsApp}>
              Use Web WhatsApp Instead
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-[#ECE5DD]/30 dark:bg-muted/10">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 shadow-sm ${
                          msg.direction === "outgoing"
                            ? "bg-[#DCF8C6] dark:bg-[#005C4B] rounded-br-none"
                            : "bg-white dark:bg-card rounded-bl-none"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {/* Media content */}
                        {msg.media_url && ["image", "sticker"].includes(msg.message_type) && (
                          <img 
                            src={msg.media_url} 
                            alt={msg.content || "Image"} 
                            className="max-w-full max-h-[250px] object-contain rounded mt-1 cursor-pointer"
                            onClick={() => window.open(msg.media_url!, "_blank")}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {msg.media_url && msg.message_type === "audio" && (
                          <audio src={msg.media_url} controls className="w-full mt-1" />
                        )}
                        {msg.media_url && msg.message_type === "video" && (
                          <video src={msg.media_url} controls className="max-w-full max-h-[250px] rounded mt-1" />
                        )}
                        {msg.media_url && msg.message_type === "document" && (
                          <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 block">
                            📎 View Document
                          </a>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {msg.direction === "outgoing" && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Selected Template Preview */}
            {selectedTemplate && (
              <div className="px-3 py-2 border-t bg-muted/40">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="w-3 h-3 mr-1" />
                    {selectedTemplate.name}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={clearSelectedTemplate}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{selectedTemplate.content}</p>
                {templateParams.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {templateParams.map((_, idx: number) => {
                      const paramLabels = ["Name", "Amount", "Loan Type", "City"];
                      const label = paramLabels[idx] || `Param ${idx + 1}`;
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-16 truncate">{`{{${idx + 1}}} ${label}`}:</span>
                          <Input
                            className="h-6 text-xs"
                            placeholder={label}
                            value={templateParams[idx] || ""}
                            onChange={(e) => {
                              const updated = [...templateParams];
                              updated[idx] = e.target.value;
                              setTemplateParams(updated);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t bg-muted/30">
              <div className="flex gap-2">
                {/* Template Picker */}
                <Popover open={showTemplates} onOpenChange={setShowTemplates}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0" title="Send Template">
                      <FileText className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start" side="top">
                    <Input
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="mb-2 h-8 text-xs"
                    />
                    <ScrollArea className="h-48">
                      {filteredTemplates.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No templates found</p>
                      ) : (
                        <div className="space-y-1">
                          {filteredTemplates.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => handleSelectTemplate(t)}
                              className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-xs"
                            >
                              <div className="font-medium">{t.name}</div>
                              <div className="text-muted-foreground line-clamp-1">{t.content}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <Textarea
                  placeholder={selectedTemplate ? "Template selected — press Send" : "Type a message..."}
                  value={newMessage}
                  onChange={(e) => {
                    if (!selectedTemplate) setNewMessage(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                  readOnly={!!selectedTemplate}
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={isSending || (!selectedTemplate && !newMessage.trim())}
                  className="bg-[#25D366] hover:bg-[#20b858]"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default WhatsAppDirectChat;
