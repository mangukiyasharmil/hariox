import { motion } from "framer-motion";
import { Play, Star, Quote, TrendingUp, Users, Clock, Award } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useInView } from "framer-motion";

// Animated Counter Hook
const useAnimatedCounter = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const hasStarted = useRef(false);

  useEffect(() => {
    if (isInView && !hasStarted.current) {
      hasStarted.current = true;
      let startTime: number;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeOutQuart * end));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [end, duration, isInView]);

  return { count, ref };
};

const successStories = [
  {
    id: 1,
    name: "Rakesh Mehta",
    location: "Mumbai, Maharashtra",
    loanType: "Business Loan",
    amount: "₹18 Lakhs",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face",
    quote: "Finance Hariox compared rates from 12 banks and got me the lowest at 9.5% p.a. Saved me over ₹2 lakhs in interest!",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
    interestRate: "9.5%",
  },
  {
    id: 2,
    name: "Anita Desai",
    location: "Pune, Maharashtra",
    loanType: "Home Loan",
    amount: "₹45 Lakhs",
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop&crop=face",
    quote: "Transparent process with zero hidden charges. The team showed me exactly how much I'd pay over the loan tenure.",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
    interestRate: "8.75%",
  },
  {
    id: 3,
    name: "Sunil Agarwal",
    location: "Delhi NCR",
    loanType: "Personal Loan",
    amount: "₹8 Lakhs",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    quote: "Got my personal loan approved in just 18 hours! The comparison feature helped me find the best rate instantly.",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
    interestRate: "10.5%",
  },
  {
    id: 4,
    name: "Kavita Sharma",
    location: "Bangalore, Karnataka",
    loanType: "Education Loan",
    amount: "₹12 Lakhs",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face",
    quote: "My son is now studying at IIT thanks to Finance Hariox. They found the best education loan rate for us.",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
    interestRate: "9.25%",
  },
];

const FinanceSuccessStories = () => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  
  // Animated counters
  const { count: customersCount, ref: customersRef } = useAnimatedCounter(45000, 2000);
  const { count: disbursedCount, ref: disbursedRef } = useAnimatedCounter(800, 2000);
  const { count: ratingCount, ref: ratingRef } = useAnimatedCounter(48, 2000);
  const { count: approvalCount, ref: approvalRef } = useAnimatedCounter(24, 1500);

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-[#f8f5f0] to-white relative overflow-hidden">
      {/* Decorative Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-20 right-10 w-64 h-64 border-2 border-[#c9a227] rotate-12" />
        <div className="absolute bottom-20 left-10 w-48 h-48 border-2 border-[#1a365d] -rotate-12" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[#c9a227]/30 bg-[#c9a227]/10 text-[#c9a227] text-sm font-semibold mb-4">
            <Star className="w-4 h-4" />
            SUCCESS STORIES
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a365d] mb-4" style={{ fontFamily: "'Georgia', serif" }}>
            Real People, Real{" "}
            <span className="text-[#c9a227]">Savings</span>
          </h2>
          <p className="text-gray-600">
            Join 45,000+ customers who found the best loan rates with Finance Hariox
          </p>
        </motion.div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12">
          {successStories.map((story, index) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border-2 border-gray-100 p-6 shadow-lg hover:shadow-xl hover:border-[#c9a227]/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                {/* Avatar with Play Button */}
                <div className="relative flex-shrink-0">
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={story.image}
                    alt={story.name}
                    className="w-16 h-16 object-cover border-2 border-[#c9a227]/30 shadow-md"
                  />
                  <button
                    onClick={() => setSelectedVideo(story.videoId)}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-r from-[#c9a227] to-[#daa520] flex items-center justify-center text-[#1a365d] hover:from-[#daa520] hover:to-[#c9a227] transition-all shadow-lg"
                  >
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-[#1a365d]" style={{ fontFamily: "'Georgia', serif" }}>{story.name}</h4>
                    <div className="flex">
                      {[...Array(story.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-[#c9a227] fill-[#c9a227]" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{story.location}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-[#1a365d]/10 text-[#1a365d] font-semibold">
                      {story.loanType}
                    </span>
                    <span className="text-xs px-2 py-1 bg-[#c9a227]/10 text-[#c9a227] font-bold">
                      {story.amount}
                    </span>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 font-bold">
                      {story.interestRate} p.a.
                    </span>
                  </div>
                </div>
              </div>

              {/* Quote */}
              <div className="mt-4 relative">
                <Quote className="absolute -top-1 -left-1 w-6 h-6 text-[#c9a227]/30" />
                <p className="text-gray-600 text-sm leading-relaxed pl-5 italic">
                  "{story.quote}"
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Animated Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-[#1a365d] via-[#234e7c] to-[#1a365d] p-8 max-w-4xl mx-auto relative overflow-hidden"
        >
          {/* Decorative gold line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
            <motion.div 
              ref={customersRef}
              whileHover={{ scale: 1.05 }}
              className="cursor-default"
            >
              <Users className="w-8 h-8 mx-auto mb-2 text-[#c9a227]" />
              <p className="text-3xl font-bold">{customersCount.toLocaleString()}+</p>
              <p className="text-sm text-white/70">Happy Customers</p>
            </motion.div>
            <motion.div 
              ref={disbursedRef}
              whileHover={{ scale: 1.05 }}
              className="cursor-default"
            >
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-[#c9a227]" />
              <p className="text-3xl font-bold">₹{disbursedCount}Cr+</p>
              <p className="text-sm text-white/70">Loans Disbursed</p>
            </motion.div>
            <motion.div 
              ref={ratingRef}
              whileHover={{ scale: 1.05 }}
              className="cursor-default"
            >
              <Award className="w-8 h-8 mx-auto mb-2 text-[#c9a227]" />
              <p className="text-3xl font-bold">{(ratingCount / 10).toFixed(1)}/5</p>
              <p className="text-sm text-white/70">Average Rating</p>
            </motion.div>
            <motion.div 
              ref={approvalRef}
              whileHover={{ scale: 1.05 }}
              className="cursor-default"
            >
              <Clock className="w-8 h-8 mx-auto mb-2 text-[#c9a227]" />
              <p className="text-3xl font-bold">{approvalCount} Hrs</p>
              <p className="text-sm text-white/70">Avg. Approval</p>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Video Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-0">
          <div className="aspect-video bg-[#1a365d]">
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-white p-8">
                <div className="w-20 h-20 mx-auto mb-6 bg-[#c9a227]/20 flex items-center justify-center">
                  <Play className="w-10 h-10 text-[#c9a227]" />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Georgia', serif" }}>Customer Success Stories</h3>
                <p className="text-white/70 mb-6 max-w-md mx-auto">
                  Hear from our 45,000+ satisfied customers who got the best loan rates.
                </p>
                <p className="text-white/50 text-sm">
                  Video testimonials coming soon!
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default FinanceSuccessStories;
