import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Users, TrendingUp } from "lucide-react";

interface LiveCustomerCounterProps {
  variant?: "credit" | "capital";
  className?: string;
}

const LiveCustomerCounter = ({ variant = "credit", className = "" }: LiveCustomerCounterProps) => {
  const [count, setCount] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const hasStarted = useRef(false);

  // Generate a realistic base count for today
  const getBaseCount = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Simulate realistic application flow throughout the day
    // More applications during business hours (9am-9pm)
    let baseRate = 50; // minimum applications by start of day
    
    if (hours >= 6 && hours < 9) {
      baseRate += (hours - 6) * 15 + Math.floor(minutes * 0.25);
    } else if (hours >= 9 && hours < 12) {
      baseRate += 45 + (hours - 9) * 40 + Math.floor(minutes * 0.67);
    } else if (hours >= 12 && hours < 14) {
      baseRate += 165 + (hours - 12) * 30 + Math.floor(minutes * 0.5);
    } else if (hours >= 14 && hours < 18) {
      baseRate += 225 + (hours - 14) * 45 + Math.floor(minutes * 0.75);
    } else if (hours >= 18 && hours < 21) {
      baseRate += 405 + (hours - 18) * 35 + Math.floor(minutes * 0.58);
    } else if (hours >= 21) {
      baseRate += 510 + (hours - 21) * 15 + Math.floor(minutes * 0.25);
    }
    
    // Add some randomness for authenticity
    return baseRate + Math.floor(Math.random() * 30);
  };

  // Animate counter on scroll
  useEffect(() => {
    if (isInView && !hasStarted.current) {
      hasStarted.current = true;
      const targetCount = getBaseCount();
      let startTime: number;
      
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / 1500, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeOutQuart * targetCount));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [isInView]);

  // Simulate live updates (increment randomly every 30-90 seconds)
  useEffect(() => {
    if (!hasStarted.current) return;
    
    const interval = setInterval(() => {
      if (Math.random() > 0.3) { // 70% chance of increment
        setCount(prev => prev + 1);
        setIsLive(true);
        setTimeout(() => setIsLive(false), 2000);
      }
    }, 30000 + Math.random() * 60000);
    
    return () => clearInterval(interval);
  }, []);

  const gradientClass = variant === "capital" 
    ? "from-emerald-500 to-teal-500" 
    : "from-primary to-secondary";
  
  const bgClass = variant === "capital"
    ? "bg-emerald-50 border-emerald-100"
    : "bg-primary/5 border-primary/10";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-full border ${bgClass} ${className}`}
    >
      <div className={`relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r ${gradientClass}`}>
        <Users className="w-4 h-4 text-white" />
        {isLive && (
          <motion.span
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${gradientClass}`}
          />
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          {count.toLocaleString("en-IN")}
        </span>
        <span className="text-sm text-muted-foreground">
          applications today
        </span>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-0.5 text-emerald-600"
        >
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs font-medium">Live</span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LiveCustomerCounter;
