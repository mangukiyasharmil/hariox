import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Phone, CheckCircle, Star, X, Shield, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import FinanceApplicationModal from "./FinanceApplicationModal";

const teamMembers = [
  {
    name: "Arun Mehta",
    role: "Senior Loan Advisor",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face",
    experience: "10+ Years",
    specialty: "Home Loans",
  },
  {
    name: "Sneha Kapoor",
    role: "Rate Comparison Expert",
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=face",
    experience: "7+ Years",
    specialty: "Business Loans",
  },
  {
    name: "Vikram Singh",
    role: "Documentation Head",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    experience: "8+ Years",
    specialty: "Personal Loans",
  },
];

const customerStories = [
  {
    name: "Rajesh K.",
    location: "Mumbai",
    amount: "₹25,00,000",
    purpose: "Business Expansion",
    savedAmount: "₹3.2 Lakhs",
    quote: "Found the lowest rate from 50+ banks in minutes!",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Meera P.",
    location: "Delhi",
    amount: "₹15,00,000",
    purpose: "Home Purchase",
    savedAmount: "₹2.1 Lakhs",
    quote: "Transparent pricing with zero hidden charges.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
  },
];

const FinanceHumanSection = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <>
      <section className="py-16 lg:py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left - Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[#1a365d]/20 bg-[#1a365d]/5 text-[#1a365d] text-sm font-semibold mb-6">
                <WhatsAppIcon size="sm" className="text-[#25D366]" />
                REAL PEOPLE, REAL SUPPORT
              </span>
              
              <h2 className="text-3xl lg:text-4xl font-bold text-[#1a365d] mb-6" style={{ fontFamily: "'Georgia', serif" }}>
                Meet Your Dedicated 
                <span className="block text-[#c9a227]">Rate Comparison Experts</span>
              </h2>
              
              <p className="text-gray-600 mb-8">
                Our expert team compares rates from 50+ RBI-registered banks to find you the lowest interest rate. 
                Get personalized support with 100% transparent pricing.
              </p>

              {/* Team Members */}
              <div className="space-y-4 mb-8">
                {teamMembers.map((member, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ x: 5, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                    className="flex items-center gap-4 p-4 bg-gray-50 border-2 border-gray-100 hover:border-[#c9a227]/30 transition-all"
                  >
                    <img 
                      src={member.image} 
                      alt={member.name}
                      className="w-14 h-14 object-cover border-2 border-[#c9a227]/20 shadow-md"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-[#1a365d]" style={{ fontFamily: "'Georgia', serif" }}>{member.name}</h4>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-[#c9a227]/10 text-[#c9a227] text-xs font-bold border border-[#c9a227]/20">
                        {member.experience}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{member.specialty}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-[#c9a227] to-[#daa520] hover:from-[#b8941f] hover:to-[#c9a227] text-[#1a365d] font-bold"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Talk to an Expert
                </Button>
                <Button 
                  variant="outline" 
                  className="border-2 border-[#1a365d]/20 text-[#1a365d] hover:bg-[#1a365d]/5"
                  onClick={() => setIsVideoOpen(true)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Watch Success Stories
                </Button>
              </div>
            </motion.div>

            {/* Right - Customer Stories Visual */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Main Video/Image Placeholder with Gradient */}
              <div 
                className="relative overflow-hidden aspect-[4/3] bg-gradient-to-br from-[#f8f5f0] via-[#fff] to-[#f8f5f0] border-2 border-gray-200 shadow-2xl cursor-pointer group"
                onClick={() => setIsVideoOpen(true)}
              >
                {/* Background image */}
                <img 
                  src="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=600&fit=crop"
                  alt="Happy customer"
                  className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a365d]/60 via-transparent to-transparent" />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-20 h-20 bg-white shadow-lg flex items-center justify-center group-hover:bg-[#c9a227] transition-colors"
                  >
                    <Play className="w-8 h-8 text-[#1a365d] ml-1" />
                  </motion.div>
                </div>
                
                {/* Decorative Elements */}
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="absolute top-6 left-6 bg-white p-3 shadow-lg border-l-4 border-[#c9a227]"
                >
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-bold text-[#1a365d]">Lowest Rate Found!</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">8.5% p.a. from HDFC Bank</p>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="absolute bottom-6 right-6 bg-white p-3 shadow-lg"
                >
                  <div className="flex items-center gap-1 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-4 h-4 text-[#c9a227] fill-[#c9a227]" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">Rated by 45,000+ customers</p>
                </motion.div>

                {/* Trust badge */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="absolute top-6 right-6 bg-[#1a365d] text-white p-3 shadow-lg"
                >
                  <Shield className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-[10px] font-semibold text-center">RBI<br/>COMPLIANT</p>
                </motion.div>
              </div>

              {/* Floating Customer Story Cards */}
              {customerStories.map((story, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + idx * 0.2 }}
                  className={`absolute ${idx === 0 ? '-left-4 top-1/4' : '-right-4 bottom-1/4'} w-64 bg-white p-4 shadow-xl border-2 border-gray-100 hidden lg:block hover:border-[#c9a227]/30 transition-all`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img 
                      src={story.image} 
                      alt={story.name}
                      className="w-10 h-10 object-cover border-2 border-[#c9a227]/30 shadow-sm"
                    />
                    <div>
                      <h4 className="font-bold text-[#1a365d] text-sm">{story.name}</h4>
                      <p className="text-xs text-gray-500">{story.location}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 italic mb-3">"{story.quote}"</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#1a365d] font-semibold">{story.amount}</span>
                    <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5">Saved {story.savedAmount}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <FinanceApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Video Dialog */}
      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#1a365d] border-0">
          <div className="relative aspect-video">
            <button 
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Success Stories Video Content */}
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-[#1a365d] to-[#0d1b2a]">
              <div className="text-center text-white p-8">
                <div className="w-20 h-20 mx-auto mb-6 bg-[#c9a227]/20 flex items-center justify-center">
                  <Play className="w-10 h-10 text-[#c9a227]" />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Georgia', serif" }}>Customer Success Stories</h3>
                <p className="text-white/70 mb-6 max-w-md mx-auto">
                  Hear from our 45,000+ satisfied customers who found the lowest loan rates with Finance Hariox.
                </p>
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                  {customerStories.map((story, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white/10 px-4 py-2">
                      <img 
                        src={story.image} 
                        alt={story.name}
                        className="w-8 h-8 object-cover border-2 border-[#c9a227]/30"
                      />
                      <div className="text-left">
                        <p className="text-sm font-medium">{story.name}</p>
                        <p className="text-xs text-green-400">Saved {story.savedAmount}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-white/50 text-sm mt-8">
                  Video testimonials coming soon!
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FinanceHumanSection;
