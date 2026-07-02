import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Shield, TrendingDown, CheckCircle, Building2, Users, Star, Phone, BadgeCheck, Award, Percent, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FinanceApplicationModal from "./FinanceApplicationModal";
import LiveCustomerCounter from "@/components/landing/LiveCustomerCounter";

// Animated Counter Hook
const useAnimatedCounter = (end: number, duration: number = 2000, startWhenVisible: boolean = true) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!startWhenVisible || (isInView && !hasStarted.current)) {
      hasStarted.current = true;
      let startTime: number;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeOutQuart * end));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [end, duration, isInView, startWhenVisible]);

  return { count, ref };
};

const trustBadges = [
  { icon: TrendingDown, text: "Lowest Rates", subtext: "From 8.5%" },
  { icon: Shield, text: "No Hidden Fees", subtext: "100% Transparent" },
  { icon: Award, text: "RBI Partners", subtext: "Fully Compliant" },
];

const FinanceHero = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const normalizedPhone = phone.replace(/\D/g, "").slice(0, 10);
  const initialPhone = /^[6-9]\d{9}$/.test(normalizedPhone) ? normalizedPhone : undefined;

  // Animated counters
  const { count: disbursedCount, ref: disbursedRef } = useAnimatedCounter(50000, 2000);
  const { count: customersCount, ref: customersRef } = useAnimatedCounter(45000, 2000);
  const { count: ratingCount, ref: ratingRef } = useAnimatedCounter(48, 2000);

  // Urgency: limited slots counter
  const [slotsLeft, setSlotsLeft] = useState(12);
  useEffect(() => {
    const interval = setInterval(() => {
      setSlotsLeft(prev => Math.max(3, prev - (Math.random() > 0.6 ? 1 : 0)));
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // Recent approval ticker
  const recentApprovals = [
    { name: "Rahul M.", city: "Mumbai", amount: "₹5L", time: "2 min ago" },
    { name: "Priya S.", city: "Delhi", amount: "₹3L", time: "5 min ago" },
    { name: "Amit K.", city: "Pune", amount: "₹8L", time: "8 min ago" },
    { name: "Neha R.", city: "Bangalore", amount: "₹4L", time: "12 min ago" },
  ];
  const [tickerIndex, setTickerIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % recentApprovals.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <section id="home" className="relative min-h-[100svh] pt-16 lg:pt-0 overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
        {/* Elegant Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Subtle accent lines */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          
          {/* Subtle geometric pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-20 right-10 w-96 h-96 border border-primary rounded-full" />
            <div className="absolute bottom-20 left-10 w-64 h-64 border border-secondary rounded-full" />
          </div>

          {/* Gradient orbs */}
          <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="min-h-[100svh] flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20 py-8 lg:py-0">
            
            {/* Left Content */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 max-w-2xl text-center lg:text-left order-2 lg:order-1"
            >
              {/* Corporate Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-4 lg:mb-6 rounded-full"
              >
                <Building2 className="w-4 h-4" />
                Established Financial Partner
              </motion.div>

              {/* Urgency: Slots Left */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-3"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold animate-pulse">
                  <Zap className="w-4 h-4" />
                  Only {slotsLeft} slots left today — Apply now!
                </div>
              </motion.div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-4 lg:mb-6">
                Get Personal Loan
                <span className="block mt-2 lg:mt-3">
                  <span className="text-gradient-vibrant">Up to ₹15 Lakhs</span>
                  <span className="relative inline-block ml-2">
                    <span className="text-foreground">in Minutes!</span>
                    <motion.span
                      className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.8, duration: 0.6 }}
                    />
                  </span>
                </span>
              </h1>

              <p className="text-base lg:text-xl text-muted-foreground mb-6 lg:mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                <a href="/" className="text-primary font-semibold hover:underline">Get instant personal loan online</a> — transparent pricing with no hidden charges. Compare rates from 50+ RBI-registered banks and get the best deal.
              </p>

              {/* Recent Approval Ticker */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="mb-6"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success/5 border border-success/20 text-sm">
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                  <motion.span
                    key={tickerIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-foreground"
                  >
                    <strong>{recentApprovals[tickerIndex].name}</strong> from {recentApprovals[tickerIndex].city} got <strong>{recentApprovals[tickerIndex].amount}</strong> approved — {recentApprovals[tickerIndex].time}
                  </motion.span>
                </div>
              </motion.div>

              {/* Trust Badges */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 lg:gap-4 mb-6 lg:mb-10">
                {trustBadges.map((badge, idx) => (
                  <motion.div 
                    key={idx}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="flex items-center gap-3 px-4 py-3 bg-card backdrop-blur-sm border border-border rounded-xl hover:border-primary/30 transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                      <badge.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-foreground">{badge.text}</div>
                      <div className="text-xs text-muted-foreground">{badge.subtext}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Live Customer Counter */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="hidden sm:block mb-6"
              >
                <LiveCustomerCounter variant="credit" />
              </motion.div>

              {/* Animated Stats - Desktop only */}
              <div className="hidden lg:grid grid-cols-3 gap-8 pt-8 border-t border-border">
                <motion.div 
                  ref={disbursedRef}
                  whileHover={{ scale: 1.02 }}
                  className="text-left cursor-default"
                >
                  <div className="text-3xl font-bold text-primary">
                    ₹{disbursedCount.toLocaleString()} Cr+
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Loans Disbursed</div>
                </motion.div>
                <motion.div 
                  ref={customersRef}
                  whileHover={{ scale: 1.02 }}
                  className="text-left cursor-default"
                >
                  <div className="text-3xl font-bold text-foreground">
                    {customersCount.toLocaleString()}+
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Satisfied Clients</div>
                </motion.div>
                <motion.div 
                  ref={ratingRef}
                  whileHover={{ scale: 1.02 }}
                  className="text-left cursor-default"
                >
                  <div className="text-3xl font-bold text-foreground flex items-center gap-2">
                    {(ratingCount / 10).toFixed(1)}
                    <Star className="w-6 h-6 text-secondary fill-secondary" />
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Customer Rating</div>
                </motion.div>
              </div>
            </motion.div>

            {/* Right - Application Form Card */}
            <motion.div
              id="hero-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-sm lg:max-w-md order-1 lg:order-2"
            >
              <div className="bg-card shadow-xl border border-border p-6 lg:p-8 relative rounded-2xl">
                {/* Form Header */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary rounded-xl flex items-center justify-center">
                    <Percent className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-1">
                    Get upto ₹10 Lacs in 24 Hrs
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Compare rates from 50+ banks instantly
                  </p>
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-full bg-primary rounded-l-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <Input
                      type="tel"
                      placeholder="Enter your mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full h-14 pl-16 pr-4 text-lg rounded-lg border-2 border-input focus:border-primary focus:ring-0"
                      maxLength={10}
                    />
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      onClick={handleGetStarted}
                      className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-lg shadow-lg"
                    >
                      Get Free Quote
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                </div>

                {/* Trust Indicators */}
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-primary" />
                      <span>Bank-Grade Security</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BadgeCheck className="w-4 h-4 text-primary" />
                      <span>RBI Compliant</span>
                    </div>
                  </div>
                </div>

                {/* Mobile Stats */}
                <div className="grid grid-cols-3 gap-3 mt-6 lg:hidden">
                  <div className="bg-primary/5 p-3 text-center border border-primary/10 rounded-lg">
                    <div className="text-lg font-bold text-primary">₹50K Cr</div>
                    <div className="text-[10px] text-muted-foreground">Disbursed</div>
                  </div>
                  <div className="bg-secondary/10 p-3 text-center border border-secondary/20 rounded-lg">
                    <div className="text-lg font-bold text-secondary">45K+</div>
                    <div className="text-[10px] text-muted-foreground">Clients</div>
                  </div>
                  <div className="bg-primary/5 p-3 text-center border border-primary/10 rounded-lg">
                    <div className="text-lg font-bold text-foreground flex items-center justify-center gap-0.5">
                      4.8 <Star className="w-3 h-3 text-secondary fill-secondary" />
                    </div>
                    <div className="text-[10px] text-muted-foreground">Rating</div>
                  </div>
                </div>

                <p className="text-center text-[10px] text-muted-foreground mt-4">
                  By continuing, you agree to our{" "}
                  <a href="/terms-conditions" className="text-primary hover:underline">Terms</a>
                  {" "}and{" "}
                  <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>
                </p>
              </div>

              {/* Banking Partners Badge */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 bg-primary p-4 text-center text-primary-foreground rounded-xl"
              >
                <div className="flex items-center justify-center gap-3">
                  <Building2 className="w-5 h-5" />
                  <span className="text-sm font-medium">50+ Banking Partners</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <FinanceApplicationModal
        key={initialPhone ?? "no-phone"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPhone={initialPhone}
      />
    </>
  );
};

export default FinanceHero;
