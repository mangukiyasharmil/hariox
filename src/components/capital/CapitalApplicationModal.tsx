import { useMemo, useState, useLayoutEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Loader2, CheckCircle, Sparkles, Clock, User, FileText, CreditCard, Shield } from "lucide-react";
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
import { trackGALead } from "@/components/GoogleAnalytics";
import { getStoredUtmParams } from "@/hooks/useUtmParams";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  processingTimeLabel: string;
};

const loanTypes = [
  { value: "marriage", label: "Marriage Loan", icon: "💍" },
  { value: "business", label: "Business Loan", icon: "💼" },
  { value: "personal", label: "Personal Loan", icon: "👤" },
  { value: "education", label: "Education Loan", icon: "🎓" },
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
  { value: "salaried", label: "Salaried", icon: "💼" },
  { value: "self_employed", label: "Self-Employed", icon: "🏠" },
  { value: "business_owner", label: "Business Owner", icon: "🏢" },
];

const cibilScoreRanges = [
  { value: "300-500", label: "300-500", color: "text-red-500" },
  { value: "500-650", label: "500-650", color: "text-orange-500" },
  { value: "650-750", label: "650-750", color: "text-yellow-500" },
  { value: "750-900", label: "750-900", color: "text-emerald-500" },
];

interface CapitalApplicationModalProps {
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

const CapitalApplicationModal = ({ isOpen, onClose, prefillData, initialPhone }: CapitalApplicationModalProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check if we have a valid initial phone - but don't auto-skip to step 1
  // Let the eligibility check determine if they're returning (skip OTP) or new (require OTP)
  const phoneRegex = /^[6-9]\d{9}$/;
  const validInitialPhone = phoneRegex.test(String(initialPhone ?? "").replace(/\D/g, "").slice(-10))
    ? String(initialPhone).replace(/\D/g, "").slice(-10)
    : null;
  
  const [step, setStep] = useState(0); // Always start at step 0, let eligibility check determine flow
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(() => !!validInitialPhone); // Start checking if phone provided
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false); // OTP verified state
  const [showOtpStep, setShowOtpStep] = useState(false); // Show OTP step for new customers
  const [isReturningCustomer, setIsReturningCustomer] = useState(false); // Track returning customers
  const [existingLeadId, setExistingLeadId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [preApproval, setPreApproval] = useState<PreApprovalSnapshot | null>(null);
  const [phoneInput, setPhoneInput] = useState(() => validInitialPhone ?? "");
  const didAutoCheckRef = useRef(false);
  
  const companyParam = '';
  
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

  // Remove auto-check since we handle it manually in handlePhoneEligibilityCheck

  // Phone eligibility check handler (Step 0)
  const handlePhoneEligibilityCheck = async (phoneOverride?: string) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    const phone = String(phoneOverride ?? phoneInput)
      .replace(/\D/g, "")
      .slice(-10);

    if (!phoneRegex.test(phone)) {
      setErrors({ phone: "Enter valid 10-digit mobile number starting with 6-9" });
      return;
    }
    
    setErrors({});
    setIsCheckingPhone(true);
    
    try {
      // Check for existing lead scoped to company
      const companyId = await resolveCompanyIdForPublicLead();
      let leadQuery = supabase
        .from("leads")
        .select("*")
        .eq("phone", phone);
      if (companyId) leadQuery = leadQuery.eq("company_id", companyId);
      const { data: existingLead } = await leadQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLead) {
        setExistingLeadId(existingLead.id);
        
        // Check if this is a "Phone Lead" placeholder - treat as new customer needing OTP
        const isPlaceholderLead = existingLead.full_name === "Phone Lead" || 
          existingLead.email?.includes("@placeholder.hariox.com");
        
        if (isPlaceholderLead) {
          // This is a minimal phone lead - customer needs to fill details
          // Require OTP verification for security
          setFormData(prev => ({ ...prev, phone }));
          setIsReturningCustomer(false);
          setShowOtpStep(true);
          return;
        }
        
        setIsReturningCustomer(true); // Mark as returning customer - skip OTP
        
        // Pre-fill form with existing data (only for real leads, not placeholders)
        setFormData(prev => ({
          ...prev,
          fullName: existingLead.full_name || "",
          email: existingLead.email || "",
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

        // Determine which step to navigate to
        if (existingLead.status === "unpaid") {
          if (existingLead.loan_type && existingLead.loan_amount && existingLead.employment_type) {
            // Has all details, go to payment
            navigate(`/payment${companyParam}`, {
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
            // Returning customer - skip OTP, go directly to Step 1
            setPhoneVerified(true);
            setOtpVerified(true); // Auto-verify for returning customers
            setStep(1);
          }
        } else {
          // Already paid/processing/verified/disbursed → bypass OTP and redirect to customer portal
          sessionStorage.setItem("customerPhone", existingLead.phone);
          sessionStorage.setItem("customerLeadId", existingLead.id);
          sessionStorage.setItem("customerSessionAt", Date.now().toString());

          navigate("/my-account", {
            state: {
              leadId: existingLead.id,
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
        // NEW customer - require OTP verification
        setFormData(prev => ({ ...prev, phone }));
        setIsReturningCustomer(false);
        setShowOtpStep(true); // Show OTP step
      }
    } catch (err) {
      console.error("Error checking lead:", err);
      // On error, still require OTP for safety
      setFormData(prev => ({ ...prev, phone }));
      setShowOtpStep(true);
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // Handler when OTP is verified for new customers
  const handleOtpVerified = () => {
    // Capture phone value immediately (before any async operations)
    const phoneToUse = String(formData.phone || phoneInput).replace(/\D/g, "").slice(-10);
    console.log("handleOtpVerified: OTP verified, phone:", phoneToUse);
    
    setOtpVerified(true);
    setPhoneVerified(true);
    setShowOtpStep(false);
    setStep(1);
    
    // Create minimal lead immediately after OTP verification
    if (phoneToUse && /^[6-9]\d{9}$/.test(phoneToUse)) {
      // Fire and forget - don't block UI
      (async () => {
        try {
          const companyId = await resolveCompanyIdForPublicLead();
          console.log("handleOtpVerified: Creating lead with companyId:", companyId);
          const createdLeadId = await createPhoneLead(phoneToUse, companyId, "website-capital-otp");
          console.log("handleOtpVerified: Lead creation result:", createdLeadId);
          if (createdLeadId) {
            setExistingLeadId(createdLeadId);
          }
        } catch (err) {
          console.error("handleOtpVerified: Lead creation failed", err);
        }
      })();
    } else {
      console.error("handleOtpVerified: Invalid phone", phoneToUse);
    }
  };

  // Handler to go back from OTP step
  const handleOtpBack = () => {
    setShowOtpStep(false);
    setPhoneInput("");
    setFormData(prev => ({ ...prev, phone: "" }));
  };

  // If phone is collected outside (e.g. hero), auto-run eligibility check once on open
  useLayoutEffect(() => {
    if (!isOpen) {
      didAutoCheckRef.current = false;
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    const phone = String(initialPhone ?? "")
      .replace(/\D/g, "")
      .slice(-10);

    if (!phoneRegex.test(phone)) return;
    if (didAutoCheckRef.current) return;
    didAutoCheckRef.current = true;

    setPhoneInput(phone);
    setFormData((prev) => ({ ...prev, phone }));
    // Don't auto-set phoneVerified or step - let handlePhoneEligibilityCheck determine the flow
    // For new customers: will show OTP step
    // For returning customers: will skip OTP and go to appropriate step
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

  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const stepsTotal = 4;
  const stepMeta = useMemo(() => {
    const labels = ["Check Eligibility", "Personal Details", "Loan & Credit Info", "Pre-Approved"];
    const icons = [Shield, User, FileText, CheckCircle];
    const progress = step === 0 ? 5 : step === 1 ? 25 : step === 2 ? 50 : 75;
    return { label: labels[step], icon: icons[step], progress };
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

  // Cache company ID in module-level variable to avoid repeated DB calls
  const resolveCompanyIdForPublicLead = async (): Promise<string | null> => {
    const fromStorage = getCurrentCompanyId();
    if (fromStorage) return fromStorage;

    // Hard-coded Capital Hariox ID from memory for instant resolution
    const CAPITAL_ID = "d0eb940b-0000-0000-0000-000000000000";
    
    // Try to find capital company
    const { data: capitalCompany } = await supabase
      .from("companies")
      .select("id, slug")
      .eq("slug", "capital")
      .eq("is_active", true)
      .maybeSingle();

    if (capitalCompany?.id) {
      localStorage.setItem("publicCompanyId", capitalCompany.id);
      localStorage.setItem("publicCompanySlug", capitalCompany.slug);
      return capitalCompany.id;
    }

    // Fallback
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
      const employmentTypeMap: Record<string, string> = {
        salaried: "salaried",
        self_employed: "self_employed",
        business_owner: "business_owner",
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
          source: "website-capital",
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

      trackLeadEvent(companyId, {
        loan_type: formData.loanType,
        loan_amount: preApproval.loanAmount,
        employment_type: formData.employmentType,
      });

      // Store user data for Meta Advanced Matching (improves Ads Manager attribution)
      setAdvancedMatchingData(formData.email, formData.phone);

      // Fire Meta Pixel Lead event (single event, deduplicated by leadId)
      trackLead({ content_name: formData.loanType, value: preApproval.loanAmount }, leadId);

      // Track lead for Google Analytics
      trackGALead({
        loan_type: formData.loanType,
        loan_amount: preApproval.loanAmount,
      });

      // Fire-and-forget pixel — no blocking delay

      navigate(`/payment${companyParam}`, {
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
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Emerald Gradient */}
            <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <stepMeta.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {step === 0 ? (showOtpStep ? "Verify Your Number" : "Check Your Eligibility") : "Capital Hariox"}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {step === 0 ? (showOtpStep ? "Enter the OTP sent to your mobile" : "Enter your mobile to get started") : `Step ${step} of ${stepsTotal} • ${stepMeta.label}`}
                  </p>
                </div>
              </div>

              {/* Step Indicators */}
              <div className="flex gap-2 mt-4">
                {[0, 1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full flex-1 transition-colors ${
                      s <= step ? "bg-white" : "bg-white/30"
                    }`}
                  />
                ))}
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
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-emerald-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Check Your Loan Eligibility</h3>
                      <p className="text-sm text-gray-500 mt-1">Enter your mobile number to get started</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phoneCheck" className="text-gray-700">Mobile Number *</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                          +91
                        </span>
                        <Input
                          id="phoneCheck"
                          type="tel"
                          placeholder="Enter 10-digit mobile number"
                          value={phoneInput}
                          onChange={(e) => {
                            setPhoneInput(e.target.value.replace(/\D/g, "").slice(-10));
                            if (errors.phone) setErrors({});
                          }}
                          className={`h-14 text-lg rounded-l-none rounded-r-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 ${errors.phone ? "border-red-500" : ""}`}
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-sm text-red-500">{errors.phone}</p>
                      )}
                    </div>

                    <Button 
                      className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold"
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
                    
                    <p className="text-xs text-center text-gray-400">
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

                {/* Step 1: Personal Details (Name & Email only) */}
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
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <div>
                              <p className="text-sm text-gray-500">Mobile Number</p>
                              <p className="text-lg font-semibold text-gray-900">+91 {formData.phone}</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                            Verified
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-gray-700">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={(e) => updateField("fullName", e.target.value)}
                        className={`h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 ${errors.fullName ? "border-red-500" : ""}`}
                      />
                      {errors.fullName && (
                        <p className="text-sm text-red-500">{errors.fullName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        className={`h-12 rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 ${errors.email ? "border-red-500" : ""}`}
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>

                    <Button 
                      className="w-full h-12 mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold"
                      onClick={handleNext}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </motion.div>
                )}

                {/* Step 2: Loan & Credit Details */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    {/* Loan Type */}
                    <div className="space-y-2">
                      <Label className="text-gray-700">Loan Type *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {loanTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => updateField("loanType", type.value)}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              formData.loanType === type.value
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-200 hover:border-emerald-300"
                            }`}
                          >
                            <span className="text-lg">{type.icon}</span>
                            <p className="text-sm font-medium mt-1">{type.label}</p>
                          </button>
                        ))}
                      </div>
                      {errors.loanType && (
                        <p className="text-sm text-red-500">{errors.loanType}</p>
                      )}
                    </div>

                    {/* Amount & Income */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="loanAmount" className="text-gray-700">Loan Amount (₹) *</Label>
                        <Input
                          id="loanAmount"
                          placeholder="e.g., 500000"
                          value={formData.loanAmount}
                          onChange={(e) => updateField("loanAmount", e.target.value.replace(/\D/g, ""))}
                          className={`h-11 rounded-xl border-gray-200 ${errors.loanAmount ? "border-red-500" : ""}`}
                        />
                        {errors.loanAmount && (
                          <p className="text-xs text-red-500">{errors.loanAmount}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monthlyIncome" className="text-gray-700">Monthly Income (₹) *</Label>
                        <Input
                          id="monthlyIncome"
                          placeholder="e.g., 50000"
                          value={formData.monthlyIncome}
                          onChange={(e) => updateField("monthlyIncome", e.target.value.replace(/\D/g, ""))}
                          className={`h-11 rounded-xl border-gray-200 ${errors.monthlyIncome ? "border-red-500" : ""}`}
                        />
                        {errors.monthlyIncome && (
                          <p className="text-xs text-red-500">{errors.monthlyIncome}</p>
                        )}
                      </div>
                    </div>

                    {/* Employment Type */}
                    <div className="space-y-2">
                      <Label className="text-gray-700">Employment Type *</Label>
                      <div className="flex gap-2">
                        {employmentTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => updateField("employmentType", type.value)}
                            className={`flex-1 p-2.5 rounded-xl border-2 text-center text-sm transition-all ${
                              formData.employmentType === type.value
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-200 hover:border-emerald-300"
                            }`}
                          >
                            <span>{type.icon}</span>
                            <p className="text-xs font-medium mt-1">{type.label}</p>
                          </button>
                        ))}
                      </div>
                      {errors.employmentType && (
                        <p className="text-sm text-red-500">{errors.employmentType}</p>
                      )}
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-gray-700">City *</Label>
                        <Input
                          id="city"
                          placeholder="Your city"
                          value={formData.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          className={`h-11 rounded-xl border-gray-200 ${errors.city ? "border-red-500" : ""}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode" className="text-gray-700">Pincode *</Label>
                        <Input
                          id="pincode"
                          placeholder="6-digit"
                          value={formData.pincode}
                          onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className={`h-11 rounded-xl border-gray-200 ${errors.pincode ? "border-red-500" : ""}`}
                          maxLength={6}
                        />
                      </div>
                    </div>

                    {/* State */}
                    <div className="space-y-2">
                      <Label className="text-gray-700">State *</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) => updateField("state", value)}
                      >
                        <SelectTrigger className={`h-11 rounded-xl border-gray-200 ${errors.state ? "border-red-500" : ""}`}>
                          <SelectValue placeholder="Select your state" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianStates.map((state) => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Credit Info */}
                    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                      <p className="text-sm font-semibold text-gray-700">Credit Information</p>
                      
                      <div className="space-y-2">
                        <Label className="text-gray-600 text-sm">CIBIL Score Range *</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {cibilScoreRanges.map((range) => (
                            <button
                              key={range.value}
                              type="button"
                              onClick={() => updateField("cibilScoreRange", range.value)}
                              className={`p-2 rounded-lg border-2 text-center text-xs font-medium transition-all ${
                                formData.cibilScoreRange === range.value
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-gray-200 hover:border-emerald-300"
                              }`}
                            >
                              <span className={range.color}>{range.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currentMonthlyEmi" className="text-gray-600 text-sm">Current Monthly EMI (₹)</Label>
                        <Input
                          id="currentMonthlyEmi"
                          placeholder="0 if none"
                          value={formData.currentMonthlyEmi}
                          onChange={(e) => updateField("currentMonthlyEmi", e.target.value.replace(/\D/g, ""))}
                          className="h-10 rounded-lg border-gray-200"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="emiBounce"
                          checked={formData.emiBounce}
                          onCheckedChange={(checked) => updateField("emiBounce", checked as boolean)}
                        />
                        <Label htmlFor="emiBounce" className="text-sm text-gray-600 cursor-pointer">
                          Any EMI bounce in last 6 months?
                        </Label>
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="agreeTerms"
                        checked={formData.agreeTerms}
                        onCheckedChange={(checked) => updateField("agreeTerms", checked as boolean)}
                      />
                      <Label htmlFor="agreeTerms" className="text-sm text-gray-600 leading-tight cursor-pointer">
                        I agree to the{" "}
                        <a href="/terms-conditions" className="text-emerald-600 hover:underline" target="_blank">Terms</a>{" "}
                        and{" "}
                        <a href="/privacy-policy" className="text-emerald-600 hover:underline" target="_blank">Privacy Policy</a>
                      </Label>
                    </div>
                    {errors.agreeTerms && (
                      <p className="text-sm text-red-500">{errors.agreeTerms}</p>
                    )}

                    {/* Fee Notice */}
                    <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
                      <Shield className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Consulting Fee: ₹471</p>
                        <p className="text-xs text-gray-500">Includes GST • Payable after approval</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="h-11 rounded-xl border-gray-200"
                        onClick={() => setStep(1)}
                      >
                        Back
                      </Button>
                      <Button 
                        className="flex-1 h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold"
                        onClick={handleEligibilityCheck}
                        disabled={isSubmitting}
                      >
                        Check Eligibility
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Pre-Approved */}
                {step === 3 && preApproval && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-3"
                  >
                    {/* Compact Pre-Approval Banner */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                          <Sparkles className="w-3.5 h-3.5" /> Pre-Approved!
                        </div>
                        <p className="text-xs text-gray-500">Your eligibility looks great</p>
                      </div>
                    </div>

                    {/* Loan Summary - Compact Grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                      <div>
                        <p className="text-[11px] text-gray-500">Loan Amount</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(preApproval.loanAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">Monthly EMI</p>
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(preApproval.emi)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">Interest Rate</p>
                        <p className="text-sm font-bold text-gray-900">From {preApproval.interestRate}% p.a.</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">Processing</p>
                        <p className="text-sm font-bold text-gray-900 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          {preApproval.processingTimeLabel}
                        </p>
                      </div>
                    </div>

                    {/* Benefits Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: "🏦", text: "RBI Registered Banks" },
                        { icon: "👤", text: "Personal Manager" },
                        { icon: "📋", text: "Document Assistance" },
                        { icon: "⚡", text: "Fast Approval" },
                      ].map(b => (
                        <div key={b.text} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                          <span className="text-base">{b.icon}</span>
                          <span className="text-xs font-medium text-gray-700">{b.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* Fee Highlight */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 text-center border border-emerald-200">
                      <p className="text-xs text-gray-500">One-time Consulting Fee</p>
                      <p className="text-xl font-bold text-emerald-600">₹471 <span className="text-xs font-normal text-gray-500">(₹399 + GST)</span></p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="h-11 rounded-xl border-gray-200 px-3"
                        onClick={() => setStep(2)}
                      >
                        Edit
                      </Button>
                      <Button
                        className="flex-1 h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold"
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

export default CapitalApplicationModal;