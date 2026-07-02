import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Clock, BookOpen, TrendingUp, Lightbulb, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyId } from "@/contexts/PublicCompanyContext";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string | null;
}

const getDefaultBlogPosts = () => {
  return [
    {
      id: "1",
      title: "5 Smart Tips to Improve Your CIBIL Score in 2026",
      slug: "improve-cibil-score-2026",
      excerpt: "Your CIBIL score is crucial for loan approval. Learn proven strategies to boost your credit score from 650 to 750+ in just 6 months.",
      cover_image: null,
      published_at: "2026-01-15T10:00:00Z",
      icon: TrendingUp,
      color: "from-blue-500 to-indigo-600",
    },
    {
      id: "2",
      title: "Personal Loan vs Credit Card: Which is Better?",
      slug: "personal-loan-vs-credit-card",
      excerpt: "Confused between taking a personal loan or using your credit card? Here's a detailed comparison to help you make the right choice.",
      cover_image: null,
      published_at: "2026-01-20T10:00:00Z",
      icon: CreditCard,
      color: "from-primary to-blue-600",
    },
    {
      id: "3",
      title: "How to Calculate Your Loan Eligibility: Complete Guide",
      slug: "calculate-loan-eligibility",
      excerpt: "Banks consider multiple factors before approving your loan. Understand the eligibility criteria and maximize your approval chances.",
      cover_image: null,
      published_at: "2026-02-01T10:00:00Z",
      icon: Lightbulb,
      color: "from-amber-500 to-orange-500",
    },
  ];
};

const BlogSection = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const companyId = getCurrentCompanyId();
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
      } catch {
        // use defaults
      } finally {
        setIsLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const displayPosts = posts.length > 0 ? posts : getDefaultBlogPosts();

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <BookOpen className="w-4 h-4" />
            Financial Insights
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Learn & Grow Your Finances
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Expert tips and guides to help you make smarter financial decisions
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {displayPosts.map((post, idx) => {
            const defaults = getDefaultBlogPosts();
            const def = defaults[idx];
            const Icon = def?.icon || BookOpen;
            const color = def?.color || "from-gray-400 to-gray-500";

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
                  <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="relative h-40 overflow-hidden">
                      {post.cover_image ? (
                        <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                          <Icon className="w-16 h-16 text-white/80" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(post.published_at || new Date()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          3 min read
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{post.excerpt}</p>
                      <div className="flex items-center text-primary text-sm font-medium group-hover:gap-2 transition-all">
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

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-10">
          <Link to="/blog">
            <Button variant="outline" size="lg">
              View All Articles
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default BlogSection;
