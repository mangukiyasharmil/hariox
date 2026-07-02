import { motion } from "framer-motion";
import { ArrowRight, Shield, Clock, Users, TrendingDown, CheckCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveCustomerCounter from "./landing/LiveCustomerCounter";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePublicCompany } from "@/contexts/PublicCompanyContext";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

// Animated counter hook
const useCountUp = (end: number, duration = 2000, suffix = "", decimals = 0) => {
  const [value, setValue] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !hasStarted) setHasStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(eased * end * Math.pow(10, decimals)) / Math.pow(10, decimals));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [hasStarted, end, duration, decimals]);

  return { value: decimals > 0 ? value.toFixed(decimals) : Math.round(value), ref, suffix };
};

interface HeroProps {
  onApplyNow?: () => void;
}

const Hero = ({ onApplyNow }: HeroProps) => {
  const { t } = useLanguage();
  const { company } = usePublicCompany();
  const whatsappNumber = company?.whatsapp_number || "918469391818";
  const isMobile = useIsMobile();

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

  const trustBadges = [
    { icon: Shield, label: t.safe100 },
    { icon: Clock, label: t.hr24Service },
    { icon: Users, label: t.expertTeam },
    { icon: TrendingDown, label: t.bestRates },
  ];

  // On mobile: skip framer-motion animations for faster FCP
  // Use a simple wrapper that renders children directly
  const Wrapper = isMobile 
    ? ({ children, className }: { children: React.ReactNode; className?: string; [key: string]: any }) => <div className={className}>{children}</div>
    : motion.div;
  
  const wrapperProps = (delay: number, direction: "y" | "x" = "y") => 
    isMobile ? {} : {
      initial: { opacity: 0, [direction]: direction === "y" ? 30 : 50 },
      animate: { opacity: 1, [direction]: 0 },
      transition: { duration: 0.6, delay },
    };

  // Animated counters for stats card
  const approvedCounter = useCountUp(50, 2000, "K+");
  const interestCounter = useCountUp(8, 1500, "%");
  const ratingCounter = useCountUp(4.8, 1800, "★", 1);

  return (
    <section id="home" className="relative min-h-[100dvh] gradient-hero overflow-hidden pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between min-h-[calc(100vh-4rem)] py-8 lg:py-14 gap-10">
          {/* Left Content */}
          <div className={`flex-1 max-w-2xl ${isMobile ? "animate-fade-in" : ""}`}>
            {/* Urgency Banner */}
            <Wrapper {...wrapperProps(0.1)} className="mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold animate-pulse">
                <Zap className="w-4 h-4" />
                Only {slotsLeft} slots left today — Apply now!
              </div>
            </Wrapper>

            <Wrapper {...wrapperProps(0.2)}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                {t.heroTrusted}
              </span>
            </Wrapper>

            <Wrapper {...wrapperProps(0.3)}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight mb-6">
                {t.heroTitle1.split("₹10")[0]}
                <span className="text-gradient-warm">₹10 {t.heroTitle1.includes("Lakh") ? "Lakh" : t.heroTitle1.includes("लाख") ? "लाख" : "லட்சம்"}</span>
                <br />
                {t.heroTitle2}
              </h1>
            </Wrapper>

            <Wrapper {...wrapperProps(0.4)}>
              <p className="text-lg lg:text-xl text-muted-foreground mb-4 max-w-xl">
                <a href="/" className="text-primary font-semibold hover:underline">Get instant personal loan online</a>{" "}
                — {t.heroSubtitle}
              </p>
            </Wrapper>

            {/* Recent Approval Ticker */}
            <Wrapper {...wrapperProps(0.45)} className="mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success/5 border border-success/20 text-sm">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                {isMobile ? (
                  <span className="text-foreground">
                    <strong>{recentApprovals[tickerIndex].name}</strong> from {recentApprovals[tickerIndex].city} got <strong>{recentApprovals[tickerIndex].amount}</strong> approved — {recentApprovals[tickerIndex].time}
                  </span>
                ) : (
                  <motion.span
                    key={tickerIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-foreground"
                  >
                    <strong>{recentApprovals[tickerIndex].name}</strong> from {recentApprovals[tickerIndex].city} got <strong>{recentApprovals[tickerIndex].amount}</strong> approved — {recentApprovals[tickerIndex].time}
                  </motion.span>
                )}
              </div>
            </Wrapper>

            <Wrapper {...wrapperProps(0.5)} className="flex flex-wrap gap-4 mb-8">
              <Button 
                variant="hero" 
                size="xl" 
                className="group relative overflow-hidden"
                onClick={onApplyNow}
              >
                <span className="relative z-10 flex items-center">
                  {t.startApplication}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              <a 
                href={`https://wa.me/${whatsappNumber}?text=Hello,%20I%20want%20to%20talk%20to%20a%20loan%20expert`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="xl">
                  {t.talkToExpert}
                </Button>
              </a>
            </Wrapper>

            {/* Trust Badges */}
            <Wrapper {...wrapperProps(0.6)} className="flex flex-wrap gap-6">
              {trustBadges.map((badge, index) => (
                <div key={index} className="flex items-center gap-2 text-muted-foreground">
                  <badge.icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{badge.label}</span>
                </div>
              ))}
            </Wrapper>

            {/* Live Customer Counter */}
            <Wrapper {...wrapperProps(0.7)} className="mt-6">
              <LiveCustomerCounter variant="credit" />
            </Wrapper>
          </div>

          {/* Right Content - Stats Cards (hidden on mobile for faster load) */}
          {!isMobile && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex-1 max-w-lg w-full"
            >
              <div className="relative">
                <div className="bg-card rounded-3xl p-8 shadow-card border border-border">
                  <div className="space-y-8">
                    <div ref={approvedCounter.ref} className="text-center pb-6 border-b border-border">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {t.loanApproved}
                      </h3>
                      <p className="text-5xl font-extrabold text-gradient-brand">{approvedCounter.value}K+</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div ref={interestCounter.ref} className="text-center">
                        <p className="text-3xl font-bold text-foreground">{interestCounter.value}%</p>
                        <p className="text-sm text-muted-foreground">{t.interestPA}</p>
                      </div>
                      <div ref={ratingCounter.ref} className="text-center">
                        <p className="text-3xl font-bold text-foreground">{ratingCounter.value}★</p>
                        <p className="text-sm text-muted-foreground">{t.rating}</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center gap-4 bg-muted/50 rounded-2xl p-4">
                        <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">
                          SK
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-foreground font-medium">
                            "Got ₹5 lakh approved in 18 hours! Best service ever!"
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Suresh K., Mumbai
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-6 -right-6 w-24 h-24 bg-secondary/20 rounded-2xl rotate-12 animate-float" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-primary/20 rounded-xl -rotate-6 animate-float" style={{ animationDelay: "1s" }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;