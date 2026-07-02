import { motion } from "framer-motion";
import { Star, Quote, Play, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const testimonials = [
  {
    name: "Rajesh Kumar",
    role: "Business Owner",
    location: "Mumbai",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    text: "Got the best interest rate of 9.5% for my business loan. The comparison feature helped me save lakhs in interest payments.",
    loanType: "Business Loan",
    amount: "₹35 Lakhs",
    hasVideo: true,
  },
  {
    name: "Priya Sharma",
    role: "IT Professional",
    location: "Bangalore",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    text: "Transparent process from start to finish. No hidden charges, no surprises. Finally, a finance company I can trust.",
    loanType: "Home Loan",
    amount: "₹75 Lakhs",
    hasVideo: true,
  },
  {
    name: "Amit Patel",
    role: "Doctor",
    location: "Ahmedabad",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    text: "Compared offers from 12 banks and got the lowest rate. Professional service and excellent customer support.",
    loanType: "Personal Loan",
    amount: "₹15 Lakhs",
    hasVideo: false,
  },
  {
    name: "Neha Reddy",
    role: "Entrepreneur",
    location: "Hyderabad",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    text: "Finance Hariox found me a rate 2% lower than what my bank offered. Saved over ₹4 lakhs in total interest!",
    loanType: "Business Loan",
    amount: "₹50 Lakhs",
    hasVideo: true,
  },
  {
    name: "Vikram Joshi",
    role: "Government Employee",
    location: "Delhi",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    text: "Quick approval in just 24 hours. The team was very professional and guided me through every step.",
    loanType: "Home Loan",
    amount: "₹45 Lakhs",
    hasVideo: false,
  },
  {
    name: "Sunita Agarwal",
    role: "Teacher",
    location: "Jaipur",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    text: "Got my daughter's education loan at the lowest rate. The team understood our needs perfectly.",
    loanType: "Education Loan",
    amount: "₹12 Lakhs",
    hasVideo: true,
  },
];

const FinanceTestimonials = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <>
      <section className="py-16 lg:py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 border-2 border-[#c9a227] rotate-45" />
          <div className="absolute bottom-10 right-10 w-24 h-24 border-2 border-[#1a365d] -rotate-12" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 lg:mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[#c9a227]/30 bg-[#c9a227]/10 text-[#c9a227] text-sm font-semibold mb-4">
              <BadgeCheck className="w-4 h-4" />
              VERIFIED REVIEWS
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-[#1a365d] mb-4" style={{ fontFamily: "'Georgia', serif" }}>
              What Our Clients Say
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Join 45,000+ satisfied customers who found the best rates with Finance Hariox
            </p>
          </motion.div>

          {/* Testimonials Grid - 3 columns */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((testimonial, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5, boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}
                className="bg-white border-2 border-gray-100 p-6 lg:p-8 relative hover:border-[#c9a227]/30 transition-all group"
              >
                {/* Quote Icon */}
                <div className="absolute top-6 right-6 w-10 h-10 bg-[#c9a227]/10 flex items-center justify-center">
                  <Quote className="w-5 h-5 text-[#c9a227]" />
                </div>

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#c9a227] fill-[#c9a227]" />
                  ))}
                </div>

                {/* Text */}
                <p className="text-gray-600 mb-6 leading-relaxed italic">
                  "{testimonial.text}"
                </p>

                {/* Loan Info */}
                <div className="flex flex-wrap gap-2 mb-6 pb-6 border-b border-gray-100">
                  <div className="px-3 py-1 bg-[#1a365d]/5 text-[#1a365d] text-xs font-semibold uppercase tracking-wider">
                    {testimonial.loanType}
                  </div>
                  <div className="px-3 py-1 bg-[#c9a227]/10 text-[#c9a227] text-xs font-bold">
                    {testimonial.amount}
                  </div>
                </div>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="w-12 h-12 object-cover border-2 border-[#c9a227]/20"
                    />
                    {testimonial.hasVideo && (
                      <button 
                        onClick={() => setIsVideoOpen(true)}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-r from-[#c9a227] to-[#daa520] flex items-center justify-center text-[#1a365d] shadow-lg hover:scale-110 transition-transform"
                      >
                        <Play className="w-3 h-3 ml-0.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1a365d]">{testimonial.name}</h4>
                    <p className="text-sm text-gray-500">{testimonial.role}, {testimonial.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Trust Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-[#1a365d] text-white">
              <BadgeCheck className="w-5 h-5 text-[#c9a227]" />
              <span className="text-sm font-medium">All reviews are from verified Finance Hariox customers</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Dialog */}
      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-0">
          <div className="aspect-video bg-[#1a365d]">
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-white p-8">
                <div className="w-20 h-20 mx-auto mb-6 bg-[#c9a227]/20 flex items-center justify-center">
                  <Play className="w-10 h-10 text-[#c9a227]" />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Georgia', serif" }}>Customer Video Testimonials</h3>
                <p className="text-white/70 max-w-md mx-auto">
                  Video testimonials from our happy customers coming soon!
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FinanceTestimonials;
