import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useParams, Link } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, Share2, Facebook, Twitter, Linkedin } from "lucide-react";
import { DomainHeader, DomainFooter } from "@/components/DomainAwareLayout";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  published_at: string | null;
  created_at: string;
  meta_description: string | null;
  meta_keywords: string | null;
}


interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string | null;
  created_at: string;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);

  useEffect(() => {
    if (slug) {
      fetchPost();
    }
  }, [slug]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (error) throw error;
      setPost(data);

      // Fetch related posts
      const { data: related } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, cover_image, published_at, created_at")
        .eq("status", "published")
        .neq("slug", slug)
        .order("display_order", { ascending: true })
        .limit(3);

      setRelatedPosts(related || []);
    } catch (error) {
      console.error("Error fetching post:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const estimateReadTime = (content: string) => {
    const wordsPerMinute = 200;
    const wordCount = content?.split(/\s+/).length || 0;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt || "",
          url: shareUrl,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <DomainHeader />
        <main className="pt-24 pb-16 container mx-auto px-4">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
            <p className="text-muted-foreground mb-8">
              The article you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/blog">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Blog
              </Button>
            </Link>
          </div>
        </main>
        <DomainFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={post.title}
        description={post.meta_description || post.excerpt || `Read ${post.title} for expert financial advice and tips.`}
        keywords={post.meta_keywords || "financial advice, loan tips, personal loan, home loan"}
        canonicalUrl={typeof window !== "undefined" ? `${window.location.origin}/blog/${post.slug}` : undefined}
        ogImage={post.cover_image || undefined}
      />
      <DomainHeader />

      <main className="pt-24 pb-16">
        {/* Hero/Cover Section */}
        {post.cover_image && (
          <div className="container mx-auto px-4 max-w-4xl pt-8">
            <div className="rounded-2xl overflow-hidden shadow-lg">
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full h-auto max-h-[500px] object-cover"
              />
            </div>
          </div>
        )}

        {/* Article Content */}
        <article className="container mx-auto px-4 max-w-4xl">
          <div className="pt-8">
            {/* Breadcrumb */}
            <Link
              to="/blog"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>

            {/* Title Card */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="text-lg text-muted-foreground mb-6">
                  {post.excerpt}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(post.published_at || post.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {estimateReadTime(post.content)} min read
                </div>
                <div className="flex-1" />
                {/* Share buttons */}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleShare}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <Facebook className="w-4 h-4 text-[#1877F2]" />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                  </a>
                  <a
                    href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(post.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                  </a>
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-foreground prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4 prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-5 prose-h3:mb-2 prose-p:text-base prose-p:leading-7 prose-p:mb-4 prose-p:text-muted-foreground prose-a:text-primary prose-a:underline prose-a:font-medium hover:prose-a:text-primary/80 prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4 prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-4 prose-li:mb-2 prose-li:text-muted-foreground prose-img:rounded-xl prose-img:shadow-md prose-img:my-6 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-strong:text-foreground">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    h1: ({ children }) => <h1 className="text-3xl font-bold mt-8 mb-4 text-foreground">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xl font-bold mt-5 mb-2 text-foreground">{children}</h3>,
                    a: ({ children, href, ...props }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                        {children}
                      </a>
                    ),
                  }}
                >{post.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="container mx-auto px-4 mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Related Articles</h2>
            <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
              {relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  to={`/blog/${related.slug}`}
                  className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="h-32 overflow-hidden">
                    {related.cover_image ? (
                      <img
                        src={related.cover_image}
                        alt={related.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                      {related.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="container mx-auto px-4 mt-16">
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Need a Loan?</h2>
            <p className="text-white/90 mb-6">
              Get fast approval with competitive interest rates. Apply now and get funds in 24 hours!
            </p>
            <Link to="/">
              <Button variant="secondary" size="lg">
                Apply Now
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <DomainFooter />
    </div>
  );
};

export default BlogPost;