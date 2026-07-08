import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Shield, Clock, CheckCircle, Sparkles, Users, Star, Phone, BadgeCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CapitalApplicationModal from "./CapitalApplicationModal";
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
  { icon: Clock, text: "Instant Approval", color: "from-amber-400 to-orange-500" },
  { icon: Shield, text: "100% Secure", color: "from-emerald-400 to-teal-500" },
  { icon: Zap, text: "24Hr Disbursal", color: "from-blue-400 to-indigo-500" },
];

const CapitalHero = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
  const initialPhone = /^[6-9]\d{9}$/.test(normalizedPhone) ? normalizedPhone : undefined;

  // Animated counters
  const { count: disbursedCount, ref: disbursedRef } = useAnimatedCounter(40000, 2000);
  const { count: customersCount, ref: customersRef } = useAnimatedCounter(35000, 2000);
  const { count: ratingCount, ref: ratingRef } = useAnimatedCounter(49, 2000);

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
      <section id="home" className="relative min-h-[100svh] pt-16 lg:pt-0 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        {/* Decorative Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-0 w-[500px] h-[500px] bg-gradient-to-br from-emerald-100/50 to-teal-100/50 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-blue-100/40 to-cyan-100/40 rounded-full blur-3xl" />
          {/* Floating elements */}
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-32 left-[10%] w-16 h-16 bg-gradient-to-br from-amber-200 to-orange-300 rounded-2xl opacity-20 rotate-12"
          />
          <motion.div
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-48 right-[15%] w-12 h-12 bg-gradient-to-br from-emerald-200 to-teal-300 rounded-full opacity-30"
          />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="min-h-[100svh] flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16 py-4 lg:py-0">
            
            {/* Left Content - Compact for Mobile */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 max-w-xl text-center lg:text-left order-2 lg:order-1"
            >
              {/* Badge - Smaller on mobile */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium mb-3 lg:mb-6"
              >
                <Sparkles className="w-3 h-3" />
                Trusted by 35,000+ Customers
              </motion.div>

              {/* Urgency: Slots Left */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-3"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-600 text-sm font-semibold animate-pulse">
                  <Zap className="w-4 h-4" />
                  Only {slotsLeft} slots left today — Apply now!
                </div>
              </motion.div>

              {/* Headline - Smaller on mobile */}
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-3 lg:mb-6">
                Get Instant Loan
                <span className="block mt-1 lg:mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  Up to ₹10 Lakhs
                </span>
              </h1>

              <p className="text-sm lg:text-lg text-gray-600 mb-4 lg:mb-8 max-w-lg mx-auto lg:mx-0 hidden sm:block">
                <a href="/" className="text-emerald-600 font-semibold hover:underline">Get instant personal loan online</a> — quick approvals, minimal documentation, and funds in your account within 24 hours.
              </p>

              {/* Recent Approval Ticker */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="mb-4"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <motion.span
                    key={tickerIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-gray-800"
                  >
                    <strong>{recentApprovals[tickerIndex].name}</strong> from {recentApprovals[tickerIndex].city} got <strong>{recentApprovals[tickerIndex].amount}</strong> approved — {recentApprovals[tickerIndex].time}
                  </motion.span>
                </div>
              </motion.div>

              {/* Trust Badges - Compact colorful boxes */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 lg:gap-3 mb-4 lg:mb-6">
                {trustBadges.map((badge, idx) => (
                  <motion.div 
                    key={idx}
                    whileHover={{ scale: 1.05, y: -2 }}
                    transition={{ type: "spring", stiffness: 400 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 bg-gradient-to-r ${badge.color} rounded-full shadow-md`}
                  >
                    <badge.icon className="w-3 h-3 lg:w-4 lg:h-4 text-white" />
                    <span className="text-xs lg:text-sm font-medium text-white">{badge.text}</span>
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
                <LiveCustomerCounter variant="capital" />
              </motion.div>

              {/* Animated Stats - Desktop only */}
              <div className="hidden lg:grid grid-cols-3 gap-6 pt-6 border-t border-gray-100">
                <motion.div 
                  ref={disbursedRef}
                  whileHover={{ scale: 1.05 }}
                  className="text-left cursor-default"
                >
                  <div className="text-2xl lg:text-3xl font-bold text-gray-900">
                    ₹{disbursedCount.toLocaleString()} Cr+
                  </div>
                  <div className="text-sm text-gray-500">Disbursed</div>
                </motion.div>
                <motion.div 
                  ref={customersRef}
                  whileHover={{ scale: 1.05 }}
                  className="text-left cursor-default"
                >
                  <div className="text-2xl lg:text-3xl font-bold text-gray-900">
                    {customersCount.toLocaleString()}+
                  </div>
                  <div className="text-sm text-gray-500">Happy Customers</div>
                </motion.div>
                <motion.div 
                  ref={ratingRef}
                  whileHover={{ scale: 1.05 }}
                  className="text-left cursor-default"
                >
                  <div className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-1">
                    {(ratingCount / 10).toFixed(1)}
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="text-sm text-gray-500">Google Rating</div>
                </motion.div>
              </div>

              {/* Human Trust Element - Desktop */}
              <div className="hidden lg:flex items-center gap-4 mt-8 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex -space-x-3">
                  {[
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face",
                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=face",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face",
                    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face",
                  ].map((src, i) => (
                    <img 
                      key={i} 
                      src={src}
                      alt={`Customer ${i + 1}`}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">2,847 people</span> applied at Capital Hariox today
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Right - Application Form Card - First on Mobile */}
            <motion.div
              id="hero-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-sm lg:max-w-md order-1 lg:order-2"
            >
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl shadow-emerald-900/10 border border-gray-100 p-5 lg:p-8">
                {/* Form Header with Human Avatar */}
                <div className="text-center mb-5 lg:mb-6">
                  <div className="relative w-14 h-14 lg:w-16 lg:h-16 mx-auto mb-3">
                    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <Users className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
                    </div>
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center"
                    >
                      <CheckCircle className="w-3 h-3 text-white" />
                    </motion.div>
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">
                    Check Your Eligibility
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Get pre-approved in 2 minutes
                  </p>
                </div>

                {/* Form */}
                <div className="space-y-3 lg:space-y-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-emerald-600" />
                    </div>
                    <Input
                      type="tel"
                      placeholder="Enter your mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(-10))}
                      className="w-full h-12 lg:h-14 pl-14 pr-4 text-base lg:text-lg rounded-xl border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                      maxLength={10}
                    />
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      onClick={handleGetStarted}
                      className="w-full h-12 lg:h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-base lg:text-lg rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
                    >
                      Check Eligibility Free
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                </div>

                {/* Trust Indicators */}
                <div className="mt-4 lg:mt-5 pt-4 lg:pt-5 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-500" />
                      <span>256-bit SSL</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3 text-blue-500" />
                      <span>RBI Registered</span>
                    </div>
                  </div>
                </div>

                {/* Colorful Quick Stats - Mobile Only */}
                <div className="grid grid-cols-3 gap-2 mt-4 lg:hidden">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-2 text-center border border-emerald-100"
                  >
                    <div className="text-lg font-bold text-emerald-700">₹40K Cr</div>
                    <div className="text-[10px] text-gray-500">Disbursed</div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-2 text-center border border-amber-100"
                  >
                    <div className="text-lg font-bold text-amber-700">35K+</div>
                    <div className="text-[10px] text-gray-500">Customers</div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2 text-center border border-blue-100"
                  >
                    <div className="text-lg font-bold text-blue-700 flex items-center justify-center gap-0.5">
                      4.9 <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="text-[10px] text-gray-500">Rating</div>
                  </motion.div>
                </div>

                <p className="text-center text-[10px] lg:text-xs text-gray-400 mt-3 lg:mt-4">
                  By continuing, you agree to our{" "}
                  <a href="/terms-conditions" className="text-emerald-600 hover:underline">Terms</a>
                  {" "}and{" "}
                  <a href="/privacy-policy" className="text-emerald-600 hover:underline">Privacy Policy</a>
                </p>
              </div>

              {/* Payment Trust Badge */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-3 lg:mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-3 text-center text-white"
              >
                <div className="flex items-center justify-center gap-2">
                  <img 
                    src="https://razorpay.com/assets/razorpay-logo-white.svg" 
                    alt="Razorpay" 
                    className="h-4 lg:h-5"
                  />
                  <span className="text-xs lg:text-sm font-medium">Secure Payment Gateway</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <CapitalApplicationModal
        key={initialPhone ?? "no-phone"} // Force remount when phone changes to ensure clean state
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPhone={initialPhone}
      />
    </>
  );
};

export default CapitalHero;
