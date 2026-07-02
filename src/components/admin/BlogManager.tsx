import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Eye, Image, Calendar, Bold, Italic, Link2, Heading, List, GripVertical, Upload, ArrowUp, ArrowDown, Building2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  display_order: number;
  company_id: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
}

const BlogManager = () => {
  const { companies, currentCompany, getCompanyFilter } = useCompany();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover_image: "",
    status: "draft" as BlogPost["status"],
    company_id: null as string | null, // null = all companies
    meta_description: "",
    meta_keywords: "",
  });
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const contentImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
  }, [currentCompany?.id]);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("blog_posts")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      
      // Filter by company or show all (null company_id means global)
      const companyId = getCompanyFilter();
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setPosts((data as BlogPost[]) || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: editingPost ? prev.slug : generateSlug(title),
    }));
  };

  // Image upload function
  const uploadImage = async (file: File, folder: string = "blog-images"): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(fileName, file);
      
      if (uploadError) {
        // Try creating bucket first if it doesn't exist
        const { error: bucketError } = await supabase.storage.createBucket("public-assets", { public: true });
        if (!bucketError || bucketError.message?.includes("already exists")) {
          const { error: retryError } = await supabase.storage
            .from("public-assets")
            .upload(fileName, file);
          if (retryError) throw retryError;
        } else {
          throw uploadError;
        }
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from("public-assets")
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = await uploadImage(file, "blog-covers");
    if (url) {
      setFormData(prev => ({ ...prev, cover_image: url }));
      toast.success("Cover image uploaded!");
    }
  };

  const handleContentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = await uploadImage(file, "blog-content");
    if (url) {
      const textarea = contentRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const newText = formData.content.substring(0, start) + `\n![Image](${url})\n` + formData.content.substring(start);
        setFormData(prev => ({ ...prev, content: newText }));
        toast.success("Image inserted!");
      }
    }
  };

  // Rich text formatting functions
  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);
    const newText = formData.content.substring(0, start) + prefix + selectedText + suffix + formData.content.substring(end);
    
    setFormData(prev => ({ ...prev, content: newText }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const handleBold = () => insertFormatting("**");
  const handleItalic = () => insertFormatting("*");
  const handleHeading = (level: number) => insertFormatting("\n" + "#".repeat(level) + " ", "\n");
  const handleLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      const textarea = contentRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = formData.content.substring(start, end) || "Link text";
      const newText = formData.content.substring(0, start) + `[${selectedText}](${url})` + formData.content.substring(end);
      setFormData(prev => ({ ...prev, content: newText }));
    }
  };
  const handleList = () => insertFormatting("\n- ", "");

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) return;

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      toast.error("You must be logged in to manage blog posts");
      return;
    }

    const postData = {
      title: formData.title,
      slug: formData.slug || generateSlug(formData.title),
      excerpt: formData.excerpt || null,
      content: formData.content,
      cover_image: formData.cover_image || null,
      status: formData.status,
      author_id: session?.user.id,
      published_at: formData.status === "published" ? new Date().toISOString() : null,
      company_id: formData.company_id, // null = all companies
      meta_description: formData.meta_description || null,
      meta_keywords: formData.meta_keywords || null,
    };

    let error;
    if (editingPost) {
      ({ error } = await supabase.from("blog_posts").update(postData).eq("id", editingPost.id));
    } else {
      // Set display_order to be at the end
      const maxOrder = posts.length > 0 ? Math.max(...posts.map(p => p.display_order || 0)) : 0;
      ({ error } = await supabase.from("blog_posts").insert({ ...postData, display_order: maxOrder + 1 }));
    }

    if (!error) {
      setIsModalOpen(false);
      setEditingPost(null);
      setFormData({ title: "", slug: "", excerpt: "", content: "", cover_image: "", status: "draft", company_id: null, meta_description: "", meta_keywords: "" });
      fetchPosts();
      toast.success(editingPost ? "Post updated!" : "Post created!");
    } else {
      toast.error("Failed to save post");
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      content: post.content,
      cover_image: post.cover_image || "",
      status: post.status,
      company_id: post.company_id,
      meta_description: post.meta_description || "",
      meta_keywords: post.meta_keywords || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this blog post?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error("You must be logged in"); return; }
    await supabase.from("blog_posts").delete().eq("id", id);
    fetchPosts();
    toast.success("Post deleted");
  };

  const handlePublish = async (post: BlogPost) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error("You must be logged in"); return; }
    await supabase
      .from("blog_posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", post.id);
    fetchPosts();
    toast.success("Post published!");
  };

  const handleDuplicate = async (post: BlogPost) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error("You must be logged in"); return; }
    
    const newSlug = `${post.slug}-copy-${Date.now().toString(36)}`;
    
    // Shift all posts after the original down by 1 to make room
    const originalOrder = post.display_order || 0;
    const postsToShift = posts.filter(p => (p.display_order || 0) > originalOrder);
    for (const p of postsToShift) {
      await supabase.from("blog_posts").update({ display_order: (p.display_order || 0) + 1 }).eq("id", p.id);
    }
    
    const { data, error } = await supabase.from("blog_posts").insert({
      title: `${post.title} (Copy)`,
      slug: newSlug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image: post.cover_image,
      status: "draft" as const,
      author_id: session.user.id,
      published_at: null,
      company_id: post.company_id,
      meta_description: post.meta_description,
      meta_keywords: post.meta_keywords,
      display_order: originalOrder + 1,
    }).select();
    
    if (!error && data && data.length > 0) {
      await fetchPosts();
      toast.success("Post duplicated as draft! It appears right below the original.");
    } else {
      console.error("Duplicate blog error:", error);
      toast.error(`Failed to duplicate post: ${error?.message || "Unknown error"}`);
    }
  };

  // Reorder functions
  const movePost = async (postId: string, direction: "up" | "down") => {
    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= posts.length) return;

    const reorderedPosts = [...posts];
    const [movedPost] = reorderedPosts.splice(currentIndex, 1);
    reorderedPosts.splice(newIndex, 0, movedPost);

    // Update display_order for all affected posts
    const updates = reorderedPosts.map((post, index) => ({
      id: post.id,
      display_order: index,
    }));

    for (const update of updates) {
      await supabase.from("blog_posts").update({ display_order: update.display_order }).eq("id", update.id);
    }

    fetchPosts();
    toast.success("Post order updated");
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-green-100 text-green-800",
      archived: "bg-yellow-100 text-yellow-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Blog Management</h2>
          <p className="text-sm text-muted-foreground">Create, reorder, and manage blog content</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditingPost(null); }}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="w-4 h-4 mr-1" />
              New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPost ? "Edit Post" : "Create New Post"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Enter post title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input
                  placeholder="post-url-slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Cover Image</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={formData.cover_image}
                    onChange={(e) => setFormData(prev => ({ ...prev, cover_image: e.target.value }))}
                    className="flex-1"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    ref={coverInputRef}
                    onChange={handleCoverImageUpload}
                    className="hidden"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => coverInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {isUploading ? "..." : "Upload"}
                  </Button>
                </div>
                {formData.cover_image && (
                  <img src={formData.cover_image} alt="Cover preview" className="mt-2 h-32 w-full object-cover rounded-lg" />
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Excerpt</label>
                <Textarea
                  placeholder="Brief summary of the post..."
                  value={formData.excerpt}
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  rows={2}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Content (Markdown)</label>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={handleBold} title="Bold">
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleItalic} title="Italic">
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleHeading(1)} title="Heading 1 (H1)">
                      <span className="text-xs font-bold">H1</span>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleHeading(2)} title="Heading 2 (H2)">
                      <span className="text-xs font-bold">H2</span>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleHeading(3)} title="Heading 3 (H3)">
                      <span className="text-xs font-bold">H3</span>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleLink} title="Add Link">
                      <Link2 className="w-4 h-4" />
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      ref={contentImageInputRef}
                      onChange={handleContentImageUpload}
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => contentImageInputRef.current?.click()} 
                      title="Upload Image"
                      disabled={isUploading}
                    >
                      <Image className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleList} title="Add List">
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  ref={contentRef}
                  placeholder="Write your blog content here... Use **bold**, *italic*, # Heading, [link](url), ![image](url)"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports Markdown: **bold**, *italic*, # Heading, ## Subheading, [link text](url), ![alt](image-url), - list item
                </p>
              </div>

              {/* SEO Fields */}
              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  🔍 SEO Settings
                </p>
                <div>
                  <label className="text-sm font-medium">Meta Description</label>
                  <Textarea
                    placeholder="SEO description (150-160 characters recommended)"
                    value={formData.meta_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                    rows={2}
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.meta_description.length}/160 characters
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Meta Keywords</label>
                  <Input
                    placeholder="loan, personal loan, finance tips (comma separated)"
                    value={formData.meta_keywords}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_keywords: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as BlogPost["status"] }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Company
                  </label>
                  <select
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background"
                    value={formData.company_id || "all"}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      company_id: e.target.value === "all" ? null : e.target.value 
                    }))}
                  >
                    <option value="all">All Companies (Global)</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full" disabled={isUploading}>
                {editingPost ? "Update Post" : "Create Post"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Posts List with Reorder */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            No blog posts yet. Create your first post!
          </div>
        ) : (
          posts.map((post, index) => (
            <div key={post.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
              {/* Drag Handle / Order Controls */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={index === 0}
                  onClick={() => movePost(post.id, "up")}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={index === posts.length - 1}
                  onClick={() => movePost(post.id, "down")}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>

              {/* Cover Image */}
              {post.cover_image ? (
                <img src={post.cover_image} alt={post.title} className="w-20 h-16 object-cover rounded-lg" />
              ) : (
                <div className="w-20 h-16 bg-muted flex items-center justify-center rounded-lg">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
              )}

              {/* Post Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold truncate">{post.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                    {post.status}
                  </span>
                  {post.company_id ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {companies.find(c => c.id === post.company_id)?.name?.split(' ')[0] || "Company"}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Global
                    </span>
                  )}
                </div>
                {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-1">{post.excerpt}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(post.created_at).toLocaleDateString("en-IN")}
                  <span className="text-muted-foreground/50">•</span>
                  <span className="font-mono text-xs">/blog/{post.slug}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                    <Eye className="w-3 h-3" />
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleEdit(post)}>
                  <Edit className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDuplicate(post)} title="Duplicate">
                  <Copy className="w-3 h-3" />
                </Button>
                {post.status === "draft" && (
                  <Button variant="hero" size="sm" onClick={() => handlePublish(post)}>
                    Publish
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BlogManager;