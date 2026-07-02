import { motion } from "framer-motion";
import { Play, Star, Quote } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const successStories = [
  {
    id: 1,
    name: "Rahul Sharma",
    location: "Mumbai, Maharashtra",
    loanType: "Business Loan",
    amount: "₹15 Lakhs",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    quote: "Capital Hariox helped me expand my restaurant chain. The process was incredibly smooth and the team was very supportive throughout.",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
  },
  {
    id: 2,
    name: "Priya Patel",
    location: "Ahmedabad, Gujarat",
    loanType: "Education Loan",
    amount: "₹8 Lakhs",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    quote: "Thanks to Capital Hariox, my daughter is now studying at a top university. The low interest rate made it affordable for our family.",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
  },
  {
    id: 3,
    name: "Amit Singh",
    location: "Delhi NCR",
    loanType: "Personal Loan",
    amount: "₹5 Lakhs",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    quote: "Got my personal loan approved in just 24 hours! The online process was so convenient. Highly recommend Capital Hariox.",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
  },
  {
    id: 4,
    name: "Sneha Reddy",
    location: "Hyderabad, Telangana",
    loanType: "Marriage Loan",
    amount: "₹10 Lakhs",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    quote: "My dream wedding became a reality thanks to Capital Hariox. The team understood my needs and provided the best solution.",
    rating: 5,
    videoId: "dQw4w9WgXcQ",
  },
];

const CapitalSuccessStories = () => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-white to-emerald-50/50">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold mb-4">
            Success Stories
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Real People, Real{" "}
            <span className="text-emerald-600">Success</span>
          </h2>
          <p className="text-gray-600">
            Join thousands of satisfied customers who achieved their financial goals with Capital Hariox
          </p>
        </motion.div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {successStories.map((story, index) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Avatar with Play Button */}
                <div className="relative flex-shrink-0">
                  <img
                    src={story.image}
                    alt={story.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200"
                  />
                  <button
                    onClick={() => setSelectedVideo(story.videoId)}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white hover:bg-emerald-600 transition-colors shadow-lg"
                  >
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{story.name}</h4>
                    <div className="flex">
                      {[...Array(story.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{story.location}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                      {story.loanType}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {story.amount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quote */}
              <div className="mt-4 relative">
                <Quote className="absolute -top-1 -left-1 w-6 h-6 text-emerald-200" />
                <p className="text-gray-600 text-sm leading-relaxed pl-5 italic">
                  "{story.quote}"
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-8 max-w-4xl mx-auto"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
            <div>
              <p className="text-3xl font-bold">35,000+</p>
              <p className="text-sm text-white/80">Happy Customers</p>
            </div>
            <div>
              <p className="text-3xl font-bold">₹500Cr+</p>
              <p className="text-sm text-white/80">Loans Disbursed</p>
            </div>
            <div>
              <p className="text-3xl font-bold">4.8/5</p>
              <p className="text-sm text-white/80">Average Rating</p>
            </div>
            <div>
              <p className="text-3xl font-bold">24 Hrs</p>
              <p className="text-sm text-white/80">Avg. Approval Time</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Video Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="aspect-video bg-black">
            {selectedVideo && (
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default CapitalSuccessStories;