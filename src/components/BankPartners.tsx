import { motion } from "framer-motion";
import kotakLogo from "@/assets/banks/kotak.png";
import pnbLogo from "@/assets/banks/pnb.png";
import yesBankLogo from "@/assets/banks/yes-bank.png";

type Bank = { name: string; short: string; logo?: string; color: string };

const banks: Bank[] = [
  { name: "HDFC Bank", short: "HDFC", color: "text-[#004C8F]" },
  { name: "ICICI Bank", short: "ICICI", color: "text-[#F37920]" },
  { name: "State Bank of India", short: "SBI", color: "text-[#22409A]" },
  { name: "Axis Bank", short: "AXIS", color: "text-[#97144D]" },
  { name: "Kotak Mahindra Bank", short: "KOTAK", logo: kotakLogo, color: "text-[#ED1C24]" },
  { name: "Punjab National Bank", short: "PNB", logo: pnbLogo, color: "text-[#A0142F]" },
  { name: "Yes Bank", short: "YES", logo: yesBankLogo, color: "text-[#00204E]" },
  { name: "Bajaj Finserv", short: "BAJAJ", color: "text-[#003DA5]" },
  { name: "IDFC First Bank", short: "IDFC", color: "text-[#9F1B32]" },
];

const BankPartners = () => {
  return (
    <section className="py-10 bg-muted/30 border-b border-border overflow-hidden">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Our Banking Partners
          </p>
        </motion.div>
      </div>

      {/* Scrolling marquee effect */}
      <div className="relative">
        <div className="flex animate-marquee gap-6 md:gap-8">
          {[...banks, ...banks].map((bank, index) => (
            <div
              key={`${bank.name}-${index}`}
              className="flex-shrink-0 w-32 h-20 md:w-40 md:h-24 bg-white rounded-2xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center p-4 border border-border"
              title={bank.name}
            >
              {bank.logo ? (
                <img
                  src={bank.logo}
                  alt={bank.name}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className={`text-lg md:text-xl font-extrabold tracking-tight ${bank.color}`}>
                  {bank.short}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-6 lg:px-8 mt-6">
        <p className="text-center text-xs text-muted-foreground">
          *We work with 50+ banks and NBFCs to get you the best rates
        </p>
      </div>
    </section>
  );
};

export default BankPartners;
