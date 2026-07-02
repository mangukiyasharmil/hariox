import { motion } from "framer-motion";
import { TrendingDown, Shield, Clock, Award, CheckCircle } from "lucide-react";

const reasons = [
{
  icon: TrendingDown,
  title: "Lowest Interest Rates",
  description: "Compare rates from 50+ banks and NBFCs to find the best deal. Save lakhs in interest payments."
},
{
  icon: Shield,
  title: "100% Transparent",
  description: "No hidden charges, no processing surprises. Complete fee disclosure before you apply."
},
{
  icon: Clock,
  title: "Quick Processing",
  description: "From application to disbursement in as little as 48 hours. No unnecessary delays."
},
{
  icon: Award,
  title: "Expert Guidance",
  description: "Dedicated relationship managers to help you choose the right loan product."
}];


const FinanceWhyChoose = () => {
  return (
    <section id="about" className="py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}>
            
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a365d] mb-6" style={{ fontFamily: "'Georgia', serif" }}>
              Why Choose <span className="text-[#c9a227]">Hariox Finance</span>?
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">We're not just another loan company. We're your financial partner committed to getting you the best instant personal loan best possible rates with complete transparency. Our technology-driven approach ensures you compare offers from multiple banks and make an informed decision.



            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 p-6 bg-[#1a365d]/5 border border-[#1a365d]/10">
              <div className="text-center">
                <div className="text-2xl lg:text-3xl font-bold text-[#c9a227]" style={{ fontFamily: "'Georgia', serif" }}>
                  50+
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Bank Partners</div>
              </div>
              <div className="text-center border-x border-[#1a365d]/10">
                <div className="text-2xl lg:text-3xl font-bold text-[#1a365d]" style={{ fontFamily: "'Georgia', serif" }}>
                  8.5%
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Lowest Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl lg:text-3xl font-bold text-[#c9a227]" style={{ fontFamily: "'Georgia', serif" }}>
                  0
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Hidden Fees</div>
              </div>
            </div>
          </motion.div>

          {/* Right - Features */}
          <div className="grid sm:grid-cols-2 gap-6">
            {reasons.map((reason, idx) =>
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white border-2 border-gray-100 p-6 hover:border-[#c9a227]/30 hover:shadow-lg transition-all">
              
                <div className="w-12 h-12 bg-gradient-to-br from-[#1a365d] to-[#0d1b2a] flex items-center justify-center mb-4">
                  <reason.icon className="w-6 h-6 text-[#c9a227]" />
                </div>
                <h3 className="font-bold text-[#1a365d] mb-2">{reason.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{reason.description}</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>);

};

export default FinanceWhyChoose;