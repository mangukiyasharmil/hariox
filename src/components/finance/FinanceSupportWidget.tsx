import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Send, Bot, User, Loader2, Minimize2, Maximize2,
  FileText, CreditCard, Phone, CheckCircle2, ArrowRight, HelpCircle,
  Sparkles, Clock
} from "lucide-react";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { calculateEMI, formatCurrency } from "@/hooks/useEMICalculator";
import { trackLeadEvent } from "@/hooks/useAnalyticsTracker";
import { trackLead } from "@/components/MetaPixel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

type WidgetStep = "menu" | "chat" | "eligibility_check" | "apply_step1" | "apply_step2" | "apply_step3" | "success_options";

const applicationSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email is too long"),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit mobile number"),
  loanType: z.string().min(1, "Please select a loan type"),
  loanAmount: z.string().trim().min(1, "Please enter loan amount"),
  employmentType: z.string().min(1, "Please select employment type"),
  monthlyIncome: z.string().trim().min(1, "Please enter monthly income"),
  city: z.string().trim().min(2, "City is required").max(100, "City name is too long"),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter valid 6-digit pincode"),
  state: z.string().min(1, "Please select your state"),
  cibilScoreRange: z.string().min(1, "Please select your CIBIL score range"),
  currentMonthlyEmi: z.string().optional(),
  emiBounce: z.boolean(),
  agreeTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

type FormData = z.infer<typeof applicationSchema>;

type PreApprovalSnapshot = {
  loanAmount: number;
  emi: number;
  interestRate: number;
  tenureMonths: number;
};

const loanTypes = [
  { value: "marriage", label: "Marriage Loan" },
  { value: "business", label: "Business Loan" },
  { value: "personal", label: "Personal Loan" },
  { value: "education", label: "Education Loan" },
];

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const employmentTypes = [
  { value: "salaried", label: "Salaried" },
  { value: "self_employed", label: "Self-Employed" },
  { value: "business_owner", label: "Business Owner" },
];

const cibilScoreRanges = [
  { value: "300-500", label: "300-500" },
  { value: "500-650", label: "500-650" },
  { value: "650-750", label: "650-750" },
  { value: "750-900", label: "750-900" },
];

const faqItems = [
  { q: "What documents are required?", a: "Aadhaar Card, PAN Card, 3 months salary slips, and 6 months bank statement." },
  { q: "What is the interest rate?", a: "Interest rates start from 8.5% p.a. depending on your profile and loan type." },
  { q: "How long for approval?", a: "We provide quick approval within 24-48 hours for eligible applicants." },
  { q: "What is the eligibility?", a: "Age 21-65 years, minimum income ₹15,000/month, and CIBIL score 650+." },
  { q: "What loan types are available?", a: "Personal, Business, Marriage, Education, Vehicle, Gold, and Home Loans." },
];

// Finance company ID
const FINANCE_COMPANY_ID = "e6b82169-19d7-4e93-a0c0-304b89bcab71";

