-- Add 'lost' status to lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'lost';

-- Create accounting_entries table for P&L tracking
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  lead_id UUID REFERENCES public.leads(id),
  created_by UUID,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on accounting_entries
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for accounting_entries
CREATE POLICY "Admin can manage accounting entries"
  ON public.accounting_entries FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view accounting entries"
  ON public.accounting_entries FOR SELECT
  USING (is_staff(auth.uid()));

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  author_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on blog_posts
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published blog posts
CREATE POLICY "Anyone can read published blog posts"
  ON public.blog_posts FOR SELECT
  USING (status = 'published');

-- Admin can manage all blog posts
CREATE POLICY "Admin can manage blog posts"
  ON public.blog_posts FOR ALL
  USING (is_admin(auth.uid()));

-- Create whatsapp_campaigns table
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  target_status TEXT[],
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  created_by UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin can manage campaigns
CREATE POLICY "Admin can manage WhatsApp campaigns"
  ON public.whatsapp_campaigns FOR ALL
  USING (is_admin(auth.uid()));

-- Staff can view campaigns
CREATE POLICY "Staff can view WhatsApp campaigns"
  ON public.whatsapp_campaigns FOR SELECT
  USING (is_staff(auth.uid()));

-- Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Admin can manage workflows
CREATE POLICY "Admin can manage workflows"
  ON public.workflows FOR ALL
  USING (is_admin(auth.uid()));