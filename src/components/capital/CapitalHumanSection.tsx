import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Phone, CheckCircle, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import ApplicationModal from "../ApplicationModal";

const teamMembers = [
  {
    name: "Rahul Sharma",
    role: "Senior Loan Advisor",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    color: "from-emerald-400 to-teal-500",
    experience: "8+ Years",
  },
  {
    name: "Priya Patel",
    role: "Customer Success",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    color: "from-blue-400 to-indigo-500",
    experience: "6+ Years",
  },
  {
    name: "Amit Kumar",
    role: "Documentation Expert",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face",
    color: "from-amber-400 to-orange-500",
    experience: "5+ Years",
  },
];

const customerStories = [
  {
    name: "Vikram M.",
    location: "Mumbai",
    amount: "₹5,00,000",
    purpose: "Business Expansion",
    quote: "Got my loan approved from Capital Hariox in just 24 hours. The team was incredibly supportive!",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Sneha R.",
    location: "Delhi",
    amount: "₹3,00,000",
    purpose: "Marriage",
    quote: "Zero hassle experience with Capital Hariox. They guided me through every step.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
  },
];

const CapitalHumanSection = () => {
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
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-700 text-sm font-medium mb-6">
                <WhatsAppIcon size="sm" className="text-[#25D366]" />
                Real People, Real Support
              </span>
              
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                Meet Your Dedicated 
                <span className="block text-emerald-600">Loan Advisors</span>
              </h2>
              
              <p className="text-gray-600 mb-8">
                Our expert team is here to guide you through every step of your loan journey. 
                Get personalized support from real people who care about your financial goals.
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
                    whileHover={{ x: 5 }}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <img 
                      src={member.image} 
                      alt={member.name}
                      className="w-14 h-14 rounded-xl object-cover shadow-md"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{member.name}</h4>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200">
                        {member.experience}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Talk to an Advisor
                </Button>
                <Button 
                  variant="outline" 
                  className="border-gray-200"
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
                className="relative rounded-3xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 border border-gray-200 shadow-2xl cursor-pointer group"
                onClick={() => setIsVideoOpen(true)}
              >
                {/* Background image */}
                <img 
                  src="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=600&fit=crop"
                  alt="Happy customer"
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors"
                  >
                    <Play className="w-8 h-8 text-emerald-600 ml-1" />
                  </motion.div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-6 left-6 bg-white rounded-xl p-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-800">Loan Approved!</span>
                  </div>
                </div>
                
                <div className="absolute bottom-6 right-6 bg-white rounded-xl p-3 shadow-lg">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Rated by 35,000+ customers</p>
                </div>
              </div>

              {/* Floating Customer Story Cards */}
              {customerStories.map((story, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + idx * 0.2 }}
                  className={`absolute ${idx === 0 ? '-left-4 top-1/4' : '-right-4 bottom-1/4'} w-64 bg-white rounded-2xl p-4 shadow-xl border border-gray-100 hidden lg:block`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img 
                      src={story.image} 
                      alt={story.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{story.name}</h4>
                      <p className="text-xs text-gray-500">{story.location}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 italic mb-3">"{story.quote}"</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-600 font-semibold">{story.amount}</span>
                    <span className="text-gray-400">{story.purpose}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <ApplicationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Video Dialog */}
      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          <div className="relative aspect-video">
            <button 
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Success Stories Video Content */}
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-emerald-900 to-teal-900">
              <div className="text-center text-white p-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
                  <Play className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Customer Success Stories</h3>
                <p className="text-white/70 mb-6 max-w-md mx-auto">
                  Hear from our 35,000+ satisfied customers who got their loans approved within 24 hours.
                </p>
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                  {customerStories.map((story, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white/10 rounded-full px-4 py-2">
                      <img 
                        src={story.image} 
                        alt={story.name}
                        className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                      />
                      <div className="text-left">
                        <p className="text-sm font-medium">{story.name}</p>
                        <p className="text-xs text-white/60">{story.amount} - {story.purpose}</p>
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

export default CapitalHumanSection;