const FinanceSupportWidget = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [step, setStep] = useState<WidgetStep>("menu");
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hello! I'm your Finance Hariox loan assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Application form state
  const [formData, setFormData] = useState<Partial<FormData>>({
    fullName: "",
    email: "",
    phone: "",
    loanType: "",
    loanAmount: "",
    employmentType: "",
    monthlyIncome: "",
    city: "",
    pincode: "",
    state: "",
    cibilScoreRange: "",
    currentMonthlyEmi: "",
    emiBounce: false,
    agreeTerms: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [existingLeadId, setExistingLeadId] = useState<string | null>(null);
  const [preApproval, setPreApproval] = useState<PreApprovalSnapshot | null>(null);

  const whatsappNumber = "918469391818";
  const companyName = "Finance Hariox";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current && step === "chat") {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized, step]);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const openWhatsApp = () => {
    const message = `Hi Finance Hariox, I want to know more about loan rates.`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Check phone and move to step 1 with phone pre-filled
  const handleEligibilityCheck = async () => {
    const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit mobile number");
    const result = phoneSchema.safeParse(formData.phone);
    
    if (!result.success) {
      setErrors({ phone: result.error.issues[0].message });
      return;
    }

    setIsCheckingEligibility(true);
    setErrors({});

    // Check for existing lead
    try {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("*")
        .eq("phone", formData.phone!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLead) {
        setExistingLeadId(existingLead.id);
        setFormData(prev => ({
          ...prev,
          fullName: existingLead.full_name || prev.fullName,
          email: existingLead.email || prev.email,
          loanType: existingLead.loan_type || prev.loanType,
          loanAmount: existingLead.loan_amount?.toString() || prev.loanAmount,
          employmentType: existingLead.employment_type || prev.employmentType,
          monthlyIncome: existingLead.monthly_income?.toString() || prev.monthlyIncome,
          city: existingLead.city || prev.city,
          pincode: existingLead.pincode || prev.pincode,
          state: existingLead.state || prev.state,
          cibilScoreRange: existingLead.cibil_score_range || prev.cibilScoreRange,
          currentMonthlyEmi: existingLead.current_monthly_emi?.toString() || prev.currentMonthlyEmi,
          emiBounce: existingLead.emi_bounce_last_6_months || false,
        }));

        // If they have all details, skip to step 2
        if (existingLead.loan_type && existingLead.loan_amount && existingLead.employment_type) {
          setPhoneVerified(true);
          setIsCheckingEligibility(false);
          setStep("apply_step2");
          return;
        }
      }
    } catch (err) {
      console.error("Error checking lead:", err);
    }

    // Mark phone as verified and move to step 1
    setPhoneVerified(true);
    setIsCheckingEligibility(false);
    setStep("apply_step1");
  };

  // Chat functionality
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
              role: m.role === "system" ? "assistant" : m.role,
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
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble connecting. Please try WhatsApp for instant support!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Application form validation
  const validateStep1 = () => {
    const step1Schema = z.object({
      fullName: applicationSchema.shape.fullName,
      email: applicationSchema.shape.email,
      phone: applicationSchema.shape.phone,
    });
    
    const result = step1Schema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof FormData;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const step2Schema = z.object({
      loanType: applicationSchema.shape.loanType,
      loanAmount: applicationSchema.shape.loanAmount,
      employmentType: applicationSchema.shape.employmentType,
      monthlyIncome: applicationSchema.shape.monthlyIncome,
      city: applicationSchema.shape.city,
      pincode: applicationSchema.shape.pincode,
      state: applicationSchema.shape.state,
      cibilScoreRange: applicationSchema.shape.cibilScoreRange,
      currentMonthlyEmi: applicationSchema.shape.currentMonthlyEmi,
      emiBounce: applicationSchema.shape.emiBounce,
      agreeTerms: applicationSchema.shape.agreeTerms,
    });
    
    const result = step2Schema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof FormData;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const checkExistingLead = async (phone: string) => {
    if (phone.length !== 10) return;
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) return;

    try {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("*")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLead) {
        setExistingLeadId(existingLead.id);
        setFormData(prev => ({
          ...prev,
          fullName: existingLead.full_name || prev.fullName,
          email: existingLead.email || prev.email,
          loanType: existingLead.loan_type || prev.loanType,
          loanAmount: existingLead.loan_amount?.toString() || prev.loanAmount,
          employmentType: existingLead.employment_type || prev.employmentType,
          monthlyIncome: existingLead.monthly_income?.toString() || prev.monthlyIncome,
          city: existingLead.city || prev.city,
          pincode: existingLead.pincode || prev.pincode,
          state: existingLead.state || prev.state,
          cibilScoreRange: existingLead.cibil_score_range || prev.cibilScoreRange,
          currentMonthlyEmi: existingLead.current_monthly_emi?.toString() || prev.currentMonthlyEmi,
          emiBounce: existingLead.emi_bounce_last_6_months || false,
        }));
      }
    } catch (err) {
      console.error("Error checking lead:", err);
    }
  };

  const handleApplyStep1Next = async () => {
    if (!validateStep1()) return;
    await checkExistingLead(formData.phone!);
    setStep("apply_step2");
  };

  const handleStep2Next = () => {
    if (!validateStep2()) return;
    const loanAmount = Number(formData.loanAmount);
    const interestRate = 10;
    const tenureMonths = 36;
    const emiCalc = calculateEMI(loanAmount, interestRate, tenureMonths);

    setPreApproval({
      loanAmount,
      emi: emiCalc.emi,
      interestRate,
      tenureMonths,
    });
    setStep("apply_step3");
  };

  const createLeadAndGoToPayment = async () => {
    if (!preApproval) return;
    setIsSubmitting(true);

    try {
      const employmentTypeMap: Record<string, string> = {
        salaried: "salaried",
        self_employed: "self_employed",
        business_owner: "business_owner",
      };

      if (existingLeadId) {
        await supabase
          .from("leads")
          .update({
            full_name: formData.fullName!.trim(),
            email: formData.email!.trim(),
            city: formData.city!.trim(),
            pincode: formData.pincode!.trim(),
            state: formData.state!,
            loan_type: formData.loanType as any,
            loan_amount: preApproval.loanAmount,
            employment_type: (employmentTypeMap[formData.employmentType!] || "salaried") as any,
            monthly_income: Number(formData.monthlyIncome),
            emi_amount: preApproval.emi,
            interest_rate: preApproval.interestRate,
            tenure_months: preApproval.tenureMonths,
            cibil_score_range: formData.cibilScoreRange,
            current_monthly_emi: Number(formData.currentMonthlyEmi) || 0,
            emi_bounce_last_6_months: formData.emiBounce,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLeadId);

        setStep("success_options");
      } else {
        const { data: newLead, error } = await supabase
          .from("leads")
          .insert({
            full_name: formData.fullName!.trim(),
            email: formData.email!.trim(),
            phone: formData.phone!.trim(),
            city: formData.city!.trim(),
            pincode: formData.pincode!.trim(),
            state: formData.state!,
            loan_type: formData.loanType as any,
            loan_amount: preApproval.loanAmount,
            employment_type: (employmentTypeMap[formData.employmentType!] || "salaried") as any,
            monthly_income: Number(formData.monthlyIncome),
            emi_amount: preApproval.emi,
            interest_rate: preApproval.interestRate,
            tenure_months: preApproval.tenureMonths,
            cibil_score_range: formData.cibilScoreRange,
            current_monthly_emi: Number(formData.currentMonthlyEmi) || 0,
            emi_bounce_last_6_months: formData.emiBounce,
            source: "chatbot",
            status: "unpaid",
          })
          .select()
          .single();

        if (error) throw error;

        trackLeadEvent("lead_submitted", {
          loan_type: formData.loanType,
          source: "chatbot",
        });

        // Fire Meta Pixel Lead event (single event, deduplicated by leadId)
        trackLead({ content_name: formData.loanType }, newLead.id);

        setExistingLeadId(newLead.id);
        setStep("success_options");
      }
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToPayment = () => {
    if (existingLeadId) {
      navigate(`/payment?leadId=${existingLeadId}&company=finance`);
    }
  };

  const resetWidget = () => {
    setStep("menu");
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      loanType: "",
      loanAmount: "",
      employmentType: "",
      monthlyIncome: "",
      city: "",
      pincode: "",
      state: "",
      cibilScoreRange: "",
      currentMonthlyEmi: "",
      emiBounce: false,
      agreeTerms: false,
    });
    setErrors({});
    setExistingLeadId(null);
    setPreApproval(null);
    setPhoneVerified(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
          >
            <WhatsAppIcon size="lg" className="text-primary-foreground" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Widget Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? "auto" : "min(600px, 85vh)"
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col",
              isMinimized ? "h-auto" : ""
            )}
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Finance Hariox</h3>
                  <p className="text-xs text-primary-foreground/80">Best Rate Support</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setIsOpen(false); resetWidget(); }}
                  className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Main Menu */}
                {step === "menu" && (
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">How can we help you today?</p>
                    
                    {/* WhatsApp Option */}
                    <button
                      onClick={openWhatsApp}
                      className="w-full flex items-center gap-3 p-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center">
                        <WhatsAppIcon size="md" className="text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">WhatsApp</div>
                        <div className="text-xs text-muted-foreground">Chat with us instantly</div>
                      </div>
                    </button>

                    {/* AI Agent Option */}
                    <button
                      onClick={() => setStep("chat")}
                      className="w-full flex items-center gap-3 p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">AI Agent</div>
                        <div className="text-xs text-muted-foreground">Get instant answers 24/7</div>
                      </div>
                    </button>

                    {/* Apply Now Option */}
                    <button
                      onClick={() => setStep("eligibility_check")}
                      className="w-full flex items-center gap-3 p-4 bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">Apply Now</div>
                        <div className="text-xs text-muted-foreground">Start your loan application</div>
                      </div>
                    </button>

                    {/* FAQ */}
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Answers</p>
                      <div className="space-y-2">
                        {faqItems.slice(0, 3).map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setStep("chat");
                              setTimeout(() => sendMessage(item.q), 100);
                            }}
                            className="w-full text-left text-xs p-2 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                          >
                            {item.q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Chat View */}
                {step === "chat" && (
                  <>
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                      <div className="space-y-4">
                        {messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex gap-2",
                              msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                          >
                            {msg.role === "assistant" && (
                              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-primary-foreground" />
                              </div>
                            )}
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              )}
                            >
                              {msg.role === "assistant" ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              ) : (
                                msg.content
                              )}
                            </div>
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                              <Bot className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <div className="bg-muted rounded-2xl px-4 py-2">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <form onSubmit={handleChatSubmit} className="p-4 border-t border-border shrink-0">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setStep("menu")}
                          className="shrink-0"
                        >
                          <ArrowRight className="w-4 h-4 rotate-180" />
                        </Button>
                        <Input
                          ref={inputRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1"
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </form>
                  </>
                )}

                {/* Eligibility Check Step */}
                {step === "eligibility_check" && (
                  <div className="p-4 space-y-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("menu")}
                      className="mb-2"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180 mr-2" />
                      Back
                    </Button>

                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                        <Phone className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg text-foreground">Check Eligibility</h3>
                      <p className="text-sm text-muted-foreground">Enter your mobile number to start</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Mobile Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter 10-digit mobile"
                        value={formData.phone || ""}
                        onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                      />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                    </div>

                    <Button
                      onClick={handleEligibilityCheck}
                      disabled={isCheckingEligibility}
                      className="w-full"
                    >
                      {isCheckingEligibility ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Continue
                    </Button>
                  </div>
                )}

                {/* Apply Step 1 - Personal Details */}
                {step === "apply_step1" && (
                  <ScrollArea className="flex-1 p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("eligibility_check")}
                      className="mb-3"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180 mr-2" />
                      Back
                    </Button>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Personal Details</h3>

                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          placeholder="Enter your full name"
                          value={formData.fullName || ""}
                          onChange={(e) => updateField("fullName", e.target.value)}
                        />
                        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={formData.email || ""}
                          onChange={(e) => updateField("email", e.target.value)}
                        />
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Mobile Number</Label>
                        <div className="relative">
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone || ""}
                            disabled={phoneVerified}
                            className={phoneVerified ? "bg-muted" : ""}
                          />
                          {phoneVerified && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>

                      <Button onClick={handleApplyStep1Next} className="w-full">
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </ScrollArea>
                )}

                {/* Apply Step 2 - Loan Details */}
                {step === "apply_step2" && (
                  <ScrollArea className="flex-1 p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("apply_step1")}
                      className="mb-3"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180 mr-2" />
                      Back
                    </Button>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Loan Requirements</h3>

                      <div className="space-y-2">
                        <Label>Loan Type</Label>
                        <RadioGroup
                          value={formData.loanType}
                          onValueChange={(v) => updateField("loanType", v)}
                          className="grid grid-cols-2 gap-2"
                        >
                          {loanTypes.map((type) => (
                            <Label
                              key={type.value}
                              className={cn(
                                "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                                formData.loanType === type.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted"
                              )}
                            >
                              <RadioGroupItem value={type.value} />
                              <span className="text-sm">{type.label}</span>
                            </Label>
                          ))}
                        </RadioGroup>
                        {errors.loanType && <p className="text-xs text-destructive">{errors.loanType}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loanAmount">Loan Amount (₹)</Label>
                        <Input
                          id="loanAmount"
                          type="number"
                          placeholder="Enter loan amount"
                          value={formData.loanAmount || ""}
                          onChange={(e) => updateField("loanAmount", e.target.value)}
                        />
                        {errors.loanAmount && <p className="text-xs text-destructive">{errors.loanAmount}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label>Employment Type</Label>
                        <RadioGroup
                          value={formData.employmentType}
                          onValueChange={(v) => updateField("employmentType", v)}
                          className="space-y-2"
                        >
                          {employmentTypes.map((type) => (
                            <Label
                              key={type.value}
                              className={cn(
                                "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                                formData.employmentType === type.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted"
                              )}
                            >
                              <RadioGroupItem value={type.value} />
                              <span className="text-sm">{type.label}</span>
                            </Label>
                          ))}
                        </RadioGroup>
                        {errors.employmentType && <p className="text-xs text-destructive">{errors.employmentType}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="monthlyIncome">Monthly Income (₹)</Label>
                        <Input
                          id="monthlyIncome"
                          type="number"
                          placeholder="Enter monthly income"
                          value={formData.monthlyIncome || ""}
                          onChange={(e) => updateField("monthlyIncome", e.target.value)}
                        />
                        {errors.monthlyIncome && <p className="text-xs text-destructive">{errors.monthlyIncome}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            placeholder="City"
                            value={formData.city || ""}
                            onChange={(e) => updateField("city", e.target.value)}
                          />
                          {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pincode">Pincode</Label>
                          <Input
                            id="pincode"
                            placeholder="Pincode"
                            value={formData.pincode || ""}
                            onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                            maxLength={6}
                          />
                          {errors.pincode && <p className="text-xs text-destructive">{errors.pincode}</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>State</Label>
                        <Select value={formData.state} onValueChange={(v) => updateField("state", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {indianStates.map((state) => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label>CIBIL Score Range</Label>
                        <Select value={formData.cibilScoreRange} onValueChange={(v) => updateField("cibilScoreRange", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select CIBIL range" />
                          </SelectTrigger>
                          <SelectContent>
                            {cibilScoreRanges.map((range) => (
                              <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.cibilScoreRange && <p className="text-xs text-destructive">{errors.cibilScoreRange}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currentMonthlyEmi">Current Monthly EMI (Optional)</Label>
                        <Input
                          id="currentMonthlyEmi"
                          type="number"
                          placeholder="Enter current EMI if any"
                          value={formData.currentMonthlyEmi || ""}
                          onChange={(e) => updateField("currentMonthlyEmi", e.target.value)}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="emiBounce"
                          checked={formData.emiBounce || false}
                          onCheckedChange={(c) => updateField("emiBounce", !!c)}
                        />
                        <Label htmlFor="emiBounce" className="text-sm text-muted-foreground">
                          Any EMI bounce in last 6 months?
                        </Label>
                      </div>

                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="agreeTerms"
                          checked={formData.agreeTerms || false}
                          onCheckedChange={(c) => updateField("agreeTerms", !!c)}
                        />
                        <Label htmlFor="agreeTerms" className="text-xs text-muted-foreground">
                          I agree to the{" "}
                          <a href="/terms-conditions" target="_blank" className="text-primary underline">Terms</a>
                          {" "}and{" "}
                          <a href="/privacy-policy" target="_blank" className="text-primary underline">Privacy Policy</a>
                        </Label>
                      </div>
                      {errors.agreeTerms && <p className="text-xs text-destructive">{errors.agreeTerms}</p>}

                      <Button onClick={handleStep2Next} className="w-full">
                        Check Pre-Approval
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </ScrollArea>
                )}

                {/* Apply Step 3 - Pre-Approval */}
                {step === "apply_step3" && preApproval && (
                  <div className="p-4 space-y-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("apply_step2")}
                      className="mb-2"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180 mr-2" />
                      Back
                    </Button>

                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-lg text-foreground">Pre-Approved!</h3>
                      <p className="text-sm text-muted-foreground">You're eligible for a loan</p>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Loan Amount</span>
                        <span className="font-semibold">{formatCurrency(preApproval.loanAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Interest Rate</span>
                        <span className="font-semibold">{preApproval.interestRate}% p.a.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tenure</span>
                        <span className="font-semibold">{preApproval.tenureMonths} months</span>
                      </div>
                      <div className="pt-3 border-t border-border flex justify-between">
                        <span className="text-sm font-medium text-foreground">Monthly EMI</span>
                        <span className="font-bold text-primary text-lg">{formatCurrency(preApproval.emi)}</span>
                      </div>
                    </div>

                    <Button 
                      onClick={createLeadAndGoToPayment} 
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Submit Application
                    </Button>
                  </div>
                )}

                {/* Success Options */}
                {step === "success_options" && (
                  <div className="p-4 space-y-4">
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-lg text-foreground">Application Submitted!</h3>
                      <p className="text-sm text-muted-foreground">What would you like to do next?</p>
                    </div>

                    <div className="space-y-3">
                      <Button onClick={goToPayment} className="w-full">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Complete Payment
                      </Button>

                      <Button 
                        variant="outline" 
                        onClick={openWhatsApp}
                        className="w-full"
                      >
                        <WhatsAppIcon size="sm" className="mr-2" />
                        Chat with Agent
                      </Button>

                      <Button 
                        variant="ghost" 
                        onClick={resetWidget}
                        className="w-full"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FinanceSupportWidget;
