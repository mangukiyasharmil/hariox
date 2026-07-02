import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OTPVerificationStepProps {
  phone: string;
  onVerified: () => void;
  onBack: () => void;
}

const OTPVerificationStep = ({ phone, onVerified, onBack }: OTPVerificationStepProps) => {
  const [otp, setOtp] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [hasSentInitial, setHasSentInitial] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  // Send OTP on mount
  useEffect(() => {
    if (!hasSentInitial && phone) {
      sendOTP();
      setHasSentInitial(true);
    }
  }, [phone, hasSentInitial]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const getCooldownDuration = (count: number) => {
    if (count <= 1) return 15;   // After 1st send: 15s
    if (count === 2) return 30;  // After 2nd send: 30s
    return 180;                  // After 3rd+ send: 3 minutes
  };

  const sendOTP = async () => {
    if (isSending || cooldown > 0) return;
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone },
      });

      if (error) {
        console.error("Send OTP invoke error:", error);
        toast.error("Failed to send OTP. Please try again.");
        return;
      }

      if (data?.success) {
        const newCount = resendCount + 1;
        setResendCount(newCount);
        toast.success("OTP sent to +91 " + phone);
        setCooldown(getCooldownDuration(newCount));
      } else {
        toast.error(data?.error || "Failed to send OTP");
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 4) {
      toast.error("Please enter complete 4-digit OTP");
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code: otp },
      });

      if (error) {
        console.error("Verify OTP invoke error:", error);
        toast.error("Verification failed. Please request a new OTP.");
        setOtp("");
        return;
      }

      if (data?.success) {
        setIsVerified(true);
        toast.success("Phone number verified!");
        // Instant transition - no delay
        onVerified();
      } else {
        toast.error(data?.error || "Invalid OTP");
        setOtp("");
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (otp.length === 4 && !isVerifying && !isVerified) {
      verifyOTP();
    }
  }, [otp]);

  if (isVerified) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 space-y-4"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <p className="text-lg font-medium text-green-700">Phone Verified!</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">
          We've sent a 4-digit OTP to
        </p>
        <p className="text-lg font-semibold">+91 {phone}</p>
      </div>

      <div className="flex flex-col items-center space-y-4">
        <Label className="sr-only">Enter OTP</Label>
        <InputOTP
          maxLength={4}
          value={otp}
          onChange={setOtp}
          disabled={isVerifying}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Didn't receive OTP?</span>
          <Button
            variant="link"
            size="sm"
            className="p-0 h-auto"
            onClick={sendOTP}
            disabled={isSending || cooldown > 0}
          >
            {isSending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : cooldown > 0 ? (
              cooldown >= 60 
                ? `Resend in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`
                : `Resend in ${cooldown}s`
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1" />
                Resend OTP
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onBack}
          disabled={isVerifying}
        >
          Change Number
        </Button>
        <Button
          variant="hero"
          className="flex-1"
          onClick={verifyOTP}
          disabled={otp.length !== 4 || isVerifying}
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              Verify
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};

export default OTPVerificationStep;
