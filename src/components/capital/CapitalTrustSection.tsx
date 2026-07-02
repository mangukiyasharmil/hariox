import { motion } from "framer-motion";
import { Shield, Award, Clock, Users, CheckCircle, Star, BadgeCheck, Wallet } from "lucide-react";

const trustFeatures = [
  {
    icon: Shield,
    title: "Bank-Level Security",
    description: "256-bit SSL encryption protects your data",
    color: "from-emerald-400 to-teal-500",
    bgColor: "from-emerald-50 to-teal-50",
  },
  {
    icon: BadgeCheck,
    title: "RBI Registered Partners",
    description: "All our lending partners are RBI approved",
    color: "from-blue-400 to-indigo-500",
    bgColor: "from-blue-50 to-indigo-50",
  },
  {
    icon: Clock,
    title: "24-Hour Disbursal",
    description: "Quick fund transfer to your account",
    color: "from-amber-400 to-orange-500",
    bgColor: "from-amber-50 to-orange-50",
  },
  {
    icon: Wallet,
    title: "No Hidden Charges",
    description: "Transparent fee structure with no surprises",
    color: "from-purple-400 to-pink-500",
    bgColor: "from-purple-50 to-pink-50",
  },
];

const achievements = [
  { number: "40,000+", label: "Crores Disbursed", icon: "💰" },
  { number: "35,000+", label: "Happy Customers", icon: "😊" },
  { number: "4.9/5", label: "Customer Rating", icon: "⭐" },
  { number: "24hrs", label: "Avg. Disbursal", icon: "⚡" },
];

const CapitalTrustSection = () => {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-4">
            <Award className="w-4 h-4" />
            Why Choose Us
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Your Trust is Our Priority
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We're committed to providing a safe, transparent, and hassle-free loan experience
          </p>
        </motion.div>

        {/* Colorful Trust Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-16">
          {trustFeatures.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className={`relative overflow-hidden rounded-2xl p-5 lg:p-6 bg-gradient-to-br ${feature.bgColor} border border-white shadow-lg`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1 text-sm lg:text-base">{feature.title}</h3>
              <p className="text-xs lg:text-sm text-gray-600">{feature.description}</p>
              
              {/* Decorative circle */}
              <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-gradient-to-br ${feature.color} opacity-10`} />
            </motion.div>
          ))}
        </div>

        {/* Achievements Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl p-6 lg:p-8"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {achievements.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0.9 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center text-white"
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-2xl lg:text-3xl font-bold">{item.number}</div>
                <div className="text-sm text-white/80">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Real People Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-4 bg-white rounded-2xl px-6 py-4 shadow-xl border border-gray-100">
            <div className="flex -space-x-3">
              {[
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face",
              ].map((src, i) => (
                <img 
                  key={i}
                  src={src}
                  alt={`Customer ${i + 1}`}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                />
              ))}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-medium border-2 border-white">
                +2K
              </div>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">2,847 customers</span> got loans from Capital Hariox today
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CapitalTrustSection;
