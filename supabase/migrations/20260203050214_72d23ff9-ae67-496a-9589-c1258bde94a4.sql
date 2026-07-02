-- Add company_id to blog_posts for multi-tenant blog support
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Add index for faster company filtering
CREATE INDEX IF NOT EXISTS idx_blog_posts_company_id ON public.blog_posts(company_id);

-- Allow null company_id to mean "all companies" (global posts)