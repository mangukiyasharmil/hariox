import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, User, Loader2, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  options?: string[];
}

// Parse [OPTIONS]...[/OPTIONS] blocks from AI response
const parseOptionsFromContent = (content: string): { text: string; options: string[] } => {
  const optionsRegex = /\[OPTIONS\]\s*([\s\S]*?)\s*\[\/OPTIONS\]/gi;
  let options: string[] = [];
  let text = content;

  const match = optionsRegex.exec(content);
  if (match) {
    const optionsBlock = match[1];
    options = optionsBlock
      .split("\n")
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter((line) => line.length > 0);
    text = content.replace(optionsRegex, "").trim();
  }

  return { text, options };
};

// Parse lead capture tag from content
const parseLeadCapture = (content: string) => {
  const pattern = /\[LEAD_CAPTURE:\s*name="([^"]*)",\s*loan_type="([^"]*)",\s*amount="([^"]*)",\s*city="([^"]*)",\s*phone="([^"]*)"\]/i;
  const match = content.match(pattern);
  if (match) {
    return {
      name: match[1],
      loan_type: match[2],
      amount: match[3],
      city: match[4],
      phone: match[5],
      cleanContent: content.replace(pattern, "").trim(),
    };
  }
  return null;
};

const quickReplies = [
  "What loans do you offer?",
  "Check my eligibility",
  "Interest rates",
  "I want to apply for a loan",
];

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hello! I'm your loan assistant from Credit Hariox. How can I help you today?",
      options: [
        "I want to apply for a loan",
        "Check my eligibility",
        "What loans do you offer?",
        "Interest rates & documents",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const captureLeadOnServer = useCallback(async (leadData: { name: string; loan_type: string; amount: string; city: string; phone: string }) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chatbot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ capture_lead: { ...leadData, company_id: localStorage.getItem("publicCompanyId") } }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setLeadCaptured(true);
        // Add payment link message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✅ Your application has been registered successfully!\n\nTo proceed with quick processing, please complete the payment here:\n\n👉 [Click here to pay](https://credit.hariox.com/pay/whatsapp)\n\nOur team will contact you within 24 hours. For immediate help, WhatsApp us at +91 84693 91818.`,
            options: ["Track my application", "Talk to support"],
          },
        ]);
      }
    } catch (err) {
      console.error("Lead capture error:", err);
    }
  }, []);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chatbot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                // Show raw content while streaming (options parsed after stream ends)
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        // After streaming is done, parse options and lead capture
        const { text, options } = parseOptionsFromContent(assistantContent);
        const leadData = parseLeadCapture(text);

        if (leadData) {
          // Remove the lead capture tag from displayed content
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: leadData.cleanContent,
              options,
            };
            return updated;
          });
          // Create lead on server
          await captureLeadOnServer(leadData);
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: text,
              options,
            };
            return updated;
          });
        }
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm sorry, I'm having trouble connecting right now. Please try again or contact us on WhatsApp at +91 84693 91818.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleOptionClick = (option: string) => {
    sendMessage(option);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-40 md:bottom-24 right-4 z-50 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-primary to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group animate-bounce hover:animate-none"
        aria-label="Open AI Chat"
      >
        <Bot className="w-7 h-7 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 bg-card border border-border rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden",
        isMinimized
          ? "bottom-24 md:bottom-24 right-4 w-72 h-14"
          : "bottom-20 md:bottom-4 right-2 md:right-4 w-[calc(100%-1rem)] md:w-[360px] sm:w-[400px] h-[70vh] max-h-[500px] sm:max-h-[550px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-blue-600 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Loan Assistant</h3>
            <p className="text-xs text-white/80">
              {isLoading ? "Typing..." : "Online"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="h-[calc(100%-130px)] p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index}>
                  <div
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mt-1 [&>ul]:mb-2">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        message.content
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Option Buttons */}
                  {message.role === "assistant" &&
                    message.options &&
                    message.options.length > 0 &&
                    index === messages.length - 1 &&
                    !isLoading && (
                      <div className="ml-11 mt-2 flex flex-wrap gap-2">
                        {message.options.map((option, optIdx) => (
                          <button
                            key={optIdx}
                            onClick={() => handleOptionClick(option)}
                            className="text-xs px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-colors text-left"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
                className="flex-1 rounded-xl"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-xl"
                disabled={isLoading || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default AIChatbot;
