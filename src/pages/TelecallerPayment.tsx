import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowRight, Loader2, Shield, CheckCircle, Clock, Sparkles, BadgeCheck, Banknote, Users, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/hooks/useEMICalculator";
import financeLogo from "@/assets/finance-logo.png";

interface LeadDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  loan_amount: number;
  loan_type: string;
  emi_amount: number | null;
  status: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  phone: string | null;
  whatsapp_number: string | null;
}

const benefits = [
  { icon: Clock, title: "24hr Disbursal", desc: "Quick processing" },
  { icon: BadgeCheck, title: "100% Secure", desc: "Bank-grade security" },
  { icon: Banknote, title: "Low Interest", desc: "Best rates guaranteed" },
  { icon: Users, title: "50K+ Happy Customers", desc: "Trusted by many" },
];

const TelecallerPayment = () => {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "details" | "payment" | "notfound">("phone");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  
  // Form fields for incomplete leads
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formLoanAmount, setFormLoanAmount] = useState("");
  const [formLoanType, setFormLoanType] = useState("personal");
  const [isUpdating, setIsUpdating] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(true);

  // Detect route type based on pathname
  // /marketing = marketing campaigns (SMS bulk)
  // /whatsapp = WhatsApp marketing campaigns
  // /telecaller = telecaller payment collection
  // /pay/:slug = legacy/generic route
  const isMarketingRoute = location.pathname === "/marketing";
  const isWhatsAppRoute = location.pathname === "/whatsapp";
  const isTelecallerRoute = location.pathname === "/telecaller";

  // Special slug mapping for short marketing URLs (legacy support)
  // /pay/m or /pay/marketing -> maps to hariox company with marketing source
  const isMarketingSlug = rawSlug === "m" || rawSlug === "marketing";
  const isWhatsAppSlug = rawSlug === "w" || rawSlug === "whatsapp";
  
  // Determine the company slug
  // For /marketing, /whatsapp, and /telecaller routes, default to "hariox"
  // For /pay/:slug, use the slug from URL
  const slug = (isMarketingRoute || isWhatsAppRoute || isTelecallerRoute) ? "hariox" : 
               (isMarketingSlug || isWhatsAppSlug) ? "hariox" : rawSlug;

  // Determine payment source from route or URL parameter
  // /marketing route = SMS marketing campaigns
  // /whatsapp route = WhatsApp marketing campaigns
  // /telecaller route = telecaller collected
  // /pay/w or /pay/whatsapp = WhatsApp campaigns (short URL)
  // ?source=whatsapp = WhatsApp campaigns
  // ?source=marketing = SMS marketing campaigns
  // ?source=direct = main website direct link
  // no source = telecaller collected
  const sourceParam = searchParams.get("source");
  const paymentSource = isWhatsAppRoute ? "whatsapp" :
                        isMarketingRoute ? "marketing" :
                        isTelecallerRoute ? "telecaller" :
                        isWhatsAppSlug ? "whatsapp" :
                        isMarketingSlug ? "marketing" :
                        sourceParam === "whatsapp" ? "whatsapp" :
                        sourceParam === "marketing" ? "marketing" : 
                        sourceParam === "direct" ? "direct" : "telecaller";

  // Fetch company by slug
  useEffect(() => {
    const fetchCompany = async () => {
      if (!slug) {
        setCompanyLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("slug", slug)
          .eq("is_active", true)
          .single();

        if (error || !data) {
          console.error("Company not found:", error);
        } else {
          setCompany(data as Company);
          localStorage.setItem("publicCompanyId", data.id);
          localStorage.setItem("publicCompanySlug", data.slug);
        }
      } catch (err) {
        console.error("Error fetching company:", err);
      } finally {
        setCompanyLoading(false);
      }
    };

    fetchCompany();
  }, [slug]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setIsLoading(true);

    try {
      let foundLead = null;

      if (company?.id) {
        const { data: allLeads, error: fetchError } = await supabase
          .rpc("lookup_leads_by_phone", { _phone: phone });

        if (!fetchError && allLeads && allLeads.length > 0) {
          // Find lead matching company
          foundLead = allLeads.find((l: any) => l.company_id === company.id) || null;
          // Fallback: find lead with no company
          if (!foundLead) {
            foundLead = allLeads.find((l: any) => !l.company_id) || null;
          }
        }
      } else {
        const { data: allLeads, error: allError } = await supabase
          .rpc("lookup_leads_by_phone", { _phone: phone });

        if (!allError && allLeads && allLeads.length > 0) {
          foundLead = allLeads[0];
        }
      }

      if (foundLead) {
        setLead({
          id: foundLead.id,
          full_name: foundLead.full_name,
          email: foundLead.email,
          phone: foundLead.phone,
          loan_amount: foundLead.loan_amount,
          loan_type: foundLead.loan_type,
          emi_amount: foundLead.emi_amount,
          status: foundLead.status,
        });
        
        // Check if lead has incomplete details (no name or no loan amount)
        const isIncomplete = !foundLead.full_name || !foundLead.full_name.trim() || !foundLead.loan_amount;
        
        if (isIncomplete) {
          // Pre-fill form with existing data
          setFormName(foundLead.full_name || "");
          setFormEmail(foundLead.email || "");
          setFormCity(foundLead.city || "");
          setFormLoanAmount(foundLead.loan_amount ? String(foundLead.loan_amount) : "");
          setFormLoanType(foundLead.loan_type || "personal");
          setStep("details");
        } else {
          setStep("payment");
        }
      } else {
        setStep("notfound");
      }
    } catch (err) {
      console.error("Error searching lead:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToPayment = () => {
    if (!lead) return;
    
    // Determine company query param for payment routing
    // Capital Hariox uses Paytm, Finance Hariox uses PhonePe, others use Razorpay
    // For finance.hariox.com domain, PhonePe is detected via hostname in PaymentPage
    const companyParam = "";
    
    navigate(`/payment${companyParam}`, {
      state: {
        leadId: lead.id,
        loanAmount: lead.loan_amount,
        leadDetails: {
          fullName: lead.full_name,
          email: lead.email,
          phone: lead.phone,
        },
        paymentSource: paymentSource,
      },
    });
  };

  const handleApplyNow = () => {
    navigate("/?apply=true");
  };

  // Handle details form submission for incomplete leads
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!formName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (!formCity.trim()) {
      setError("Please enter your city");
      return;
    }
    if (!formLoanAmount || Number(formLoanAmount) < 50000) {
      setError("Please enter loan amount (min ₹50,000)");
      return;
    }
    
    setIsUpdating(true);
    
    try {
      // Use upsert-lead edge function (bypasses RLS for public users)
      const { data: upsertResult, error: upsertError } = await supabase.functions.invoke("upsert-lead", {
        body: {
          phone: lead?.phone,
          full_name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          city: formCity.trim(),
          loan_amount: Number(formLoanAmount),
          loan_type: formLoanType,
          employment_type: "salaried",
          monthly_income: Number(formLoanAmount) > 0 ? 25000 : 0,
          company_id: company?.id || null,
          source: paymentSource === "telecaller" ? "telecaller" : paymentSource === "whatsapp" ? "whatsapp" : paymentSource === "marketing" ? "sms" : "website",
        },
      });
      
      if (upsertError) throw upsertError;
      if (upsertResult?.error) throw new Error(upsertResult.error);
      
      // Update local lead state
      setLead(prev => prev ? {
        ...prev,
        full_name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        loan_amount: Number(formLoanAmount),
        loan_type: formLoanType as LeadDetails["loan_type"],
      } : null);
      
      setStep("payment");
    } catch (err) {
      console.error("Error updating lead:", err);
      setError("Failed to save details. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getLoanTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      home: "Home Loan",
      business: "Business Loan",
      personal: "Personal Loan",
      education: "Education Loan",
      vehicle: "Vehicle Loan",
      gold: "Gold Loan",
      marriage: "Marriage Loan",
    };
    return labels[type] || type;
  };

  if (companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header - Matching main website */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Clickable to main website */}
            <Link to="/" className="flex items-center gap-3">
              <img 
                src={company?.logo_url || financeLogo} 
                alt={company?.name || "Credit Hariox"} 
                className="h-12 w-auto"
              />
            </Link>
            
            {/* Phone number */}
            <a 
              href={`tel:${company?.phone || "+919422799318"}`}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">{company?.phone || "+91 9422799318"}</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Hero Section */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Quick Payment Portal
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete your loan application in just 2 minutes
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-3 text-center"
            >
              <benefit.icon className="w-6 h-6 text-primary mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-foreground">{benefit.title}</p>
              <p className="text-[10px] text-muted-foreground">{benefit.desc}</p>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Phone Input Step */}
          {step === "phone" && (
            <motion.div
              key="phone-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-0 shadow-xl bg-card/90 backdrop-blur-sm overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <Phone className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold text-primary-foreground">
                    Enter Your Mobile Number
                  </h2>
                  <p className="text-xs text-primary-foreground/80 mt-1">
                    We'll fetch your application details
                  </p>
                </div>
                <CardContent className="p-5">
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">Mobile Number</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-input bg-muted text-muted-foreground text-sm font-medium">
                          +91
                        </span>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Enter 10-digit number"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                            setError("");
                          }}
                          className="rounded-l-none text-lg h-12"
                          autoFocus
                        />
                      </div>
                      {error && (
                        <p className="text-sm text-destructive">{error}</p>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      disabled={isLoading || phone.length !== 10}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Searching...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Details Step - Incomplete Lead */}
          {step === "details" && lead && (
            <motion.div
              key="details-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-0 shadow-xl bg-card/90 backdrop-blur-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Complete Your Details
                  </h2>
                  <p className="text-xs text-white/80 mt-1">
                    Please provide your information to proceed
                  </p>
                </div>
                <CardContent className="p-5">
                  <form onSubmit={handleDetailsSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium">Full Name *</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-medium">City *</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Enter your city"
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="loanType" className="text-sm font-medium">Loan Type</Label>
                        <select
                          id="loanType"
                          value={formLoanType}
                          onChange={(e) => setFormLoanType(e.target.value)}
                          className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="personal">Personal Loan</option>
                          <option value="business">Business Loan</option>
                          <option value="home">Home Loan</option>
                          <option value="vehicle">Vehicle Loan</option>
                          <option value="education">Education Loan</option>
                          <option value="gold">Gold Loan</option>
                          <option value="marriage">Marriage Loan</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="loanAmount" className="text-sm font-medium">Loan Amount *</Label>
                        <Input
                          id="loanAmount"
                          type="number"
                          placeholder="500000"
                          value={formLoanAmount}
                          onChange={(e) => setFormLoanAmount(e.target.value)}
                          className="h-11"
                          min="50000"
                        />
                      </div>
                    </div>
                    
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button 
                      type="submit" 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Continue to Payment
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Payment Step - Lead Found */}
          {step === "payment" && lead && (
            <motion.div
              key="payment-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-0 shadow-xl bg-card/90 backdrop-blur-sm overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-5 text-center">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Welcome Back, {lead.full_name.split(" ")[0]}!
                  </h2>
                  <p className="text-white/80 text-sm mt-1">
                    Your application is ready for processing
                  </p>
                </div>

                <CardContent className="p-5">
                  {/* Application Summary */}
                  <div className="bg-muted/50 rounded-xl p-4 space-y-3 mb-5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Loan Type</span>
                      <span className="font-medium">{getLoanTypeLabel(lead.loan_type)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Loan Amount</span>
                      <span className="font-bold text-lg text-primary">{formatCurrency(lead.loan_amount)}</span>
                    </div>
                    {lead.emi_amount && (
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-muted-foreground text-sm">Est. EMI</span>
                        <span className="font-medium text-secondary">{formatCurrency(lead.emi_amount)}/mo</span>
                      </div>
                    )}
                  </div>

                  {["paid", "verification", "documents_pending", "documents_uploaded", "verified", "processing", "approved", "disbursed"].includes(lead.status) ? (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-lg">Payment Already Received!</h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        Your application is being processed. Our team will contact you shortly.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-4 p-4 bg-secondary/10 rounded-xl border border-secondary/20">
                        <p className="text-sm text-muted-foreground">Registration Fee</p>
                        <p className="text-3xl font-bold text-secondary mt-1">₹799</p>
                        <p className="text-xs text-muted-foreground">(Inclusive of 18% GST)</p>
                      </div>

                      <Button 
                        variant="hero" 
                        size="lg" 
                        className="w-full"
                        onClick={handleProceedToPayment}
                      >
                        Pay Now & Complete Application
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>

                      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-green-500" />
                          <span>SSL Secured</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                          <span>RBI Registered</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Not Found Step */}
          {step === "notfound" && (
            <motion.div
              key="notfound-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-0 shadow-xl bg-card/90 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-orange-500" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">No Application Found</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    We couldn't find an application with this mobile number. Would you like to apply now?
                  </p>

                  <div className="space-y-3">
                    <Button 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      onClick={handleApplyNow}
                    >
                      Apply for Loan
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="w-full"
                      onClick={() => {
                        setStep("phone");
                        setPhone("");
                      }}
                    >
                      Try Different Number
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Support Section */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 bg-card/60 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2">
            <HeadphonesIcon className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Need help?</span>
            {company?.phone && (
              <a href={`tel:${company.phone}`} className="text-sm font-medium text-primary hover:underline">
                {company.phone}
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {company?.name || "Credit Hariox"}. All rights reserved.</p>
          <p className="mt-1">Powered by secure payment gateway</p>
        </div>
      </div>
    </div>
  );
};

export default TelecallerPayment;
