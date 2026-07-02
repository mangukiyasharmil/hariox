import { motion } from "framer-motion";
import kotakLogo from "@/assets/banks/kotak.png";
import pnbLogo from "@/assets/banks/pnb.png";
import yesBankLogo from "@/assets/banks/yes-bank.png";

type Partner = { name: string; short: string; logo?: string; color: string };

const partners: Partner[] = [
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

const FinanceBankPartners = () => {
  const allPartners = [...partners, ...partners];

  return (
    <section className="py-12 lg:py-16 bg-muted/50 border-y border-border">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <p className="text-primary text-sm font-semibold uppercase tracking-widest">
            Our Banking Partners
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Partnered with 50+ RBI-registered banks & NBFCs
          </p>
        </motion.div>

        <div className="relative overflow-hidden">
          <div className="flex animate-marquee gap-12 items-center">
            {allPartners.map((partner, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 h-16 w-36 flex items-center justify-center bg-white border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-all"
                title={partner.name}
              >
                {partner.logo ? (
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-h-12 max-w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className={`text-base font-extrabold tracking-tight ${partner.color}`}>
                    {partner.short}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinanceBankPartners;
