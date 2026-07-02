import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Suresh Kumar",
    location: "Mumbai",
    initials: "SK",
    rating: 5,
    text: "Got ₹5 lakh approved in just 18 hours! The team was incredibly helpful and professional. Best loan service I've ever used.",
    loanType: "Personal Loan",
  },
  {
    name: "Priya Sharma",
    location: "Delhi",
    initials: "PS",
    rating: 5,
    text: "Hariox made my dream home a reality. The interest rates were the lowest I found anywhere, and the process was seamless.",
    loanType: "Home Loan",
  },
  {
    name: "Rahul Verma",
    location: "Bangalore",
    initials: "RV",
    rating: 5,
    text: "As a small business owner, getting a loan was always tough. Hariox approved my business loan when banks rejected me multiple times.",
    loanType: "Business Loan",
  },
  {
    name: "Anjali Patel",
    location: "Ahmedabad",
    initials: "AP",
    rating: 5,
    text: "Excellent service! The team guided me through every step. Got my education loan for my daughter's studies abroad with minimal documentation.",
    loanType: "Education Loan",
  },
];

const Testimonials = () => {
  return (
    <section id="testimonials" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
            Testimonials
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            What Our <span className="text-gradient-brand">Clients Say</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join 50,000+ satisfied customers who trusted us with their financial needs.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-card rounded-2xl p-8 border border-border hover:shadow-lg transition-all duration-300 relative"
            >
              {/* Quote Icon */}
              <div className="absolute top-6 right-6 text-muted/20">
                <Quote className="w-12 h-12" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                ))}
              </div>

              {/* Text */}
              <p className="text-foreground text-lg leading-relaxed mb-6">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full gradient-brand flex items-center justify-center text-primary-foreground font-bold">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.location} • {testimonial.loanType}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
