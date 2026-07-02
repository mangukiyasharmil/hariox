import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Rajesh Sharma",
    role: "Business Owner, Mumbai",
    content: "Got my business loan approved from Capital Hariox in just 12 hours! The process was incredibly smooth and the team was very helpful throughout.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Priya Patel",
    role: "IT Professional, Bangalore",
    content: "Best experience with Capital Hariox! Applied for a personal loan and got the money in my account the same day. Highly recommended!",
    rating: 5,
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Amit Kumar",
    role: "Doctor, Delhi",
    content: "Transparent process with no hidden charges at Capital Hariox. The EMI calculator helped me plan my finances perfectly.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Sneha Gupta",
    role: "Teacher, Pune",
    content: "Was skeptical at first, but Capital Hariox exceeded my expectations. Quick approval and excellent customer service.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
  },
];

const CapitalTestimonials = () => {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-sm font-semibold mb-4">
            Customer Stories
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Loved by{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              35,000+ Customers
            </span>
          </h2>
          <p className="text-lg text-gray-600">
            See what our customers have to say about their experience with us.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-50 rounded-2xl p-6 lg:p-8 border border-gray-100 relative"
            >
              {/* Quote Icon */}
              <Quote className="absolute top-6 right-6 w-8 h-8 text-emerald-100" />

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Content */}
              <p className="text-gray-700 leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <img 
                  src={testimonial.image} 
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                />
                <div>
                  <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 flex flex-wrap justify-center gap-8 lg:gap-16"
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">4.9★</div>
            <div className="text-gray-500">Google Rating</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">35K+</div>
            <div className="text-gray-500">Happy Customers</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">98%</div>
            <div className="text-gray-500">Approval Rate</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CapitalTestimonials;
