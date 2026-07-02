import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ChevronLeft, ChevronRight, Star, Quote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Testimonial {
  id: string;
  name: string;
  location: string;
  loanAmount: string;
  loanType: string;
  rating: number;
  quote: string;
  videoUrl?: string;
  thumbnailUrl: string;
  avatar?: string;
}

interface VideoTestimonialCarouselProps {
  variant?: "credit" | "capital";
  className?: string;
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Rajesh Kumar",
    location: "Mumbai, Maharashtra",
    loanAmount: "₹5,00,000",
    loanType: "Personal Loan",
    rating: 5,
    quote: "I was struggling with multiple loan rejections. Hariox got my loan approved in just 18 hours! The team was incredibly supportive.",
    thumbnailUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
  },
  {
    id: "2",
    name: "Priya Sharma",
    location: "Delhi NCR",
    loanAmount: "₹8,00,000",
    loanType: "Business Loan",
    rating: 5,
    quote: "As a woman entrepreneur, getting a business loan was challenging. Hariox made it possible with minimal documentation. Highly recommend!",
    thumbnailUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop",
    avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&h=100&fit=crop&crop=face"
  },
  {
    id: "3",
    name: "Amit Patel",
    location: "Ahmedabad, Gujarat",
    loanAmount: "₹3,50,000",
    loanType: "Education Loan",
    rating: 5,
    quote: "My son's education dream came true thanks to Hariox. The interest rate was the lowest I could find, and the process was smooth.",
    thumbnailUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=300&fit=crop",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
  },
  {
    id: "4",
    name: "Sunita Devi",
    location: "Jaipur, Rajasthan",
    loanAmount: "₹2,00,000",
    loanType: "Gold Loan",
    rating: 5,
    quote: "Emergency fund for my daughter's wedding. Hariox disbursed the amount same day. Forever grateful!",
    thumbnailUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=300&fit=crop",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face"
  },
  {
    id: "5",
    name: "Mohammed Farhan",
    location: "Hyderabad, Telangana",
    loanAmount: "₹10,00,000",
    loanType: "Home Loan",
    rating: 5,
    quote: "Finally bought my dream home! Hariox's team guided me through every step. The best decision I ever made.",
    thumbnailUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=300&fit=crop",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face"
  },
];

const VideoTestimonialCarousel = ({ variant = "credit", className = "" }: VideoTestimonialCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const current = testimonials[currentIndex];

  const gradientClass = variant === "capital"
    ? "from-emerald-500 to-teal-500"
    : "from-primary to-secondary";

  const bgClass = variant === "capital"
    ? "bg-gradient-to-br from-emerald-50 to-teal-50"
    : "bg-gradient-to-br from-primary/5 to-secondary/5";

  return (
    <section className={`py-16 lg:py-24 ${bgClass} ${className}`}>
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className={`inline-block px-4 py-1.5 rounded-full bg-gradient-to-r ${gradientClass} text-white text-sm font-medium mb-4`}>
            Customer Success Stories
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Real People, Real Results
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join thousands of happy customers who achieved their financial goals with us
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Video/Image Card */}
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl group cursor-pointer"
              onClick={() => current.videoUrl && setShowVideoModal(true)}
            >
              <img
                src={current.thumbnailUrl}
                alt={current.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              {/* Play Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-r ${gradientClass} flex items-center justify-center shadow-lg`}
              >
                <Play className="w-6 h-6 text-white ml-1" fill="white" />
              </motion.button>

              {/* Loan Info Badge */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-3">
                  <img
                    src={current.avatar}
                    alt={current.name}
                    className="w-12 h-12 rounded-full border-2 border-white object-cover"
                  />
                  <div className="text-white">
                    <p className="font-semibold">{current.name}</p>
                    <p className="text-sm text-white/80">{current.location}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quote Card */}
            <motion.div
              key={`quote-${current.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl p-6 lg:p-8 shadow-xl relative"
            >
              <Quote className={`absolute top-6 right-6 w-10 h-10 text-${variant === "capital" ? "emerald" : "primary"}-100`} />
              
              {/* Rating */}
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: current.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-lg lg:text-xl text-foreground font-medium mb-6 leading-relaxed">
                "{current.quote}"
              </blockquote>

              {/* Loan Details */}
              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-sm text-muted-foreground">Loan Amount</p>
                  <p className={`text-xl font-bold bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
                    {current.loanAmount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Type</p>
                  <p className="text-lg font-semibold text-foreground">{current.loanType}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="icon"
              onClick={prevSlide}
              className="rounded-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    idx === currentIndex
                      ? `bg-gradient-to-r ${gradientClass} w-8`
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={nextSlide}
              className="rounded-full"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl p-0 bg-black">
          <button
            onClick={() => setShowVideoModal(false)}
            className="absolute top-4 right-4 z-10 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          {current.videoUrl ? (
            <video
              src={current.videoUrl}
              controls
              autoPlay
              className="w-full aspect-video"
            />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center text-white">
              <div className="text-center">
                <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Video testimonial coming soon</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default VideoTestimonialCarousel;
