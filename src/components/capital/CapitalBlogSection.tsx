import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Clock, BookOpen, TrendingUp, Lightbulb, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string | null;
}

// Default blog content if no posts exist - with current date
const getDefaultBlogPosts = () => {
  const today = new Date().toISOString();
  return [
    {
      id: "1",
      title: "5 Smart Tips to Improve Your CIBIL Score in 2026",
      slug: "improve-cibil-score-2026",
      excerpt: "Your CIBIL score is crucial for loan approval at Capital Hariox. Learn proven strategies to boost your credit score from 650 to 750+ in just 6 months.",
      cover_image: null,
      published_at: today,
      icon: TrendingUp,
      color: "from-emerald-400 to-teal-500",
    },
    {
      id: "2",
      title: "Personal Loan vs Credit Card: Which is Better for You?",
      slug: "personal-loan-vs-credit-card",
      excerpt: "Confused between taking a personal loan from Capital Hariox or using your credit card? Here's a detailed comparison to help you make the right choice.",
      cover_image: null,
      published_at: today,
      icon: CreditCard,
      color: "from-blue-400 to-indigo-500",
    },
    {
      id: "3",
      title: "How to Calculate Your Loan Eligibility: A Complete Guide",
      slug: "calculate-loan-eligibility",
      excerpt: "Banks consider multiple factors before approving your loan. Understand the eligibility criteria at Capital Hariox and maximize your approval chances.",
      cover_image: null,
      published_at: today,
      icon: Lightbulb,
      color: "from-amber-400 to-orange-500",
    },
  ];
};

const CapitalBlogSection = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const companyId = localStorage.getItem("publicCompanyId");
      let query = supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, cover_image, published_at")
        .eq("status", "published");

      // Filter by current company + global posts
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const { data, error } = await query
        .order("display_order", { ascending: true })
        .limit(3);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayPosts = posts.length > 0 ? posts : getDefaultBlogPosts();

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-4">
            <BookOpen className="w-4 h-4" />
            Financial Insights
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Learn & Grow Your Finances
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Expert tips and guides to help you make smarter financial decisions
          </p>
        </motion.div>

        {/* Blog Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {displayPosts.map((post, idx) => {
            const defaultPosts = getDefaultBlogPosts();
            const defaultPost = defaultPosts[idx];
            const IconComponent = defaultPost?.icon || BookOpen;
            const colorClass = defaultPost?.color || "from-gray-400 to-gray-500";
            
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
                className="group"
              >
                <Link to={posts.length > 0 ? `/blog/${post.slug}` : "#"} className="block">
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300">
                    {/* Image or Gradient Header */}
                    <div className="relative h-40 overflow-hidden">
                      {post.cover_image ? (
                        <img
                          src={post.cover_image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
                          <IconComponent className="w-16 h-16 text-white/80" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>
                    
                    {/* Content */}
                    <div className="p-5">
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(post.published_at || new Date()).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          3 min read
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                        {post.title}
                      </h3>
                      
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {post.excerpt}
                      </p>
                      
                      <div className="flex items-center text-emerald-600 text-sm font-medium group-hover:gap-2 transition-all">
                        Read Article
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link to="/blog">
            <Button variant="outline" size="lg" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              View All Articles
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CapitalBlogSection;
