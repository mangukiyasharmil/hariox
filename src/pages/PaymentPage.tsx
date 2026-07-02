import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Shield, CreditCard, Loader2, AlertCircle, 
  RefreshCw, CheckCircle, Sparkles, Clock, BadgeCheck,
  FileCheck, Percent, Users, Banknote, Award, ExternalLink,
  Building2, Timer, HeadphonesIcon, IndianRupee, TrendingDown, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import financeLogo from "@/assets/finance-logo.png";
import capitalLogo from "@/assets/hariox-logo-full.png";
import MetaPixel, { trackPurchase, getPixelIdForCompany, setRuntimePixelId, registerCompanyPixel } from "@/components/MetaPixel";
import { trackGAPurchase } from "@/components/GoogleAnalytics";
import LiveCustomerCounter from "@/components/landing/LiveCustomerCounter";

// Detect in-app browsers (Facebook, Instagram, WhatsApp, etc.)
const isInAppBrowser = (): boolean => {
  const ua = navigator.userAgent || navigator.vendor || '';
  return /FBAN|FBAV|Instagram|WhatsApp|Line|Snapchat|Twitter|LinkedIn/i.test(ua);
};

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: () => void) => void;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Individual benefit cards with accent colors — big boxes
const benefits = [
  { icon: FileCheck, title: "Free KYC", desc: "Document check at ₹0", accent: "from-blue-500/20 to-blue-400/5 border-blue-300/60", iconBg: "bg-blue-500/20", iconColor: "text-blue-600" },
  { icon: Percent, title: "Best Rates", desc: "Lowest interest guaranteed", accent: "from-amber-500/20 to-amber-400/5 border-amber-300/60", iconBg: "bg-amber-500/20", iconColor: "text-amber-600" },
  { icon: Building2, title: "30+ Banks", desc: "Max approval chances", accent: "from-emerald-500/20 to-emerald-400/5 border-emerald-300/60", iconBg: "bg-emerald-500/20", iconColor: "text-emerald-600" },
  { icon: Zap, title: "24hr Speed", desc: "Fast-track disbursal", accent: "from-violet-500/20 to-violet-400/5 border-violet-300/60", iconBg: "bg-violet-500/20", iconColor: "text-violet-600" },
  { icon: HeadphonesIcon, title: "Advisor", desc: "Dedicated loan manager", accent: "from-rose-500/20 to-rose-400/5 border-rose-300/60", iconBg: "bg-rose-500/20", iconColor: "text-rose-600" },
  { icon: TrendingDown, title: "Low EMI", desc: "Reduced monthly payments", accent: "from-teal-500/20 to-teal-400/5 border-teal-300/60", iconBg: "bg-teal-500/20", iconColor: "text-teal-600" },
];

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    amount: number;
    keyId: string;
    leadDetails: { name: string; email: string; phone: string };
    breakdown: { consultingFee: number; gstPercentage: number; gstAmount: number; totalAmount: number };
  } | null>(null);

  const urlLeadId = searchParams.get("leadId") || searchParams.get("lead_id");
  const requestedGateway = searchParams.get("gateway");

  const [company, setCompany] = useState<any>(null);
  const [companyPixelId, setCompanyPixelId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        let slug = searchParams.get('company') || '';
        if (!slug) {
          const hostname = window.location.hostname.toLowerCase();
          if (hostname.includes('fundkredit')) {
            slug = 'finance-fundkredit';
          } else if (hostname.includes('capital.hariox') || hostname.includes('capital-hariox')) {
            slug = 'capital';
          } else if (hostname.includes('credit.hariox') || hostname.includes('credit-hariox')) {
            slug = 'hariox';
          } else if (hostname.includes('finance.hariox') || hostname.includes('finance-hariox')) {
            slug = 'finance';
          } else {
            const parts = hostname.split('.');
            if (parts.length >= 2) {
              const subdomain = parts[0];
              if (subdomain === 'capital') slug = 'capital';
              else if (subdomain === 'finance') slug = 'finance';
              else if (subdomain === 'credit' || subdomain === 'hariox') slug = 'hariox';
            }
          }
        }
        if (!slug) slug = 'hariox';

        const { data } = await supabase
          .from('companies')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (data) {
          setCompany(data);
          setCompanyPixelId(data.meta_pixel_id);
          setRuntimePixelId(data.meta_pixel_id);
          registerCompanyPixel(data.slug, data.meta_pixel_id);
        }
      } catch (err) {
        console.error("Error fetching company details on payment page:", err);
      }
    };
    fetchCompany();
  }, [searchParams]);

  const isCapital = company?.slug === 'capital';
  const isFinance = company?.slug?.startsWith('finance');
  const currentLogo = company?.logo_url || (isCapital ? capitalLogo : financeLogo);
  const companyName = company?.name || "Credit Hariox";
  const themeColor = company?.primary_color || (isCapital ? "#10b981" : "#1e3a5f");

  const leadId = location.state?.leadId || urlLeadId;
  const leadDetails = location.state?.leadDetails || {};
  const paymentSource = location.state?.paymentSource || "direct";
  const loanAmount = location.state?.loanAmount || leadDetails?.loanAmount || 0;

  const purchaseFiredRef = useRef(false);
  const orderRequestStartedRef = useRef<string | null>(null);

  // Fire purchase tracking ONCE — call BEFORE navigating away
  // Dedupe by order ID across pages/session to prevent double-firing
  const firePurchasePixel = useCallback((trackAmount: number, trackOrderId: string) => {
    if (purchaseFiredRef.current) return;
    purchaseFiredRef.current = true;

    const dedupeKey = `meta_purchase_sent_${trackOrderId}`;
    if (localStorage.getItem(dedupeKey)) {
      console.log(`[PaymentPage] Purchase already tracked for order ${trackOrderId}, skipping duplicate`);
      return;
    }

    console.log(`[PaymentPage] Firing Purchase pixel BEFORE navigation: ₹${trackAmount} order ${trackOrderId} pixel ${companyPixelId}`);

    trackPurchase(trackAmount, trackOrderId, companyPixelId || undefined);
    trackGAPurchase(trackOrderId, trackAmount);
    localStorage.setItem(dedupeKey, "1");
  }, [companyPixelId]);


  const isTestMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("test") === "1") return true;
    const phone = leadDetails?.phone?.replace(/\D/g, "") || "";
    return phone === "8460191818" || phone === "7041409801";
  }, [location.search, leadDetails?.phone]);

  // Gateway routing per brand:
  //  - Finance Hariox → Razorpay
  //  - Credit Hariox  → PhonePe
  //  - Capital Hariox → Paytm (Razorpay fallback)
  const usePhonePe = requestedGateway === "phonepe" || (!isFinance && !isCapital && requestedGateway !== "razorpay"); // Credit (default brand)
  const usePaytm = requestedGateway === "paytm" || (isCapital && requestedGateway !== "razorpay");

  const [paytmFailed, setPaytmFailed] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);

  useEffect(() => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
    }
  }, []);

  // Load Razorpay script immediately on mount (don't wait for order).
  // Do NOT remove on unmount — script can be reused and removing causes "not loaded" errors.
  const [razorpayReady, setRazorpayReady] = useState(false);
  useEffect(() => {
    if (usePhonePe) return; // PhonePe doesn't need Razorpay
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      setRazorpayReady(true);
      return;
    }
    const existingScript = document.querySelector<HTMLScriptElement>('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => setRazorpayReady(true));
      if ((window as any).Razorpay) setRazorpayReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayReady(true);
    script.onerror = () => console.error("Failed to load Razorpay checkout.js");
    document.body.appendChild(script);
  }, [usePhonePe]);

  // Create order separately
  useEffect(() => {
    if (!leadId) {
      navigate("/");
      return;
    }
    if (usePhonePe) {
      setIsLoading(false);
      return;
    }
    if (usePaytm && !paytmFailed) {
      setIsLoading(false);
      return;
    }
    const orderKey = `${leadId}:razorpay:${isTestMode ? "test" : "live"}`;
    if (orderRequestStartedRef.current === orderKey) return;
    orderRequestStartedRef.current = orderKey;
    createRazorpayOrder();
  }, [leadId, navigate, usePaytm, usePhonePe, paytmFailed, isTestMode]);

  const createRazorpayOrder = async (retryCount = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-razorpay-order", {
        body: { leadId, testMode: isTestMode, paymentSource },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Already-paid users → redirect to success page instead of showing error
      if (data?.alreadyPaid) {
        navigate("/payment/success", {
          state: {
            amount: data.payment?.amount || (isCapital ? 471 : 799),
            orderId: data.payment?.orderId || "",
            paymentConfirmed: true,
            alreadyPaid: true,
          },
          replace: true,
        });
        return;
      }

      setOrderData(data);
    } catch (err: unknown) {
      console.error("Error creating order:", err);

      if (retryCount < 1) {
        setTimeout(() => createRazorpayOrder(retryCount + 1), 1000);
        return;
      }

      let message = "Failed to create payment order. Please try again.";
      const anyErr = err as any;
      if (anyErr?.message?.includes("fetch") || anyErr?.message?.includes("network")) {
        message = "Network error. Check your connection.";
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaytmPayment = async () => {
    if (!leadId) return;
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-paytm-order", {
        body: { 
          leadId, 
          amount: 399,
          customerName: leadDetails?.fullName || '',
          customerEmail: leadDetails?.email || '',
          customerPhone: leadDetails?.phone || '',
          callbackUrl: `https://capital.hariox.com/functions/v1/verify-paytm-payment`
        },
      });

      if (fnError) throw new Error(fnError.message || "Failed to initiate Paytm payment.");
      if (data?.error) throw new Error(data.error);

      if (data?.paymentUrl && data?.txnToken && data?.mid && data?.orderId) {
        // Build the full redirect URL with all required query params
        const redirectUrl = `${data.paymentUrl}?mid=${encodeURIComponent(data.mid)}&orderId=${encodeURIComponent(data.orderId)}&txnToken=${encodeURIComponent(data.txnToken)}`;
        
        // Use direct redirect — more reliable than hidden form POST across browsers/webviews
        window.location.href = redirectUrl;
      } else {
        throw new Error("No payment URL received from Paytm");
      }
    } catch (err: unknown) {
      console.error("Paytm error, falling back to Razorpay:", err);
      setPaytmFailed(true);
      setError("Paytm unavailable. Switching to Razorpay...");
      setIsProcessing(false);
      setTimeout(() => {
        setError(null);
        createRazorpayOrder();
      }, 1500);
    }
  };

  const handlePhonePePayment = async () => {
    if (!leadId) return;
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-phonepe-order", {
        body: { leadId, testMode: isTestMode, paymentSource },
      });

      if (fnError) throw new Error(fnError.message || "Failed to initiate PhonePe payment.");
      if (data?.error) throw new Error(data.error);

      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("No payment URL received from PhonePe");
      }
    } catch (err: unknown) {
      console.error("PhonePe error:", err);
      const anyErr = err as any;
      setError(anyErr?.message || "Failed to initiate PhonePe payment. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!orderData) {
      setError("Payment order not ready. Please wait a moment and try again.");
      return;
    }
    // Wait up to 8s for Razorpay SDK to finish loading
    if (!window.Razorpay) {
      setIsProcessing(true);
      const start = Date.now();
      while (!window.Razorpay && Date.now() - start < 8000) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!window.Razorpay) {
        setIsProcessing(false);
        setError("Payment gateway failed to load. Please refresh the page.");
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    const options: RazorpayOptions = {
      key: orderData.keyId,
      amount: orderData.amount * 100,
      currency: "INR",
      name: companyName,
      description: "Loan Consultation Fee",
      order_id: orderData.orderId,
      prefill: {
        name: orderData.leadDetails.name,
        email: orderData.leadDetails.email,
        contact: orderData.leadDetails.phone,
      },
      theme: { color: themeColor },
      handler: async (response: RazorpayResponse) => {
        try {
          // 🔥 Fire Purchase pixel IMMEDIATELY — before verify/navigate (fbq already loaded)
          firePurchasePixel(orderData?.breakdown.totalAmount || (isCapital ? 471 : 799), response.razorpay_order_id);

          const { error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment", {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              leadId,
            },
          });
          if (verifyError) throw verifyError;
          navigate("/payment/success", {
            state: { amount: orderData?.breakdown.totalAmount || (isCapital ? 471 : 799), orderId: response.razorpay_order_id, paymentConfirmed: true },
          });
        } catch (err) {
          console.error("Verification error:", err);
          setError("Verification failed. Refund in 5-7 days if deducted.");
        } finally {
          setIsProcessing(false);
        }
      },
      modal: {
        ondismiss: () => {
          setIsProcessing(false);
          setError("Payment cancelled. Click Pay to retry.");
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const handlePayment = () => {
    if (usePhonePe) { handlePhonePePayment(); return; }
    if (usePaytm && !paytmFailed) { handlePaytmPayment(); return; }
    handleRazorpayPayment();
  };

  const displayAmount = orderData?.breakdown.totalAmount ?? (isCapital ? 471 : 799);
  const displayFee = orderData?.breakdown.consultingFee ?? (isCapital ? 399 : 677);
  const displayGst = orderData?.breakdown.gstAmount ?? (isCapital ? 72 : 122);

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col overflow-hidden">
      {/* Initialize Meta Pixel on payment page so fbq is ready for Purchase tracking */}
      <MetaPixel />
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 bg-background/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <img src={currentLogo} alt="Logo" className="h-6 w-auto" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] ${isCapital ? 'bg-emerald-100 text-emerald-600' : 'bg-secondary/10 text-secondary'}`}>
            <CheckCircle className="w-3 h-3" />
            Final Step
          </div>
        </div>
      </div>

      {/* Content — fills remaining space, no scroll */}
      <div className="flex-1 flex flex-col justify-between px-3 py-2 max-w-lg mx-auto w-full">

        {/* Test Mode */}
        {isTestMode && (
          <div className="bg-amber-100 border border-amber-300 rounded-lg p-1.5 text-[10px] text-amber-800 text-center mb-1">
            🧪 Test Mode: ₹1
          </div>
        )}

        {/* In-App Warning */}
        {showInAppWarning && (
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-2 text-center mb-1">
            <p className="text-[10px] font-semibold text-orange-800">⚠️ Open in browser for smooth payment</p>
            <Button
              variant="outline"
              size="sm"
              className="border-orange-400 text-orange-800 h-6 text-[10px] mt-1 px-2"
              onClick={() => {
                const url = window.location.href;
                if (/android/i.test(navigator.userAgent)) {
                  window.location.href = `intent:${url}#Intent;end`;
                } else {
                  window.open(url, '_system');
                }
              }}
            >
              <ExternalLink className="w-2.5 h-2.5 mr-1" />
              Open in Browser
            </Button>
          </div>
        )}

        {/* Hero Card — compact */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary via-primary to-secondary rounded-xl p-2.5 text-primary-foreground"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold">
              🎉 Congrats {leadDetails?.fullName?.split(' ')[0] || 'User'}!
            </h1>
            <div className="flex items-center gap-1 text-[10px] opacity-90">
              <Clock className="w-3 h-3" />
              24hr Disbursal
            </div>
          </div>
          <p className="text-[11px] opacity-90 mt-0.5">
            {loanAmount > 0 ? (
              <>Your loan of <strong>₹{loanAmount.toLocaleString('en-IN')}</strong> is pre-approved!</>
            ) : (
              <>Your loan application is pre-approved!</>
            )}
          </p>
        </motion.div>

        {/* Social proof bar — live counter + scarcity */}
        <div className="flex items-center justify-between my-1.5 gap-2">
          <LiveCustomerCounter
            variant={isCapital ? "capital" : "credit"}
            className="!px-2 !py-1 scale-[0.85] origin-left"
          />
          <div className="flex items-center gap-1 px-2 py-1 bg-destructive/5 border border-destructive/20 rounded-full flex-shrink-0">
            <span className="text-[10px] animate-pulse">⏳</span>
            <p className="text-[10px] font-semibold text-destructive">3 slots left</p>
          </div>
        </div>

        {/* ₹799 Consulting Fee heading */}
        <div className="text-center mb-1">
          <p className="text-xs font-bold text-foreground">₹{isCapital ? '471' : '799'} Consulting Fee Includes</p>
        </div>

        {/* Benefits — big 2x3 cards filling space */}
        <div className="grid grid-cols-2 gap-2 flex-1 content-stretch">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 20 }}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br ${b.accent} border backdrop-blur-sm shadow-sm`}
            >
              <div className={`w-10 h-10 rounded-xl ${b.iconBg} flex items-center justify-center shadow-md`}>
                <b.icon className={`w-5 h-5 ${b.iconColor}`} />
              </div>
              <p className="text-[11px] font-bold text-foreground leading-tight text-center">{b.title}</p>
              <p className="text-[9px] text-muted-foreground leading-snug text-center px-1">{b.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Trust + SSL */}
        <div className="flex items-center justify-center gap-3 py-1">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <Shield className="w-3 h-3 text-emerald-600" />
            SSL Secured
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <BadgeCheck className="w-3 h-3 text-emerald-600" />
            RBI Registered
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 rounded-lg p-2 border border-destructive/20 mb-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
              <p className="text-[10px] text-destructive flex-1">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 px-1.5 text-[10px]">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Pay Button — inline at bottom */}
        <div className="mt-auto pt-2 safe-area-bottom">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <p className="text-base font-bold text-foreground">₹{displayAmount}</p>
              <p className="text-[9px] text-muted-foreground">₹{displayFee} + ₹{displayGst} GST</p>
            </div>
            <Button
              variant="hero"
              size="lg"
              className="h-11 flex-1 text-sm font-bold"
              onClick={handlePayment}
              disabled={isProcessing || isLoading || (!(usePaytm && !paytmFailed) && !usePhonePe && !orderData)}
            >
              {isProcessing || isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Pay ₹{displayAmount} Now →</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
