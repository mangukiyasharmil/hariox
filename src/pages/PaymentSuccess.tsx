import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import MetaPixel, { trackPurchase, getPixelIdForCompany, setRuntimePixelId, registerCompanyPixel } from "@/components/MetaPixel";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CapitalHeader from "@/components/capital/CapitalHeader";
import CapitalFooter from "@/components/capital/CapitalFooter";
import FinanceHeader from "@/components/finance/FinanceHeader";
import FinanceFooter from "@/components/finance/FinanceFooter";
import { trackGAPurchase } from "@/components/GoogleAnalytics";
import { supabase } from "@/integrations/supabase/client";

type PaymentStatus = "loading" | "success" | "failed" | "pending" | "error";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>(() => {
    // INSTANT SUCCESS: If Razorpay handler already confirmed, show success immediately
    if (location.state?.paymentConfirmed) return "success";
    if (searchParams.get('error')) return "failed";
    return "loading";
  });
  const [errorMessage, setErrorMessage] = useState<string>(() => {
    const err = searchParams.get('error');
    return err ? decodeURIComponent(err) : "";
  });
  const purchaseTrackedRef = useRef(false);
  
  const amount = location.state?.amount || (searchParams.get('company') === 'capital' || window.location.hostname.includes('capital') ? 471 : 799);
  const stateOrderId = location.state?.orderId || "";
  const urlOrderId = searchParams.get('orderId') || searchParams.get('order_id') || "";
  const orderId = urlOrderId || stateOrderId;

  const isCapital = searchParams.get('company') === 'capital' || 
    window.location.hostname.includes('capital');
  const isFinance = searchParams.get('company') === 'finance' ||
    window.location.hostname.includes('finance');

  // Fetch pixel from DB for this company
  const [companyPixelId, setCompanyPixelIdState] = useState<string | null>(null);
  useEffect(() => {
    const slug = isCapital ? 'capital' : isFinance ? 'finance' : 'hariox';
    supabase
      .from('companies')
      .select('meta_pixel_id, slug')
      .or(`slug.eq.${slug},slug.eq.credit`)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.meta_pixel_id) {
          setCompanyPixelIdState(data.meta_pixel_id);
          setRuntimePixelId(data.meta_pixel_id);
          registerCompanyPixel(data.slug, data.meta_pixel_id);
        }
      });
  }, [isCapital, isFinance]);

  // Fire purchase tracking ONCE — deduplicated via eventID + sessionStorage
  const fireTrackingOnce = useCallback((trackAmount: number, trackOrderId: string) => {
    if (purchaseTrackedRef.current) return;
    purchaseTrackedRef.current = true;

    const dedupeKey = `meta_purchase_sent_${trackOrderId}`;
    if (localStorage.getItem(dedupeKey)) return;

    trackPurchase(trackAmount, trackOrderId, companyPixelId || undefined);
    trackGAPurchase(trackOrderId, trackAmount);
    localStorage.setItem(dedupeKey, "1");
  }, [companyPixelId]);

  // If already confirmed via state (Razorpay), purchase was already fired in PaymentPage — skip
  // For redirect gateways (PhonePe/Paytm), fire purchase only after verification succeeds
  useEffect(() => {
    if (location.state?.paymentConfirmed && orderId) {
      // Razorpay: pixel already fired in PaymentPage handler before navigation
      // Just mark sessionStorage as backup (PaymentPage already did this)
      const dedupeKey = `meta_purchase_sent_${orderId}`;
      if (!localStorage.getItem(dedupeKey)) {
        // Edge case: sessionStorage cleared between pages — fire as fallback
        fireTrackingOnce(amount, orderId);
      }
    }
  }, []);

  useEffect(() => {
    // Already resolved via initial state
    if (status === "success" || status === "failed") return;

    if (!orderId) {
      setStatus("error");
      setErrorMessage("No order ID found");
      return;
    }

    // For redirect-based gateways (PhonePe/Paytm), verify fast
    verifyPaymentFast(orderId);
  }, [orderId]);

  // Ultra-fast verification: DB check first, gateway verify in parallel
  const verifyPaymentFast = async (oid: string) => {
    const isPhonePe = oid.startsWith("TXN_");
    const isPaytm = oid.startsWith("PAYTM");

    // Race: DB check + gateway verify simultaneously
    const dbCheck = supabase.from("payments").select("status, total_amount")
      .eq("razorpay_order_id", oid).maybeSingle();

    let verifyFn = "verify-razorpay-payment";
    if (isPhonePe) verifyFn = "verify-phonepe-payment";
    if (isPaytm) verifyFn = "verify-paytm-payment";

    const gatewayVerify = supabase.functions.invoke(verifyFn, {
      body: isPhonePe ? { orderId: oid } : { razorpay_order_id: oid },
    });

    // Run both in parallel — whichever confirms first wins
    const [dbResult, gwResult] = await Promise.allSettled([dbCheck, gatewayVerify]);

    // Check DB result first (fastest path — webhook may have already updated)
    if (dbResult.status === "fulfilled") {
      const { data: payment } = dbResult.value;
      if (payment?.status === "completed" || payment?.status === "captured") {
        setStatus("success");
        fireTrackingOnce(payment.total_amount || amount, oid);
        return;
      }
      if (payment?.status === "failed") {
        setStatus("failed");
        setErrorMessage("Your payment was not successful. Please try again.");
        return;
      }
    }

    // Check gateway result
    if (gwResult.status === "fulfilled") {
      const { data: vr } = gwResult.value;
      if (vr?.success && vr?.status === "completed") {
        setStatus("success");
        fireTrackingOnce(vr?.amount || amount, oid);
        return;
      }
      if (vr?.status === "failed") {
        setStatus("failed");
        setErrorMessage("Your payment was not successful. Please try again.");
        return;
      }
    }

    // Neither confirmed yet — quick retry loop (2 retries, 500ms gap)
    for (let i = 0; i < 2; i++) {
      await new Promise(r => setTimeout(r, 500));
      const { data: recheck } = await supabase.from("payments")
        .select("status, total_amount").eq("razorpay_order_id", oid).maybeSingle();
      if (recheck?.status === "completed" || recheck?.status === "captured") {
        setStatus("success");
        fireTrackingOnce(recheck.total_amount || amount, oid);
        return;
      }
      if (recheck?.status === "failed") {
        setStatus("failed");
        setErrorMessage("Your payment was not successful. Please try again.");
        return;
      }
    }

    // Still unresolved — show pending with retry
    setStatus("pending");
  };

  const handleRetry = () => {
    if (orderId) {
      setStatus("loading");
      verifyPaymentFast(orderId);
    }
  };

  const companyParam = '';
  
  // Select header/footer based on company
  let HeaderComponent = Header;
  let FooterComponent = Footer;
  if (isCapital) {
    HeaderComponent = CapitalHeader;
    FooterComponent = CapitalFooter;
  } else if (isFinance) {
    HeaderComponent = FinanceHeader;
    FooterComponent = FinanceFooter;
  }

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-8 shadow-card border border-border text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-bold mb-3">Verifying Payment...</h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment status.
            </p>
          </motion.div>
        );

      case "success":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-8 shadow-card border border-border text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/20 flex items-center justify-center"
            >
              <CheckCircle className="w-10 h-10 text-success" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-3">Payment Successful! 🎉</h1>
            <p className="text-muted-foreground mb-6">
              Our team will contact you within 2 hours to collect your documents.
            </p>
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left text-sm">
              <p className="font-medium mb-2">Next Steps:</p>
              <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Receive WhatsApp with document upload link</li>
                <li>Upload Aadhaar, PAN, Salary Slips, Bank Statements</li>
                <li>Documents verified within 24 hours</li>
                <li>Loan approval within 24-48 hours!</li>
              </ol>
            </div>
            <Button variant="hero" onClick={() => navigate(`/${companyParam}`)}>
              Go to Homepage
            </Button>
          </motion.div>
        );

      case "failed":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-8 shadow-card border border-border text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/20 flex items-center justify-center"
            >
              <XCircle className="w-10 h-10 text-destructive" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-3">Payment Failed</h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage || "Your payment could not be processed. Please try again."}
            </p>
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left text-sm">
              <p className="font-medium mb-2">What to do next:</p>
              <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Check if any amount was deducted from your account</li>
                <li>If deducted, it will be refunded in 5-7 business days</li>
                <li>Try a different payment method</li>
                <li>Contact support if issue persists</li>
              </ol>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(`/${companyParam}`)}>
                Go to Homepage
              </Button>
              <Button variant="hero" onClick={() => window.history.back()}>
                Try Again
              </Button>
            </div>
          </motion.div>
        );

      case "pending":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-8 shadow-card border border-border text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center"
            >
              <AlertCircle className="w-10 h-10 text-amber-500" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-3">Payment Processing</h1>
            <p className="text-muted-foreground mb-6">
              Your payment is being processed. This may take a few minutes.
            </p>
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left text-sm">
              <p className="text-muted-foreground">
                If the payment was successful, you'll receive a confirmation SMS shortly.
                You can also check back in a few minutes.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(`/${companyParam}`)}>
                Go to Homepage
              </Button>
              <Button variant="hero" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Status
              </Button>
            </div>
          </motion.div>
        );

      case "error":
      default:
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-8 shadow-card border border-border text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/20 flex items-center justify-center"
            >
              <AlertCircle className="w-10 h-10 text-destructive" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-3">Something Went Wrong</h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage || "We couldn't verify your payment status. Please contact support."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(`/${companyParam}`)}>
                Go to Homepage
              </Button>
              <Button variant="hero" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Initialize Meta Pixel on this page — domain-enforced internally */}
      <MetaPixel />
      <HeaderComponent />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-lg">
          {renderContent()}
        </div>
      </main>
      <FooterComponent />
    </div>
  );
};

export default PaymentSuccess;
