// Trust badges section component
import { motion } from "framer-motion";
import { Shield, Clock, Users, TrendingDown, Award, CheckCircle2, Lock, Headphones } from "lucide-react";

const trustBadges = [
  { 
    icon: Shield, 
    label: "100% Secure", 
    sublabel: "Bank-grade security",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  { 
    icon: Clock, 
    label: "24 Hour Approval", 
    sublabel: "Fast processing",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  { 
    icon: Users, 
    label: "50,000+ Happy Customers", 
    sublabel: "Trusted nationwide",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  { 
    icon: TrendingDown, 
    label: "Lowest Interest Rates", 
    sublabel: "Starting 8% p.a.",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
];

const certifications = [
  { icon: CheckCircle2, label: "RBI Registered Partners" },
  { icon: Lock, label: "SSL Encrypted" },
  { icon: Award, label: "ISO 27001 Certified" },
  { icon: Headphones, label: "24/7 Support" },
];

interface TrustBadgesSectionProps {
  variant?: "horizontal" | "grid" | "minimal";
  showCertifications?: boolean;
}

const TrustBadgesSection = ({ 
  variant = "horizontal",
  showCertifications = true,
}: TrustBadgesSectionProps) => {
  if (variant === "minimal") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 py-4">
        {trustBadges.slice(0, 4).map((badge, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <badge.icon className={`w-4 h-4 ${badge.color}`} />
            <span className="text-xs font-medium">{badge.label}</span>
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <section className="py-8 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustBadges.map((badge, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`${badge.bgColor} rounded-xl p-4 text-center border border-border/50`}
              >
                <div className={`w-12 h-12 rounded-full ${badge.bgColor} flex items-center justify-center mx-auto mb-3`}>
                  <badge.icon className={`w-6 h-6 ${badge.color}`} />
                </div>
                <p className={`text-sm font-semibold ${badge.color}`}>{badge.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{badge.sublabel}</p>
              </motion.div>
            ))}
          </div>

          {/* Certifications bar */}
          {showCertifications && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-6 flex flex-wrap items-center justify-center gap-6 text-muted-foreground"
            >
              {certifications.map((cert, index) => (
                <div key={index} className="flex items-center gap-2">
                  <cert.icon className="w-4 h-4 text-primary" />
                  <span className="text-xs">{cert.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>
    );
  }

  // Horizontal scrolling variant (default)
  return (
    <section className="py-6 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 overflow-hidden">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Trust badges row */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {trustBadges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-full ${badge.bgColor} flex items-center justify-center`}>
                <badge.icon className={`w-5 h-5 ${badge.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">{badge.label}</p>
                <p className="text-xs text-muted-foreground">{badge.sublabel}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Certifications line */}
        {showCertifications && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-center gap-6"
          >
            {certifications.map((cert, index) => (
              <div key={index} className="flex items-center gap-2 text-muted-foreground">
                <cert.icon className="w-4 h-4 text-primary/70" />
                <span className="text-xs">{cert.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default TrustBadgesSection;
