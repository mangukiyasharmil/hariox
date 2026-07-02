import { motion } from "framer-motion";
import { Home, Briefcase, Building2, GraduationCap, Car, Gem, Heart, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Home,
    title: "Home Loan",
    description: "Make your dream home a reality with competitive rates starting from 8.5% p.a.",
    rate: "8.5%",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50",
  },
  {
    icon: Briefcase,
    title: "Personal Loan",
    description: "Instant funds for any purpose. No collateral required, quick approval.",
    rate: "10.5%",
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-50",
  },
  {
    icon: Building2,
    title: "Business Loan",
    description: "Fuel your business growth with flexible repayment options up to 60 months.",
    rate: "12%",
    color: "from-purple-500 to-violet-500",
    bgColor: "bg-purple-50",
  },
  {
    icon: GraduationCap,
    title: "Education Loan",
    description: "Invest in your future. Study anywhere with loans up to ₹1 Crore.",
    rate: "9%",
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-50",
  },
  {
    icon: Car,
    title: "Vehicle Loan",
    description: "Drive home your dream car with up to 100% on-road funding.",
    rate: "8.75%",
    color: "from-rose-500 to-pink-500",
    bgColor: "bg-rose-50",
  },
  {
    icon: Gem,
    title: "Gold Loan",
    description: "Get instant cash against your gold at the best market rates.",
    rate: "7%",
    color: "from-yellow-500 to-amber-500",
    bgColor: "bg-yellow-50",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const CapitalServices = () => {
  return (
    <section id="services" className="py-20 lg:py-28 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-sm font-semibold mb-4">
            Our Products
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            One Solution for{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              All Your Needs
            </span>
          </h2>
          <p className="text-lg text-gray-600">
            Choose from our wide range of loan products. <strong className="text-emerald-600">Get instant personal loan online</strong> designed to meet every financial need.
          </p>
        </motion.div>

        {/* Services Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {services.map((service, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group bg-white rounded-2xl p-6 lg:p-8 border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-xl cursor-pointer"
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl ${service.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <service.icon className="w-7 h-7 text-gray-700" />
              </div>

              {/* Content */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-900">
                  {service.title}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${service.color} text-white`}>
                  {service.rate} p.a.
                </span>
              </div>
              
              <p className="text-gray-600 mb-6 leading-relaxed">
                {service.description}
              </p>

              {/* CTA */}
              <div className="flex items-center text-emerald-600 font-semibold group-hover:text-emerald-700">
                <span>Learn more</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default CapitalServices;
