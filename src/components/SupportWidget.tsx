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
import { usePublicCompany, getCurrentCompanyId } from "@/contexts/PublicCompanyContext";
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
  { q: "What is the interest rate?", a: "Interest rates start from 8% p.a. depending on your profile and loan type." },
  { q: "How long for approval?", a: "We provide quick approval within 24-48 hours for eligible applicants." },
  { q: "What is the eligibility?", a: "Age 21-65 years, minimum income ₹15,000/month, and CIBIL score 650+." },
  { q: "What loan types are available?", a: "Personal, Business, Marriage, Education, Vehicle, Gold, and Home Loans." },
];

const SupportWidget = () => {
  const navigate = useNavigate();
  const { company } = usePublicCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [step, setStep] = useState<WidgetStep>("menu");
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hello! I'm your loan assistant. How can I help you today?",
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
  const companyName = company?.name || "Credit Hariox";

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
    const message = `Hi ${companyName}, I want to know more about loans.`;
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

  const resolveCompanyIdForPublicLead = async (): Promise<string | null> => {
    const fromStorage = getCurrentCompanyId();
    if (fromStorage) return fromStorage;

    const { data: fallbackCompany } = await supabase
      .from("companies")
      .select("id, slug")
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (fallbackCompany?.id) {
      localStorage.setItem("publicCompanyId", fallbackCompany.id);
      return fallbackCompany.id;
    }
    return null;
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

      const companyId = await resolveCompanyIdForPublicLead();

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
        const leadId = crypto.randomUUID();

        await supabase.from("leads").insert({
          id: leadId,
          full_name: formData.fullName!.trim(),
          email: formData.email!.trim(),
          phone: String(formData.phone!).trim(),
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
          status: "unpaid",
          source: "chatbot",
          cibil_score_range: formData.cibilScoreRange,
          current_monthly_emi: Number(formData.currentMonthlyEmi) || 0,
          emi_bounce_last_6_months: formData.emiBounce,
          company_id: companyId,
        });

        trackLeadEvent(companyId, {
          loan_type: formData.loanType,
          loan_amount: preApproval.loanAmount,
          employment_type: formData.employmentType,
        });

        // Fire Meta Pixel Lead event (single event, deduplicated by leadId)
        trackLead({ content_name: formData.loanType, value: preApproval.loanAmount }, leadId);

        setExistingLeadId(leadId);
        setStep("success_options");
      }

      toast.success("Application submitted successfully!");
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToPayment = () => {
    navigate("/payment", {
      state: {
        leadId: existingLeadId,
        loanAmount: preApproval?.loanAmount,
        leadDetails: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        },
      },
    });
    setIsOpen(false);
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
    setPreApproval(null);
    setExistingLeadId(null);
    setPhoneVerified(false);
    setIsCheckingEligibility(false);
    setMessages([{
      role: "assistant",
      content: "👋 Hello! I'm your loan assistant. How can I help you today?",
    }]);
  };

  if (!isOpen) {
    return (
      <motion.button
        onClick={() => setIsOpen(true)}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: "spring" }}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-primary via-blue-600 to-primary rounded-full shadow-2xl flex items-center justify-center group"
        aria-label="Open Support Chat"
      >
        <Bot className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        </span>
        <span className="absolute inset-0 rounded-full bg-primary/50 animate-ping" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={cn(
          "fixed z-50 bg-card border border-border rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden",
          isMinimized
            ? "bottom-24 md:bottom-6 right-4 md:right-6 w-72 h-14"
            : "bottom-20 md:bottom-4 right-2 md:right-4 w-[calc(100%-1rem)] md:w-[calc(100%-2rem)] max-w-[400px] h-[70vh] max-h-[580px] sm:max-h-[620px]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{companyName}</h3>
              <p className="text-xs text-white/80">
                {isLoading ? "Typing..." : "Online • Here to help"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                resetWidget();
              }}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="h-[calc(100%-60px)] overflow-y-auto">
            {/* Main Menu */}
            {step === "menu" && (
              <div className="p-4 space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg text-foreground">How can we help?</h4>
                  <p className="text-sm text-muted-foreground">Choose an option to get started</p>
                </div>

                <div className="space-y-3">
                  {/* WhatsApp Option */}
                  <button
                    onClick={openWhatsApp}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:opacity-90 transition-all shadow-lg"
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold">Connect with Agent</p>
                      <p className="text-xs text-white/80">Chat on WhatsApp instantly</p>
                    </div>
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  {/* FAQ Option */}
                  <button
                    onClick={() => setStep("chat")}
                    className="w-full flex items-center gap-4 p-4 bg-muted hover:bg-muted/80 rounded-xl transition-all border"
                  >
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                      <HelpCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-foreground">FAQ & AI Chat</p>
                      <p className="text-xs text-muted-foreground">Get answers to your questions</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  {/* Apply Now Option */}
                  <button
                    onClick={() => setStep("eligibility_check")}
                    className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl hover:opacity-90 transition-all shadow-lg"
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold">Apply for Loan</p>
                      <p className="text-xs text-white/80">Quick application in 2 minutes</p>
                    </div>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick FAQs */}
                <div className="pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Quick Answers</p>
                  <div className="space-y-2">
                    {faqItems.slice(0, 3).map((faq, idx) => (
                      <details key={idx} className="group">
                        <summary className="text-sm text-foreground cursor-pointer hover:text-primary transition-colors list-none flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                          {faq.q}
                          <ArrowRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                        </summary>
                        <p className="text-xs text-muted-foreground mt-1 px-2 pb-2">{faq.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat / FAQ View */}
            {step === "chat" && (
              <div className="flex flex-col h-full">
                <div className="p-2 border-b">
                  <Button variant="ghost" size="sm" onClick={() => setStep("menu")} className="text-xs">
                    ← Back to Menu
                  </Button>
                </div>
                
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
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
                            <div className="prose prose-sm dark:prose-invert max-w-none">
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

                <form onSubmit={handleChatSubmit} className="p-4 border-t">
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
              </div>
            )}

            {/* Eligibility Check - Phone Number First */}
            {step === "eligibility_check" && (
              <div className="p-4 space-y-4">
                <div className="p-2 border-b -mx-4 -mt-4 mb-4">
                  <Button variant="ghost" size="sm" onClick={() => setStep("menu")} className="text-xs">
                    ← Back to Menu
                  </Button>
                </div>

                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg text-foreground">Check Eligibility Free</h4>
                  <p className="text-sm text-muted-foreground">Enter your mobile number to get started</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium">Mobile Number</Label>
                    <div className="flex mt-1">
                      <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg">
                        +91
                      </span>
                      <Input
                        id="phone"
                        type="tel"
                        maxLength={10}
                        placeholder="Enter 10-digit number"
                        value={formData.phone}
                        onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, ""))}
                        className="rounded-l-none"
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>

                  <Button
                    onClick={handleEligibilityCheck}
                    disabled={isCheckingEligibility || !formData.phone || formData.phone.length !== 10}
                    className="w-full py-3 rounded-xl disabled:opacity-50"
                  >
                    {isCheckingEligibility ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        Check Eligibility Free
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    By continuing, you agree to our Terms & Conditions
                  </p>
                </div>
              </div>
            )}

            {/* Apply Step 1 - Personal Details (Name & Email only - phone already provided) */}
            {step === "apply_step1" && (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep("eligibility_check")} className="text-xs p-1 h-auto">
                    ← Back
                  </Button>
                  <span className="text-xs text-muted-foreground">Step 1 of 4</span>
                </div>
                
                <div className="text-center pb-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Personal Details</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Full Name *</Label>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                      placeholder="Your full name"
                      className={errors.fullName ? "border-destructive" : ""}
                    />
                    {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
                  </div>
                  
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="your@email.com"
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                  </div>

                  {/* Verified Phone Display */}
                  <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                          <Phone className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-primary font-medium">Mobile Number</p>
                          <p className="text-lg font-semibold text-foreground">+91 {formData.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-primary/20 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary">Verified</span>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleApplyStep1Next} className="w-full gap-2">
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Apply Step 2 - Loan & Credit Details */}
            {step === "apply_step2" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep("apply_step1")} className="text-xs p-1 h-auto">
                    ← Back
                  </Button>
                  <span className="text-xs text-muted-foreground">Step 2 of 3</span>
                </div>

                <div className="text-center pb-2">
                  <h4 className="font-semibold text-foreground text-sm">Loan & Credit Details</h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Loan Type *</Label>
                    <Select value={formData.loanType} onValueChange={(v) => updateField("loanType", v)}>
                      <SelectTrigger className={cn("text-xs", errors.loanType ? "border-destructive" : "")}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {loanTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Loan Amount (₹) *</Label>
                    <Input
                      type="number"
                      value={formData.loanAmount}
                      onChange={(e) => updateField("loanAmount", e.target.value)}
                      placeholder="500000"
                      className={cn("text-xs", errors.loanAmount ? "border-destructive" : "")}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">Employment *</Label>
                    <Select value={formData.employmentType} onValueChange={(v) => updateField("employmentType", v)}>
                      <SelectTrigger className={cn("text-xs", errors.employmentType ? "border-destructive" : "")}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {employmentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Monthly Income (₹) *</Label>
                    <Input
                      type="number"
                      value={formData.monthlyIncome}
                      onChange={(e) => updateField("monthlyIncome", e.target.value)}
                      placeholder="50000"
                      className={cn("text-xs", errors.monthlyIncome ? "border-destructive" : "")}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">City *</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="City"
                      className={cn("text-xs", errors.city ? "border-destructive" : "")}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">Pincode *</Label>
                    <Input
                      value={formData.pincode}
                      onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit"
                      className={cn("text-xs", errors.pincode ? "border-destructive" : "")}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">State *</Label>
                    <Select value={formData.state} onValueChange={(v) => updateField("state", v)}>
                      <SelectTrigger className={cn("text-xs", errors.state ? "border-destructive" : "")}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {indianStates.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs">CIBIL Score *</Label>
                    <Select value={formData.cibilScoreRange} onValueChange={(v) => updateField("cibilScoreRange", v)}>
                      <SelectTrigger className={cn("text-xs", errors.cibilScoreRange ? "border-destructive" : "")}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {cibilScoreRanges.map(range => (
                          <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Current EMI (₹)</Label>
                    <Input
                      type="number"
                      value={formData.currentMonthlyEmi}
                      onChange={(e) => updateField("currentMonthlyEmi", e.target.value)}
                      placeholder="0"
                      className="text-xs"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 pt-4">
                    <Checkbox
                      id="emiBounce"
                      checked={formData.emiBounce}
                      onCheckedChange={(c) => updateField("emiBounce", !!c)}
                    />
                    <label htmlFor="emiBounce" className="text-xs text-muted-foreground">EMI bounce in last 6 months?</label>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="terms"
                    checked={formData.agreeTerms}
                    onCheckedChange={(c) => updateField("agreeTerms", !!c)}
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground">
                    I agree to the terms and privacy policy
                  </label>
                </div>
                {errors.agreeTerms && <p className="text-xs text-destructive">{errors.agreeTerms}</p>}

                <Button onClick={handleStep2Next} className="w-full gap-2 mt-2">
                  Check Eligibility <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Apply Step 3 - Pre-Approval */}
            {step === "apply_step3" && preApproval && (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep("apply_step2")} className="text-xs p-1 h-auto">
                    ← Back
                  </Button>
                  <span className="text-xs text-muted-foreground">Step 3 of 3</span>
                </div>

                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-foreground">You're Pre-Approved! 🎉</h4>
                  <p className="text-sm text-muted-foreground mt-1">Congratulations, {formData.fullName?.split(" ")[0]}!</p>
                </div>

                <div className="bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Loan Amount</span>
                    <span className="text-lg font-bold text-foreground">{formatCurrency(preApproval.loanAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Monthly EMI</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(preApproval.emi)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Interest Rate</span>
                    <span className="font-medium text-foreground">{preApproval.interestRate}% p.a.</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tenure</span>
                    <span className="font-medium text-foreground">{preApproval.tenureMonths} Months</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-800 dark:text-amber-200">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <p className="text-xs">Complete payment to secure your loan in 24 hours!</p>
                </div>

                <Button onClick={createLeadAndGoToPayment} className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            )}

            {/* Success Options */}
            {step === "success_options" && (
              <div className="p-4 space-y-4">
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-foreground">Application Submitted!</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hi {formData.fullName?.split(" ")[0]}, what would you like to do next?
                  </p>
                </div>

                <div className="space-y-3">
                  <Button onClick={goToPayment} className="w-full gap-2 bg-gradient-to-r from-primary to-blue-600">
                    <CreditCard className="w-4 h-4" />
                    Make Payment Now
                  </Button>

                  <Button onClick={openWhatsApp} variant="outline" className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50">
                    <Phone className="w-4 h-4" />
                    Chat on WhatsApp
                  </Button>

                  <Button onClick={resetWidget} variant="ghost" className="w-full text-muted-foreground">
                    Start Over
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SupportWidget;
