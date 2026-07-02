import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Loader2, CheckCircle, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import OTPVerificationStep from "@/components/OTPVerificationStep";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { calculateEMI, formatCurrency } from "@/hooks/useEMICalculator";
import { getCurrentCompanyId } from "@/contexts/PublicCompanyContext";
import { trackLeadEvent } from "@/hooks/useAnalyticsTracker";
import { trackLead, setAdvancedMatchingData } from "@/components/MetaPixel";
import { createPhoneLead } from "@/lib/createPhoneLead";
import { getStoredUtmParams } from "@/hooks/useUtmParams";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Preload PaymentPage chunk so it's ready when user reaches payment step
const preloadPaymentPage = () => {
  import("@/pages/PaymentPage").catch(() => {});
};

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
  state: z.string().optional(),
  cibilScoreRange: z.string().min(1, "Please select CIBIL score range"),
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
  processingTimeLabel: string;
};

// Updated loan types: Removed Home Loan, Added Marriage Loan
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

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: {
    loanAmount?: number;
    interestRate?: number;
    tenure?: number;
    emi?: number;
  };
  /** Optional phone captured outside the modal (e.g. hero form). When valid, modal will auto-run eligibility check. */
  initialPhone?: string;
}

const ApplicationModal = ({ isOpen, onClose, prefillData, initialPhone }: ApplicationModalProps) => {
  const navigate = useNavigate();
  
  // Check if we have a valid initial phone to skip step 0
  const phoneRegex = /^[6-9]\d{9}$/;
  const validInitialPhone = phoneRegex.test(String(initialPhone ?? "").replace(/\D/g, "").slice(0, 10))
    ? String(initialPhone).replace(/\D/g, "").slice(0, 10)
    : null;
  
  const [step, setStep] = useState(0); // Always start at step 0, eligibility check will route
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(() => !!validInitialPhone); // Show loading if phone provided
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false); // OTP verified state
  const [showOtpStep, setShowOtpStep] = useState(false); // Show OTP step for new customers
  const [isReturningCustomer, setIsReturningCustomer] = useState(false); // Track returning customers
  const [existingLeadId, setExistingLeadId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [preApproval, setPreApproval] = useState<PreApprovalSnapshot | null>(null);
  const [phoneInput, setPhoneInput] = useState(() => validInitialPhone ?? "");
  const didAutoCheckRef = useRef(false);
  
  const [formData, setFormData] = useState<Partial<FormData>>({
    fullName: "",
    email: "",
    phone: validInitialPhone ?? "",
    loanType: "",
    loanAmount: prefillData?.loanAmount?.toString() || "",
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

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Check for existing lead when phone number is complete
  const checkExistingLead = async (phone: string) => {
    if (phone.length !== 10) return;
    
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) return;

    setIsCheckingPhone(true);
    try {
      // Use secure RPC to look up leads instead of direct table access
      const { data: leads, error } = await supabase
        .rpc("lookup_leads_by_phone", { _phone: phone });

      if (error) {
        console.error("Error checking existing lead:", error);
        return;
      }

      const existingLead = (leads?.[0] || null) as any;

      if (existingLead) {
        setExistingLeadId(existingLead.id);
        
        // Pre-fill form with existing data
        setFormData(prev => ({
          ...prev,
          fullName: existingLead.full_name || prev.fullName,
          email: existingLead.email || prev.email,
          phone: existingLead.phone || prev.phone,
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

        // Determine which step to navigate to based on lead status
        if (existingLead.status === "unpaid") {
          // Check if they have all loan details filled
         // Must have ALL required details: name, email, loan info
         const hasCompleteProfile = existingLead.full_name && 
           existingLead.full_name !== "Phone Lead" &&
           existingLead.email && 
           !existingLead.email.includes("@placeholder") &&
           existingLead.loan_type && 
           existingLead.loan_amount && 
           existingLead.employment_type &&
           existingLead.city;
         
         if (hasCompleteProfile) {
            // Set pre-approval data and go to step 3
            const loanAmount = existingLead.loan_amount;
            const interestRate = existingLead.interest_rate || prefillData?.interestRate || 10;
            const tenureMonths = existingLead.tenure_months || prefillData?.tenure || 36;
            const emiCalc = calculateEMI(loanAmount, interestRate, tenureMonths);
            
            setPreApproval({
              loanAmount,
              emi: emiCalc.emi,
              interestRate,
              tenureMonths,
              processingTimeLabel: "24 Hours",
            });
            
            // Navigate directly to payment
            navigate("/payment", {
              state: {
                leadId: existingLead.id,
                loanAmount: existingLead.loan_amount,
                leadDetails: {
                  fullName: existingLead.full_name,
                  email: existingLead.email,
                  phone: existingLead.phone,
                },
              },
            });
            onClose();
            return;
          } else {
            // Go to step 2 to complete loan details
            setStep(2);
          }
        } else {
          // Lead already paid or in processing - redirect to payment success or show message
          navigate("/payment", {
            state: {
              leadId: existingLead.id,
              loanAmount: existingLead.loan_amount,
              leadDetails: {
                fullName: existingLead.full_name,
                email: existingLead.email,
                phone: existingLead.phone,
              },
            },
          });
          onClose();
        }
      } else {
        setExistingLeadId(null);
      }
    } catch (err) {
      console.error("Error checking lead:", err);
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // Phone eligibility check handler (Step 0)
  // FLOW: Check existing lead FIRST → redirect/skip OTP if returning → OTP only for NEW customers
  const handlePhoneEligibilityCheck = async (phoneOverride?: string): Promise<"returning" | "new" | "redirected"> => {
    const phoneRegex = /^[6-9]\d{9}$/;
    const phone = String(phoneOverride ?? phoneInput)
      .replace(/\D/g, "")
      .slice(0, 10);

    if (!phoneRegex.test(phone)) {
      setErrors({ phone: "Enter valid 10-digit mobile number starting with 6-9" });
      return "new";
    }
    
    setErrors({});
    setIsCheckingPhone(true);
    
    try {
      // STEP 1: Check for existing lead BEFORE anything else
      const { data: leads } = await supabase
        .rpc("lookup_leads_by_phone", { _phone: phone });

      const existingLead = (leads?.[0] || null) as any;

      if (existingLead) {
        setExistingLeadId(existingLead.id);
        setIsReturningCustomer(true);
        
        const isPlaceholderLead = existingLead.full_name === "Phone Lead" || 
          existingLead.email?.includes("@placeholder.hariox.com") ||
          !existingLead.full_name || !existingLead.email;
        
        // Pre-fill form with existing data
        setFormData(prev => ({
          ...prev,
          fullName: (isPlaceholderLead ? "" : existingLead.full_name) || "",
          email: (existingLead.email?.includes("@placeholder") ? "" : existingLead.email) || "",
          phone,
          loanType: existingLead.loan_type || "",
          loanAmount: existingLead.loan_amount?.toString() || prev.loanAmount,
          employmentType: existingLead.employment_type || "",
          monthlyIncome: existingLead.monthly_income?.toString() || "",
          city: existingLead.city || "",
          pincode: existingLead.pincode || "",
          state: existingLead.state || "",
          cibilScoreRange: existingLead.cibil_score_range || "",
          currentMonthlyEmi: existingLead.current_monthly_emi?.toString() || "",
          emiBounce: existingLead.emi_bounce_last_6_months || false,
        }));

        const hasCompleteProfile = existingLead.full_name && 
          !isPlaceholderLead &&
          existingLead.email && 
          !existingLead.email.includes("@placeholder") &&
          existingLead.loan_type && 
          existingLead.loan_amount && 
          existingLead.employment_type &&
          existingLead.city;

        // STEP 2: Route based on lead status
        // Lost/Rejected leads = allow re-application (skip OTP since they're returning)
        if (existingLead.status === "lost" || existingLead.status === "rejected") {
          setPhoneVerified(true);
          setOtpVerified(true);
          if (hasCompleteProfile) {
            // Has all details, go to loan details step to re-apply
            setStep(2);
          } else {
            // Incomplete profile, go to personal details
            setStep(1);
          }
          return "returning";
        }
        
        // Unpaid leads
        if (existingLead.status === "unpaid") {
          if (hasCompleteProfile) {
            // Complete profile → redirect to payment directly
            navigate("/payment", {
              state: {
                leadId: existingLead.id,
                loanAmount: existingLead.loan_amount,
                leadDetails: {
                  fullName: existingLead.full_name,
                  email: existingLead.email,
                  phone: existingLead.phone,
                },
              },
            });
            onClose();
            return "redirected";
          } else {
            // Incomplete profile → skip OTP, go to step 1
            setPhoneVerified(true);
            setOtpVerified(true);
            setStep(1);
            return "returning";
          }
        }
        
        // Already paid/processing/verified/disbursed → redirect to payment
        navigate("/payment", {
          state: {
            leadId: existingLead.id,
            loanAmount: existingLead.loan_amount,
            leadDetails: {
              fullName: existingLead.full_name,
              email: existingLead.email,
              phone: existingLead.phone,
            },
          },
        });
        onClose();
        return "redirected";
      } else {
        // STEP 3: NEW customer — require OTP verification
        setFormData(prev => ({ ...prev, phone }));
        setIsReturningCustomer(false);
        setShowOtpStep(true); // Show OTP step — OTP only sent here
        return "new";
      }
    } catch (err) {
      console.error("Error checking lead:", err);
      // On error, still require OTP for safety
      setFormData(prev => ({ ...prev, phone }));
      setShowOtpStep(true);
      return "new";
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // Handler when OTP is verified for new customers
  const handleOtpVerified = () => {
    // Capture phone value immediately (before any async operations)
    const phoneToUse = String(formData.phone || phoneInput).replace(/\D/g, "").slice(-10);
    setOtpVerified(true);
    setPhoneVerified(true);
    setShowOtpStep(false);
    setStep(1);
    
    // Create minimal lead immediately after OTP verification
    if (phoneToUse && /^[6-9]\d{9}$/.test(phoneToUse)) {
      (async () => {
        try {
          const companyId = await resolveCompanyIdForPublicLead();
          const createdLeadId = await createPhoneLead(phoneToUse, companyId, "website-otp");
          if (createdLeadId) {
            setExistingLeadId(createdLeadId);
          }
        } catch (err) {
          // Silent fail - lead will be created on form submission
        }
      })();
    }
  };

  // Handler to go back from OTP step
  const handleOtpBack = () => {
    setShowOtpStep(false);
    setPhoneInput("");
    setFormData(prev => ({ ...prev, phone: "" }));
  };

  // If phone is collected outside (e.g. hero), auto-run eligibility check once on open
  // FIXED: Don't skip OTP — let handlePhoneEligibilityCheck decide the flow
  useLayoutEffect(() => {
    if (!isOpen) {
      didAutoCheckRef.current = false;
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    const phone = String(initialPhone ?? "")
      .replace(/\D/g, "")
      .slice(0, 10);

    if (!phoneRegex.test(phone)) return;
    if (didAutoCheckRef.current) return;
    didAutoCheckRef.current = true;

    setPhoneInput(phone);
    setFormData((prev) => ({ ...prev, phone }));
    // Don't set phoneVerified or step here — let the eligibility check handle routing
    void handlePhoneEligibilityCheck(phone);
  }, [isOpen, initialPhone]);

  const validateStep1 = () => {
    const step1Schema = z.object({
      fullName: applicationSchema.shape.fullName,
      email: applicationSchema.shape.email,
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
      cibilScoreRange: applicationSchema.shape.cibilScoreRange,
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

  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      preloadPaymentPage(); // Start loading payment page chunk early
      setStep(2);
    }
  };

  const stepsTotal = 4; // Step 4 is payment page
  const stepMeta = useMemo(() => {
    const label = step === 0 ? "Check Eligibility" : step === 1 ? "Personal Details" : step === 2 ? "Loan & Credit Details" : "You're Pre-Approved";
    const progress = step === 0 ? 5 : step === 1 ? 20 : step === 2 ? 50 : 75;
    return { label, progress };
  }, [step]);

  const handleEligibilityCheck = () => {
    if (!validateStep2()) return;
    const loanAmount = Number(formData.loanAmount);
    const interestRate = prefillData?.interestRate || 10;
    const tenureMonths = prefillData?.tenure || 36;
    const emiCalc = calculateEMI(loanAmount, interestRate, tenureMonths);

    setPreApproval({
      loanAmount,
      emi: emiCalc.emi,
      interestRate,
      tenureMonths,
      processingTimeLabel: "24 Hours",
    });
    setStep(3);
  };

  const inferCompanySlugFromHostname = (hostname: string): string | null => {
    const host = hostname.toLowerCase();
    // Known mappings
    if (host.includes("finance.hariox") || host.startsWith("finance.")) return "finance";
    if (host.includes("credit.hariox") || host.startsWith("credit.")) return "hariox";
    // Default for other hariox domains
    if (host.includes("hariox")) return "hariox";
    return null;
  };

  const resolveCompanyIdForPublicLead = async (): Promise<string | null> => {
    // 1) If PublicCompanyProvider already resolved it
    const fromStorage = getCurrentCompanyId();
    if (fromStorage) return fromStorage;

    // 2) Infer from hostname and fetch company id
    const hostname = window.location.hostname || "";
    const inferredSlug = inferCompanySlugFromHostname(hostname);
    if (inferredSlug) {
      const { data: inferredCompany } = await supabase
        .from("companies")
        .select("id, slug")
        .eq("slug", inferredSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (inferredCompany?.id) {
        localStorage.setItem("publicCompanyId", inferredCompany.id);
        localStorage.setItem("publicCompanySlug", inferredCompany.slug);
        return inferredCompany.id;
      }
    }

    // 3) Fallback to first active company (prevents NULL company_id inserts)
    const { data: fallbackCompany } = await supabase
      .from("companies")
      .select("id, slug")
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (fallbackCompany?.id) {
      localStorage.setItem("publicCompanyId", fallbackCompany.id);
      localStorage.setItem("publicCompanySlug", fallbackCompany.slug);
      return fallbackCompany.id;
    }

    return null;
  };

  const createLeadAndGoToPayment = async () => {
    if (!validateStep2()) return;
    if (!preApproval) {
      setErrors({ agreeTerms: "Please verify eligibility first." });
      return;
    }

    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, agreeTerms: undefined }));

    try {
      // Map employment type to database enum
      const employmentTypeMap: Record<string, string> = {
        salaried: "salaried",
        self_employed: "self_employed",
        "self-employed": "self_employed",
        business_owner: "business_owner",
        business: "business_owner",
      };

      const companyId = await resolveCompanyIdForPublicLead();
      const cleanPhone = String(formData.phone).replace(/\D/g, "").slice(-10);

      // Capture Meta fbc/fbp cookies for server-side CAPI attribution
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
      };

      // Use backend upsert function to handle both create and update
      const { data, error } = await supabase.functions.invoke("upsert-lead", {
        body: {
          phone: cleanPhone,
          full_name: formData.fullName!.trim(),
          email: formData.email!.trim(),
          city: formData.city!.trim(),
          pincode: formData.pincode!.trim(),
          state: formData.state!,
          loan_type: formData.loanType,
          loan_amount: preApproval.loanAmount,
          employment_type: employmentTypeMap[formData.employmentType!] || "salaried",
          monthly_income: Number(formData.monthlyIncome),
          emi_amount: preApproval.emi,
          interest_rate: preApproval.interestRate,
          tenure_months: preApproval.tenureMonths,
          cibil_score_range: formData.cibilScoreRange,
          current_monthly_emi: Number(formData.currentMonthlyEmi) || 0,
          emi_bounce_last_6_months: formData.emiBounce,
          source: "website",
          ...getStoredUtmParams(),
          company_id: companyId,
          meta_fbc: getCookie('_fbc'),
          meta_fbp: getCookie('_fbp'),
        },
      });

      if (error) {
        console.error("upsert-lead error:", error);
        throw new Error("Failed to submit application");
      }

      if (!data?.success) {
        console.error("upsert-lead failed:", data?.error);
        throw new Error(data?.error || "Failed to submit application");
      }

      const leadId = data.lead_id;
      console.log("Lead upserted successfully:", { leadId, action: data.action });

      // Track lead event for analytics
      trackLeadEvent(companyId, {
        loan_type: formData.loanType,
        loan_amount: preApproval.loanAmount,
        employment_type: formData.employmentType,
      });

      // Store user data for Meta Advanced Matching (improves Ads Manager attribution)
      setAdvancedMatchingData(formData.email, formData.phone);

      // Fire Meta Pixel Lead event (single event, deduplicated by leadId)
      trackLead({ content_name: formData.loanType, value: preApproval.loanAmount }, leadId);

      // Best-effort: send welcome SMS after form fill (does not block user flow)
      supabase.functions
        .invoke("send-sms", {
          body: {
            type: "remarketing_credit",
            leadId,
            phone: cleanPhone,
          },
        })
        .then(({ error }) => {
          if (error) console.warn("welcome sms failed", error);
        })
        .catch((e) => console.warn("welcome sms error", e));

      // Navigate immediately — Meta Pixel fires asynchronously
      navigate("/payment", {
        state: {
          leadId,
          loanAmount: preApproval.loanAmount,
          leadDetails: {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone,
          },
        },
      });

      onClose();
    } catch (error) {
      console.error("Error submitting application:", error);
      setErrors({ agreeTerms: "Failed to submit. Please try again." });
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(0);
      setPhoneInput("");
      setPhoneVerified(false);
      setOtpVerified(false);
      setShowOtpStep(false);
      setIsReturningCustomer(false);
      setPreApproval(null);
      setExistingLeadId(null);
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        loanType: "",
        loanAmount: prefillData?.loanAmount?.toString() || "",
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
    }, 300);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative gradient-brand p-6 text-primary-foreground">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-bold">
                {step === 0 ? (showOtpStep ? "Verify Your Number" : "Check Your Eligibility") : "Start Your Application"}
              </h2>
              <p className="text-primary-foreground/80 mt-1">
                {step === 0 ? (showOtpStep ? "Enter the OTP sent to your mobile" : "Enter your mobile to check eligibility") : `Step ${step} of ${stepsTotal} - ${stepMeta.label}`}
              </p>

              {/* EMI Preview if prefilled */}
              {prefillData?.emi && (
                <div className="mt-4 bg-white/10 rounded-xl p-3">
                  <p className="text-sm opacity-80">Your Estimated EMI</p>
                  <p className="text-2xl font-bold">{formatCurrency(prefillData.emi)}/month</p>
                </div>
              )}

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <motion.div
                  className="h-full bg-secondary"
                  initial={{ width: "0%" }}
                  animate={{ width: `${stepMeta.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {/* Step 0: Phone Eligibility Check */}
                {step === 0 && !showOtpStep && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Check Your Loan Eligibility</h3>
                      <p className="text-sm text-muted-foreground mt-1">Enter your mobile number to get started</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phoneCheck">Mobile Number *</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                          +91
                        </span>
                        <Input
                          id="phoneCheck"
                          type="tel"
                          placeholder="Enter 10-digit mobile number"
                          value={phoneInput}
                          onChange={(e) => {
                            setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10));
                            if (errors.phone) setErrors({});
                          }}
                          className={`rounded-l-none text-lg py-6 ${errors.phone ? "border-destructive" : ""}`}
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-sm text-destructive">{errors.phone}</p>
                      )}
                    </div>

                    <Button 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      onClick={() => void handlePhoneEligibilityCheck()}
                      disabled={isCheckingPhone || phoneInput.length !== 10}
                    >
                      {isCheckingPhone ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Checking Eligibility...
                        </>
                      ) : (
                        <>
                          Check Eligibility Free
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                    
                    <p className="text-xs text-center text-muted-foreground">
                      By continuing, you agree to our Terms & Privacy Policy
                    </p>
                  </motion.div>
                )}

                {/* OTP Verification Step (for new customers only) */}
                {step === 0 && showOtpStep && (
                  <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <OTPVerificationStep
                      phone={formData.phone || phoneInput}
                      onVerified={handleOtpVerified}
                      onBack={handleOtpBack}
                    />
                  </motion.div>
                )}

                {/* Step 1: Name & Email (Phone already verified) */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* Verified Phone Badge */}
                    {phoneVerified && formData.phone && (
                      <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/30 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-primary" />
                            <div>
                              <p className="text-sm text-muted-foreground">Mobile Number</p>
                              <p className="text-lg font-semibold text-foreground">+91 {formData.phone}</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                            Verified
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={(e) => updateField("fullName", e.target.value)}
                        className={errors.fullName ? "border-destructive" : ""}
                      />
                      {errors.fullName && (
                        <p className="text-sm text-destructive">{errors.fullName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        className={errors.email ? "border-destructive" : ""}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>

                    <Button 
                      variant="hero" 
                      size="lg" 
                      className="w-full mt-6"
                      onClick={handleNext}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Loan Type *</Label>
                      <RadioGroup
                        value={formData.loanType}
                        onValueChange={(value) => updateField("loanType", value)}
                        className="grid grid-cols-2 gap-2"
                      >
                        {loanTypes.map((type) => (
                          <div key={type.value} className="flex items-center space-x-2">
                            <RadioGroupItem value={type.value} id={type.value} />
                            <Label htmlFor={type.value} className="font-normal cursor-pointer">
                              {type.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {errors.loanType && (
                        <p className="text-sm text-destructive">{errors.loanType}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="loanAmount">Loan Amount (₹) *</Label>
                        <Input
                          id="loanAmount"
                          type="text"
                          placeholder="e.g., 500000"
                          value={formData.loanAmount}
                          onChange={(e) => updateField("loanAmount", e.target.value.replace(/\D/g, ""))}
                          className={errors.loanAmount ? "border-destructive" : ""}
                        />
                        {errors.loanAmount && (
                          <p className="text-sm text-destructive">{errors.loanAmount}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="monthlyIncome">Monthly Income (₹) *</Label>
                        <Input
                          id="monthlyIncome"
                          type="text"
                          placeholder="e.g., 50000"
                          value={formData.monthlyIncome}
                          onChange={(e) => updateField("monthlyIncome", e.target.value.replace(/\D/g, ""))}
                          className={errors.monthlyIncome ? "border-destructive" : ""}
                        />
                        {errors.monthlyIncome && (
                          <p className="text-sm text-destructive">{errors.monthlyIncome}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Employment Type *</Label>
                      <RadioGroup
                        value={formData.employmentType}
                        onValueChange={(value) => updateField("employmentType", value)}
                        className="flex flex-wrap gap-4"
                      >
                        {employmentTypes.map((type) => (
                          <div key={type.value} className="flex items-center space-x-2">
                            <RadioGroupItem value={type.value} id={`emp-${type.value}`} />
                            <Label htmlFor={`emp-${type.value}`} className="font-normal cursor-pointer">
                              {type.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {errors.employmentType && (
                        <p className="text-sm text-destructive">{errors.employmentType}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          placeholder="Your city"
                          value={formData.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          className={errors.city ? "border-destructive" : ""}
                        />
                        {errors.city && (
                          <p className="text-sm text-destructive">{errors.city}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input
                          id="pincode"
                          placeholder="e.g., 110001"
                          value={formData.pincode}
                          onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                          maxLength={6}
                          className={errors.pincode ? "border-destructive" : ""}
                        />
                        {errors.pincode && (
                          <p className="text-sm text-destructive">{errors.pincode}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>CIBIL Score Range *</Label>
                      <Select value={formData.cibilScoreRange} onValueChange={(v) => updateField("cibilScoreRange", v)}>
                        <SelectTrigger className={errors.cibilScoreRange ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select your CIBIL score range" />
                        </SelectTrigger>
                        <SelectContent>
                          {cibilScoreRanges.map((range) => (
                            <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.cibilScoreRange && (
                        <p className="text-sm text-destructive">{errors.cibilScoreRange}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentMonthlyEmi">Current EMI (₹/mo)</Label>
                        <Input
                          id="currentMonthlyEmi"
                          type="text"
                          placeholder="e.g., 5000"
                          value={formData.currentMonthlyEmi}
                          onChange={(e) => updateField("currentMonthlyEmi", e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <div className="space-y-2 flex items-end pb-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="emiBounce"
                            checked={formData.emiBounce}
                            onCheckedChange={(checked) => updateField("emiBounce", checked as boolean)}
                          />
                          <Label htmlFor="emiBounce" className="text-sm font-normal cursor-pointer leading-tight">
                            EMI bounced in last 6 months?
                          </Label>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2 pt-2">
                      <Checkbox
                        id="agreeTerms"
                        checked={formData.agreeTerms}
                        onCheckedChange={(checked) => updateField("agreeTerms", checked as boolean)}
                      />
                      <Label htmlFor="agreeTerms" className="text-sm font-normal leading-tight cursor-pointer">
                        I agree to the{" "}
                        <a href="/terms-conditions" className="text-primary hover:underline" target="_blank">
                          Terms of Service
                        </a>{" "}
                        and{" "}
                        <a href="/privacy-policy" className="text-primary hover:underline" target="_blank">
                          Privacy Policy
                        </a>
                      </Label>
                    </div>
                    {errors.agreeTerms && (
                      <p className="text-sm text-destructive">{errors.agreeTerms}</p>
                    )}

                    {/* Fee Notice */}
                    <div className="bg-secondary/10 rounded-xl p-4 mt-2">
                      <p className="text-sm text-muted-foreground">
                        <strong className="text-foreground">Consulting Fee:</strong> <strong className="text-primary">₹799</strong> (incl. GST)
                        <br />
                        <span className="text-xs">Payable after form submission • 100% Refundable</span>
                      </p>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <Button 
                        variant="outline" 
                        size="lg"
                        onClick={() => setStep(1)}
                      >
                        Back
                      </Button>
                      <Button 
                        variant="hero" 
                        size="lg" 
                        className="flex-1"
                        onClick={handleEligibilityCheck}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Check Eligibility
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && preApproval && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-3"
                  >
                    {/* Compact Pre-Approval Banner */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                      <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-success">
                          <Sparkles className="w-3.5 h-3.5" /> Pre-Approved!
                        </div>
                        <p className="text-xs text-muted-foreground">Your eligibility looks great</p>
                      </div>
                    </div>

                    {/* Loan Summary - Compact Grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-border bg-muted/30">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Loan Amount</p>
                        <p className="text-sm font-bold">{formatCurrency(preApproval.loanAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Monthly EMI</p>
                        <p className="text-sm font-bold text-secondary">{formatCurrency(preApproval.emi)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Interest Rate</p>
                        <p className="text-sm font-bold">From {preApproval.interestRate}% p.a.</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Processing</p>
                        <p className="text-sm font-bold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-secondary" />
                          {preApproval.processingTimeLabel}
                        </p>
                      </div>
                    </div>

                    {/* Benefits - Highlighted */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: "🏦", text: "RBI Registered Banks" },
                        { icon: "👤", text: "Personal Manager" },
                        { icon: "📋", text: "Document Assistance" },
                        { icon: "⚡", text: "Fast Approval" },
                      ].map(b => (
                        <div key={b.text} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                          <span className="text-base">{b.icon}</span>
                          <span className="text-xs font-medium">{b.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* Fee + Pay Now */}
                    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground">One-time Consulting Fee</p>
                      <p className="text-xl font-bold text-primary">₹799 <span className="text-xs font-normal text-muted-foreground">(incl. GST)</span></p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setStep(2)} className="px-3">
                        Edit
                      </Button>
                      <Button
                        variant="hero"
                        size="lg"
                        className="flex-1"
                        onClick={createLeadAndGoToPayment}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Pay Now & Proceed
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ApplicationModal;
