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
import { trackLeadEvent } from "@/hooks/useAnalyticsTracker";
import { trackLead, setAdvancedMatchingData } from "@/components/MetaPixel";
import { createPhoneLead } from "@/lib/createPhoneLead";
import { getStoredUtmParams } from "@/hooks/useUtmParams";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";
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

// Finance company ID constant
const FINANCE_COMPANY_ID = "e6b82169-19d7-4e93-a0c0-304b89bcab71";
const FINANCE_PAYMENT_PATH = "/payment?company=finance&gateway=razorpay";

interface FinanceApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: {
    loanAmount?: number;
    interestRate?: number;
    tenure?: number;
    emi?: number;
  };
  initialPhone?: string;
}

const FinanceApplicationModal = ({ isOpen, onClose, prefillData, initialPhone }: FinanceApplicationModalProps) => {
  const navigate = useNavigate();
  const { company } = usePublicCompany();
  const companyId = company?.id || FINANCE_COMPANY_ID;
  const paymentPath = `/payment?company=${company?.slug || 'finance'}&gateway=razorpay`;
  
  const phoneRegex = /^[6-9]\d{9}$/;
  const validInitialPhone = phoneRegex.test(String(initialPhone ?? "").replace(/\D/g, "").slice(-10))
    ? String(initialPhone).replace(/\D/g, "").slice(-10)
    : null;
  
  const [step, setStep] = useState(() => validInitialPhone ? 1 : 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(() => !!validInitialPhone);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
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

  const handlePhoneEligibilityCheck = async (phoneOverride?: string) => {
    const phone = String(phoneOverride ?? phoneInput).replace(/\D/g, "").slice(-10);

    if (!phoneRegex.test(phone)) {
      setErrors({ phone: "Enter valid 10-digit mobile number starting with 6-9" });
      return;
    }
    
    setErrors({});
    setIsCheckingPhone(true);
    
    try {
      // Scope lead lookup to Finance company
      let leadQuery = supabase
        .from("leads")
        .select("*")
        .eq("phone", phone);
      const { data: existingLead } = await leadQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLead) {
        setExistingLeadId(existingLead.id);
        
        const isPlaceholderLead = existingLead.full_name === "Phone Lead" || 
          existingLead.email?.includes("@placeholder.hariox.com");
        
        if (isPlaceholderLead) {
          setFormData(prev => ({ ...prev, phone }));
          setIsReturningCustomer(false);
          setShowOtpStep(true);
          return;
        }
        
        setIsReturningCustomer(true);
        
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

        if (existingLead.status === "unpaid") {
          if (existingLead.loan_type && existingLead.loan_amount && existingLead.employment_type) {
            navigate(`${paymentPath}&leadId=${encodeURIComponent(existingLead.id)}`, {
              state: {
                leadId: existingLead.id,
                company: company?.slug || "finance",
                paymentSource: "direct",
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
            setPhoneVerified(true);
            setOtpVerified(true);
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
        setFormData(prev => ({ ...prev, phone }));
        setIsReturningCustomer(false);
        setShowOtpStep(true);
      }
    } catch (err) {
      console.error("Error checking lead:", err);
      setFormData(prev => ({ ...prev, phone }));
      setShowOtpStep(true);
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleOtpVerified = () => {
    const phoneToUse = String(formData.phone || phoneInput).replace(/\D/g, "").slice(-10);
    
    setOtpVerified(true);
    setPhoneVerified(true);
    setShowOtpStep(false);
    setStep(1);
    
    if (phoneToUse && /^[6-9]\d{9}$/.test(phoneToUse)) {
      (async () => {
        try {
          const createdLeadId = await createPhoneLead(phoneToUse, companyId, "finance-website-otp");
          if (createdLeadId) {
            setExistingLeadId(createdLeadId);
          }
        } catch (err) {
          console.error("Lead creation failed", err);
        }
      })();
    }
  };

  const handleOtpBack = () => {
    setShowOtpStep(false);
    setPhoneInput("");
    setFormData(prev => ({ ...prev, phone: "" }));
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      didAutoCheckRef.current = false;
      return;
    }

    const phone = String(initialPhone ?? "").replace(/\D/g, "").slice(-10);

    if (!phoneRegex.test(phone)) return;
    if (didAutoCheckRef.current) return;
    didAutoCheckRef.current = true;

    setPhoneInput(phone);
    setFormData((prev) => ({ ...prev, phone }));
    setPhoneVerified(true);
    setStep(1);
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
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      // Just compute pre-approval locally - defer API call to payment step
      const loanAmount = parseInt(formData.loanAmount || "0");
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
    }
  };

  const createLeadAndGoToPayment = async () => {
    if (!preApproval) return;
    setIsSubmitting(true);

    try {
      // Capture Meta fbc/fbp cookies for server-side CAPI attribution
      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
      };

      const { data, error } = await supabase.functions.invoke("upsert-lead", {
        body: {
          phone: formData.phone,
          full_name: formData.fullName,
          email: formData.email,
          city: formData.city,
          pincode: formData.pincode,
          state: formData.state,
          loan_type: formData.loanType,
          loan_amount: preApproval.loanAmount,
          monthly_income: parseInt(formData.monthlyIncome || "0"),
          employment_type: formData.employmentType,
          cibil_score_range: formData.cibilScoreRange,
          current_monthly_emi: parseInt(formData.currentMonthlyEmi || "0") || null,
          emi_bounce_last_6_months: formData.emiBounce,
          source: "finance",
          company_id: companyId,
          ...getStoredUtmParams(),
          interest_rate: preApproval.interestRate,
          tenure_months: preApproval.tenureMonths,
          emi_amount: preApproval.emi,
          meta_fbc: getCookie('_fbc'),
          meta_fbp: getCookie('_fbp'),
        },
      });

      if (error) throw error;

      const leadId = data?.lead_id || data?.leadId || existingLeadId;

      if (leadId) {
        trackLeadEvent("lead_submitted", {
          leadId,
          loanType: formData.loanType,
          loanAmount: preApproval.loanAmount,
          source: "finance",
        });

        // Store user data for Meta Advanced Matching (improves Ads Manager attribution)
        setAdvancedMatchingData(formData.email, formData.phone);

        // Fire Meta Pixel Lead event (single event, deduplicated by leadId)
        trackLead({ content_name: formData.loanType, value: preApproval.loanAmount }, leadId);
      }

      navigate(`${paymentPath}&leadId=${encodeURIComponent(leadId)}`, {
        state: {
          leadId,
          company: company?.slug || "finance",
          paymentSource: "direct",
          loanAmount: preApproval.loanAmount,
          leadDetails: {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone,
          },
        },
      });
      onClose();
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // handleProceedToPayment is now replaced by createLeadAndGoToPayment above

  const handleClose = () => {
    setStep(validInitialPhone ? 1 : 0);
    setPhoneVerified(!!validInitialPhone);
    setOtpVerified(false);
    setShowOtpStep(false);
    setIsReturningCustomer(false);
    setExistingLeadId(null);
    setPreApproval(null);
    setPhoneInput(validInitialPhone ?? "");
    setFormData({
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
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  // OTP Step
  if (showOtpStep) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border"
        >
          <div className="bg-primary p-6 text-primary-foreground">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Verify Your Number</h2>
              <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <OTPVerificationStep
              phone={formData.phone || phoneInput}
              onVerified={handleOtpVerified}
              onBack={handleOtpBack}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-border"
        >
          {/* Header */}
          <div className="bg-primary p-6 text-primary-foreground">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {phoneVerified && (
                  <div className="flex items-center gap-1.5 text-sm bg-white/20 px-3 py-1 rounded-full">
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </div>
                )}
              </div>
              <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-xl font-bold">
              {step === 0 && "Check Your Eligibility"}
              {step === 1 && "Personal Details"}
              {step === 2 && "Loan Requirements"}
              {step === 3 && "Pre-Approved!"}
            </h2>
            <div className="flex gap-2 mt-4">
              {[0, 1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    s <= step ? "bg-white" : "bg-white/30"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Step 0: Phone Check */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium text-foreground mb-2 block">Mobile Number</Label>
                  <Input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(-10))}
                    className="h-14 text-lg"
                    maxLength={10}
                  />
                  {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
                </div>
                <Button
                  onClick={() => handlePhoneEligibilityCheck()}
                  disabled={isCheckingPhone || phoneInput.length !== 10}
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg"
                >
                  {isCheckingPhone ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      Check Eligibility
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Step 1: Personal Details */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1 block">Full Name</Label>
                  <Input
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className="h-12"
                  />
                  {errors.fullName && <p className="text-destructive text-sm mt-1">{errors.fullName}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1 block">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="h-12"
                  />
                  {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
                </div>
                <Button
                  onClick={handleNext}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  Continue
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2: Loan Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">Loan Type</Label>
                    <Select value={formData.loanType} onValueChange={(v) => updateField("loanType", v)}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {loanTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.loanType && <p className="text-destructive text-xs mt-1">{errors.loanType}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">Loan Amount (₹)</Label>
                    <Input
                      type="number"
                      placeholder="500000"
                      value={formData.loanAmount}
                      onChange={(e) => updateField("loanAmount", e.target.value)}
                      className="h-12"
                    />
                    {errors.loanAmount && <p className="text-destructive text-xs mt-1">{errors.loanAmount}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">Employment Type</Label>
                    <Select value={formData.employmentType} onValueChange={(v) => updateField("employmentType", v)}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {employmentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.employmentType && <p className="text-destructive text-xs mt-1">{errors.employmentType}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">Monthly Income (₹)</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={formData.monthlyIncome}
                      onChange={(e) => updateField("monthlyIncome", e.target.value)}
                      className="h-12"
                    />
                    {errors.monthlyIncome && <p className="text-destructive text-xs mt-1">{errors.monthlyIncome}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">City</Label>
                    <Input
                      placeholder="Your city"
                      value={formData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      className="h-12"
                    />
                    {errors.city && <p className="text-destructive text-xs mt-1">{errors.city}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">Pincode</Label>
                    <Input
                      placeholder="400001"
                      value={formData.pincode}
                      onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-12"
                      maxLength={6}
                    />
                    {errors.pincode && <p className="text-destructive text-xs mt-1">{errors.pincode}</p>}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground mb-1 block">State</Label>
                  <Select value={formData.state} onValueChange={(v) => updateField("state", v)}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select your state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {indianStates.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && <p className="text-destructive text-xs mt-1">{errors.state}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">CIBIL Score Range</Label>
                    <Select value={formData.cibilScoreRange} onValueChange={(v) => updateField("cibilScoreRange", v)}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {cibilScoreRanges.map((range) => (
                          <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.cibilScoreRange && <p className="text-destructive text-xs mt-1">{errors.cibilScoreRange}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1 block">Current EMIs (₹/month)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.currentMonthlyEmi}
                      onChange={(e) => updateField("currentMonthlyEmi", e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Checkbox
                    id="emiBounce"
                    checked={formData.emiBounce}
                    onCheckedChange={(checked) => updateField("emiBounce", !!checked)}
                  />
                  <Label htmlFor="emiBounce" className="text-sm text-muted-foreground cursor-pointer">
                    Any EMI bounce in last 6 months?
                  </Label>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Checkbox
                    id="agreeTerms"
                    checked={formData.agreeTerms}
                    onCheckedChange={(checked) => updateField("agreeTerms", !!checked)}
                  />
                  <Label htmlFor="agreeTerms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <a href="/terms-conditions" className="text-primary hover:underline">Terms</a>
                    {" "}and{" "}
                    <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>
                  </Label>
                </div>
                {errors.agreeTerms && <p className="text-destructive text-sm">{errors.agreeTerms}</p>}

                <Button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Submit Application
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Step 3: Pre-Approval */}
            {step === 3 && preApproval && (
              <div className="space-y-3">
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
                    <p className="text-sm font-bold text-primary">{formatCurrency(preApproval.emi)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Interest Rate</p>
                    <p className="text-sm font-bold">From {preApproval.interestRate}% p.a.</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Processing</p>
                    <p className="text-sm font-bold inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary" />
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
                    onClick={createLeadAndGoToPayment}
                    disabled={isSubmitting}
                    className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Pay Now & Proceed
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FinanceApplicationModal;