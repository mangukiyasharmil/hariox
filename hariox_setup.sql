-- Hariox CRM: All Migrations Combined
-- Run this entire file in Supabase SQL Editor

-- ========================================
-- Migration: 20260127112011_f83ccfb0-0703-47e5-9437-e0db9ac568fe.sql
-- ========================================
-- Create enum types for the system
CREATE TYPE public.app_role AS ENUM ('admin', 'telecaller', 'verification', 'login_team');
CREATE TYPE public.lead_status AS ENUM ('unpaid', 'paid', 'verification', 'documents_pending', 'documents_uploaded', 'verified', 'rejected', 'processing', 'approved', 'disbursed');
CREATE TYPE public.payment_source AS ENUM ('direct', 'telecaller', 'manual');
CREATE TYPE public.document_status AS ENUM ('pending', 'uploaded', 'verified', 'rejected');
CREATE TYPE public.loan_type AS ENUM ('home', 'business', 'personal', 'education', 'vehicle', 'gold');
CREATE TYPE public.employment_type AS ENUM ('salaried', 'self_employed', 'business_owner');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create system settings table for configurable values
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('consulting_fee', '500', 'Base consulting fee in INR'),
  ('gst_percentage', '18', 'GST percentage'),
  ('min_interest_rate', '10', 'Minimum interest rate percentage'),
  ('min_tenure_months', '36', 'Minimum loan tenure in months');

-- Create leads table (main CRM data)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Personal Details
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  -- Loan Details
  loan_type loan_type NOT NULL,
  loan_amount NUMERIC NOT NULL,
  employment_type employment_type NOT NULL,
  monthly_income NUMERIC NOT NULL,
  -- Calculated EMI
  emi_amount NUMERIC,
  interest_rate NUMERIC DEFAULT 10,
  tenure_months INTEGER DEFAULT 36,
  -- Status & Assignment
  status lead_status NOT NULL DEFAULT 'unpaid',
  assigned_to UUID REFERENCES auth.users(id),
  -- Source tracking
  source TEXT DEFAULT 'website',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  gst_amount NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_source payment_source NOT NULL DEFAULT 'direct',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  collected_by UUID REFERENCES auth.users(id),
  payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  remarks TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create call logs table for telecaller tracking
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  caller_id UUID REFERENCES auth.users(id) NOT NULL,
  call_duration INTEGER, -- in seconds
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity logs for audit trail
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bank submissions table for login team
CREATE TABLE public.bank_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  submission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'submitted',
  remarks TEXT,
  approval_amount NUMERIC,
  disbursement_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security Definer function to check roles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to check if user has any staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_submissions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies (only admin can manage)
CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- System settings policies
CREATE POLICY "Anyone can read settings" ON public.system_settings
  FOR SELECT USING (true);

CREATE POLICY "Admin can update settings" ON public.system_settings
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Leads policies
CREATE POLICY "Anyone can insert leads" ON public.leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view all leads" ON public.leads
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update leads" ON public.leads
  FOR UPDATE USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can delete leads" ON public.leads
  FOR DELETE USING (public.is_admin(auth.uid()));

-- Payments policies
CREATE POLICY "Anyone can insert payments" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view payments" ON public.payments
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update payments" ON public.payments
  FOR UPDATE USING (public.is_staff(auth.uid()));

-- Documents policies
CREATE POLICY "Anyone can insert documents" ON public.documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view documents" ON public.documents
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update documents" ON public.documents
  FOR UPDATE USING (public.is_staff(auth.uid()));

-- Call logs policies
CREATE POLICY "Staff can insert call logs" ON public.call_logs
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view call logs" ON public.call_logs
  FOR SELECT USING (public.is_staff(auth.uid()));

-- Activity logs policies
CREATE POLICY "Staff can insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view activity logs" ON public.activity_logs
  FOR SELECT USING (public.is_staff(auth.uid()));

-- Bank submissions policies
CREATE POLICY "Login team can manage submissions" ON public.bank_submissions
  FOR ALL USING (public.has_role(auth.uid(), 'login_team') OR public.is_admin(auth.uid()));

CREATE POLICY "Staff can view submissions" ON public.bank_submissions
  FOR SELECT USING (public.is_staff(auth.uid()));

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies for documents bucket
CREATE POLICY "Anyone can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Staff can view documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND public.is_staff(auth.uid()));

CREATE POLICY "Admin can delete documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_submissions_updated_at BEFORE UPDATE ON public.bank_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ========================================
-- Migration: 20260127113945_3a3cd556-c18b-4356-92ca-55bf25985b8d.sql
-- ========================================
-- Drop existing insert policy and create one that allows anonymous users
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;

-- Create policy that allows anyone (including anonymous) to insert leads
CREATE POLICY "Public can submit loan applications"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also fix payments table - anonymous users need to be able to see payment status
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;

CREATE POLICY "Public can create payments"
ON public.payments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
-- ========================================
-- Migration: 20260127114912_603804fd-cf03-4219-936e-4c87e11bb3ee.sql
-- ========================================
-- Tighten public insert policy for leads (avoid permissive WITH CHECK (true))
DROP POLICY IF EXISTS "Public can submit loan applications" ON public.leads;

CREATE POLICY "Public can submit loan applications"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'unpaid'::public.lead_status
  AND (source IS NULL OR source = 'website')
  AND full_name IS NOT NULL AND length(btrim(full_name)) BETWEEN 2 AND 100
  AND city IS NOT NULL AND length(btrim(city)) BETWEEN 2 AND 100
  AND email IS NOT NULL AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND phone IS NOT NULL AND phone ~ '^[6-9][0-9]{9}$'
  AND loan_amount IS NOT NULL AND loan_amount > 0
  AND monthly_income IS NOT NULL AND monthly_income > 0
);

-- Payments: remove public insert policy; allow only staff inserts from admin panel
DROP POLICY IF EXISTS "Public can create payments" ON public.payments;

CREATE POLICY "Staff can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  is_staff(auth.uid())
  AND collected_by = auth.uid()
  AND payment_date IS NOT NULL
  AND payment_source IN ('telecaller'::public.payment_source, 'manual'::public.payment_source)
);

-- Documents: remove public insert policy (can be reintroduced later for customer uploads)
DROP POLICY IF EXISTS "Anyone can insert documents" ON public.documents;

CREATE POLICY "Staff can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  is_staff(auth.uid())
  AND status IN ('pending'::public.document_status, 'uploaded'::public.document_status)
);

-- ========================================
-- Migration: 20260127124722_ddb54bc8-a0c1-4d87-be36-80018a3a5fb5.sql
-- ========================================
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
-- ========================================
-- Migration: 20260127133939_172772a6-9570-429e-815e-9530cddc8c9a.sql
-- ========================================
-- Add new fields to leads table for Step 2 enhancements
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS cibil_score_range TEXT,
ADD COLUMN IF NOT EXISTS current_monthly_emi NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS emi_bounce_last_6_months BOOLEAN DEFAULT false;

-- Add new fields for follow-up reminders and interested status
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS is_interested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

-- Update loan_type enum to remove vehicle and gold (we'll handle this in app logic instead)
-- Note: We keep the database enum for backward compatibility but filter in app

-- Create GST invoices table for auto-generation
CREATE TABLE IF NOT EXISTS public.gst_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  gst_amount NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'generated',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on gst_invoices
ALTER TABLE public.gst_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for GST invoices
CREATE POLICY "Staff can view GST invoices" ON public.gst_invoices FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Admin can manage GST invoices" ON public.gst_invoices FOR ALL USING (is_admin(auth.uid()));

-- Create lead_assignments table for auto-assign tracking
CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telecaller_id UUID NOT NULL,
  assigned_count INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on lead_assignments
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_assignments
CREATE POLICY "Admin can manage lead assignments" ON public.lead_assignments FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Staff can view assignments" ON public.lead_assignments FOR SELECT USING (is_staff(auth.uid()));

-- Create function to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  invoice_count INTEGER;
  fiscal_year TEXT;
  invoice_num TEXT;
BEGIN
  -- Get fiscal year (April to March)
  IF EXTRACT(MONTH FROM NOW()) >= 4 THEN
    fiscal_year := EXTRACT(YEAR FROM NOW())::TEXT || '-' || (EXTRACT(YEAR FROM NOW()) + 1)::TEXT;
  ELSE
    fiscal_year := (EXTRACT(YEAR FROM NOW()) - 1)::TEXT || '-' || EXTRACT(YEAR FROM NOW())::TEXT;
  END IF;
  
  -- Count existing invoices this fiscal year
  SELECT COUNT(*) + 1 INTO invoice_count FROM public.gst_invoices 
  WHERE invoice_date >= CASE 
    WHEN EXTRACT(MONTH FROM NOW()) >= 4 THEN DATE_TRUNC('year', NOW()) + INTERVAL '3 months'
    ELSE DATE_TRUNC('year', NOW()) - INTERVAL '9 months'
  END;
  
  invoice_num := 'FC/' || REPLACE(fiscal_year, '20', '') || '/' || LPAD(invoice_count::TEXT, 5, '0');
  RETURN invoice_num;
END;
$$;

-- Add triggers for updated_at on new tables
CREATE TRIGGER update_lead_assignments_updated_at
BEFORE UPDATE ON public.lead_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- ========================================
-- Migration: 20260127183651_41f430b2-7b30-4040-9366-6a676cbf349a.sql
-- ========================================
-- Allow public document uploads for customer self-service
-- Only allow insert with pending/uploaded status
CREATE POLICY "Public can upload documents via link"
ON public.documents
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status IN ('pending', 'uploaded')
);

-- Also add SELECT so customers can see their uploaded docs
CREATE POLICY "Public can view own lead documents"
ON public.documents
FOR SELECT
TO anon, authenticated
USING (true);
-- ========================================
-- Migration: 20260127183951_a5fb9fc9-e925-42d4-a42d-38383bd4309a.sql
-- ========================================
-- Create WhatsApp accounts table
CREATE TABLE public.whatsapp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT,
  connection_type TEXT NOT NULL DEFAULT 'qr' CHECK (connection_type IN ('qr', 'meta_api')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  session_data JSONB,
  meta_phone_id TEXT,
  meta_access_token TEXT,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp templates table
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp auto-responses table
CREATE TABLE public.whatsapp_auto_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  trigger_keyword TEXT NOT NULL,
  response_message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp messages table for chat inbox
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'template')),
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  campaign_id UUID REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster message lookups
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_account ON public.whatsapp_messages(account_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_accounts
CREATE POLICY "Admin can manage WhatsApp accounts"
  ON public.whatsapp_accounts FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view WhatsApp accounts"
  ON public.whatsapp_accounts FOR SELECT
  USING (is_staff(auth.uid()));

-- RLS Policies for whatsapp_templates
CREATE POLICY "Admin can manage WhatsApp templates"
  ON public.whatsapp_templates FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view WhatsApp templates"
  ON public.whatsapp_templates FOR SELECT
  USING (is_staff(auth.uid()));

-- RLS Policies for whatsapp_auto_responses
CREATE POLICY "Admin can manage auto responses"
  ON public.whatsapp_auto_responses FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view auto responses"
  ON public.whatsapp_auto_responses FOR SELECT
  USING (is_staff(auth.uid()));

-- RLS Policies for whatsapp_messages
CREATE POLICY "Admin can manage messages"
  ON public.whatsapp_messages FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view and send messages"
  ON public.whatsapp_messages FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff can insert messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (is_staff(auth.uid()));

-- Update trigger for accounts
CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for templates
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add account_id to campaigns table
ALTER TABLE public.whatsapp_campaigns 
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL;
-- ========================================
-- Migration: 20260127190903_7e3c451c-adb9-4276-9fd8-709570cb4044.sql
-- ========================================
-- Create companies table for multi-tenant support
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e3a5f',
  secondary_color TEXT DEFAULT '#f59e0b',
  phone TEXT,
  email TEXT,
  whatsapp_number TEXT,
  address TEXT,
  website_url TEXT,
  meta_pixel_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_users junction table (which users belong to which companies)
CREATE TABLE public.company_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Add company_id to leads table
ALTER TABLE public.leads ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add company_id to payments table  
ALTER TABLE public.payments ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add company_id to documents table
ALTER TABLE public.documents ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- Function to check if user belongs to a company
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- Function to get user's companies
CREATE OR REPLACE FUNCTION public.get_user_companies(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_users WHERE user_id = _user_id
$$;

-- RLS Policies for companies
CREATE POLICY "Users can view their companies"
  ON public.companies FOR SELECT
  USING (id IN (SELECT public.get_user_companies(auth.uid())));

CREATE POLICY "Company owners can update their company"
  ON public.companies FOR UPDATE
  USING (id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid() AND is_owner = true
  ));

-- RLS Policies for company_users
CREATE POLICY "Users can view company memberships"
  ON public.company_users FOR SELECT
  USING (user_id = auth.uid() OR company_id IN (SELECT public.get_user_companies(auth.uid())));

CREATE POLICY "Company owners can manage members"
  ON public.company_users FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.company_users 
    WHERE user_id = auth.uid() AND is_owner = true
  ));

-- Admins can manage all companies
CREATE POLICY "Admins can manage all companies"
  ON public.companies FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all company users"
  ON public.company_users FOR ALL
  USING (public.is_admin(auth.uid()));

-- Insert default company (Fundcera)
INSERT INTO public.companies (name, slug, phone, email, whatsapp_number, website_url)
VALUES ('Fundcera Finance', 'fundcera', '+91 8469391818', 'info@fundcera.com', '918469391818', 'https://fundcera.com');

-- Create indexes
CREATE INDEX idx_company_users_user_id ON public.company_users(user_id);
CREATE INDEX idx_company_users_company_id ON public.company_users(company_id);
CREATE INDEX idx_leads_company_id ON public.leads(company_id);
CREATE INDEX idx_payments_company_id ON public.payments(company_id);

-- Trigger for updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- ========================================
-- Migration: 20260128055909_7176b35c-8eac-41b0-981f-32d9716791f9.sql
-- ========================================
-- 1. Add 'marriage' to loan_type enum
ALTER TYPE public.loan_type ADD VALUE 'marriage';

-- 2. Add pincode and state columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS pincode VARCHAR(6),
ADD COLUMN IF NOT EXISTS state VARCHAR(50);

-- 3. Add GST tracking columns to accounting_entries
ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS gst_included BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0;

-- 4. Update RLS policy for leads to include new fields in insert check
DROP POLICY IF EXISTS "Public can submit loan applications" ON public.leads;

CREATE POLICY "Public can submit loan applications" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  (status = 'unpaid'::lead_status) 
  AND ((source IS NULL) OR (source = 'website'::text)) 
  AND (full_name IS NOT NULL) 
  AND ((length(btrim(full_name)) >= 2) AND (length(btrim(full_name)) <= 100)) 
  AND (city IS NOT NULL) 
  AND ((length(btrim(city)) >= 2) AND (length(btrim(city)) <= 100)) 
  AND (email IS NOT NULL) 
  AND (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) 
  AND (phone IS NOT NULL) 
  AND (phone ~ '^[6-9][0-9]{9}$'::text) 
  AND (loan_amount IS NOT NULL) 
  AND (loan_amount > (0)::numeric) 
  AND (monthly_income IS NOT NULL) 
  AND (monthly_income > (0)::numeric)
  AND ((pincode IS NULL) OR (pincode ~ '^[1-9][0-9]{5}$'::text))
  AND ((state IS NULL) OR (length(btrim(state)) <= 50))
);
-- ========================================
-- Migration: 20260129065848_af7ea0d1-1ce2-4666-ab62-9ceb4fa3a531.sql
-- ========================================
-- Allow public users to read leads by phone number for payment portal
CREATE POLICY "Public can lookup leads by phone" 
ON public.leads 
FOR SELECT 
USING (
  -- Allow anonymous users to look up by phone (for payment portal)
  auth.uid() IS NULL
);
-- ========================================
-- Migration: 20260129095809_bfdeaee5-3047-482d-b568-07fe26085faa.sql
-- ========================================
-- Add 'marketing' as new payment source type
ALTER TYPE public.payment_source ADD VALUE IF NOT EXISTS 'marketing';

-- Comment for clarity
COMMENT ON TYPE public.payment_source IS 'Payment source: direct=main website, marketing=campaign links, telecaller=staff collected, manual=offline';

-- ========================================
-- Migration: 20260129112401_9efd9e19-0c97-4091-9114-928b28043dba.sql
-- ========================================
-- Allow admins to update any profile
CREATE POLICY "Admin can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()));

-- Allow admins to view all profiles (already exists but ensure it's there)
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
ON public.profiles
FOR SELECT
USING (is_staff(auth.uid()));
-- ========================================
-- Migration: 20260129112941_53b74a73-1076-47ae-ab41-a954c0223693.sql
-- ========================================
-- Create assets storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public access to assets
CREATE POLICY "Public access to assets" ON storage.objects
FOR SELECT USING (bucket_id = 'assets');
-- ========================================
-- Migration: 20260129191000_9de1b293-b996-481d-992f-8b19e7959150.sql
-- ========================================
-- Create table to store OTP codes with rate limiting
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(10) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_otp_codes_phone_expires ON public.otp_codes(phone, expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous insert (for sending OTP)
CREATE POLICY "Anyone can request OTP" ON public.otp_codes
  FOR INSERT WITH CHECK (true);

-- Policy: Allow anonymous select for verification
CREATE POLICY "Anyone can verify OTP" ON public.otp_codes
  FOR SELECT USING (true);

-- Policy: Allow anonymous update for marking verified
CREATE POLICY "Anyone can mark OTP verified" ON public.otp_codes
  FOR UPDATE USING (true);

-- Cleanup function to delete expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < now() - interval '1 hour';
END;
$$;
-- ========================================
-- Migration: 20260131033045_225fa81f-ca9a-457b-9978-3d0acf7b1f5a.sql
-- ========================================
-- Create SMS logs table for tracking all SMS sent
CREATE TABLE public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id),
  phone VARCHAR(15) NOT NULL,
  sms_type VARCHAR(50) NOT NULL, -- 'otp', 'status', 'marketing', 'reminder'
  template_id VARCHAR(50),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  provider VARCHAR(50) DEFAULT 'greensms',
  provider_response JSONB,
  cost_credits DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Staff can view SMS logs
CREATE POLICY "Staff can view SMS logs"
  ON public.sms_logs FOR SELECT
  USING (is_staff(auth.uid()));

-- Staff can insert SMS logs
CREATE POLICY "Staff can insert SMS logs"
  ON public.sms_logs FOR INSERT
  WITH CHECK (true);

-- Admin can manage SMS logs
CREATE POLICY "Admin can manage SMS logs"
  ON public.sms_logs FOR ALL
  USING (is_admin(auth.uid()));

-- Create index for better performance
CREATE INDEX idx_sms_logs_phone ON public.sms_logs(phone);
CREATE INDEX idx_sms_logs_created_at ON public.sms_logs(created_at);
CREATE INDEX idx_sms_logs_sms_type ON public.sms_logs(sms_type);
CREATE INDEX idx_sms_logs_status ON public.sms_logs(status);
-- ========================================
-- Migration: 20260131033053_40c993ef-547c-43fb-a221-6f95a1496e0d.sql
-- ========================================
-- Drop the overly permissive policy and create proper one
DROP POLICY "Staff can insert SMS logs" ON public.sms_logs;

-- Staff can insert SMS logs with proper check
CREATE POLICY "Staff can insert SMS logs"
  ON public.sms_logs FOR INSERT
  WITH CHECK (is_staff(auth.uid()));
-- ========================================
-- Migration: 20260131093648_dd75741f-da36-43f7-b129-5a6dfd6b2962.sql
-- ========================================
-- Create analytics_events table for tracking page views and events
CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  event_type TEXT NOT NULL, -- 'pageview', 'lead', 'payment', etc.
  page_url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  session_id TEXT,
  visitor_id TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  country TEXT,
  city TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert events (for tracking)
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (true);

-- Policy: Only staff can view analytics
CREATE POLICY "Staff can view analytics events"
ON public.analytics_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'telecaller', 'verification', 'login_team')
  )
);

-- Create index for faster queries
CREATE INDEX idx_analytics_events_company_created ON public.analytics_events(company_id, created_at DESC);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_visitor ON public.analytics_events(visitor_id);

-- Enable realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_events;
-- ========================================
-- Migration: 20260131094300_4aac1cd7-933f-49aa-ab71-e27f7ee46fb1.sql
-- ========================================
-- Create staff attendance table for clock-in/out tracking
CREATE TABLE public.staff_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clock_out TIMESTAMP WITH TIME ZONE,
  work_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can insert their own attendance
CREATE POLICY "Staff can clock in"
ON public.staff_attendance
FOR INSERT
WITH CHECK (is_staff(auth.uid()) AND user_id = auth.uid());

-- Policy: Staff can update their own attendance (for clock out)
CREATE POLICY "Staff can clock out"
ON public.staff_attendance
FOR UPDATE
USING (is_staff(auth.uid()) AND user_id = auth.uid());

-- Policy: Staff can view their own attendance
CREATE POLICY "Staff can view own attendance"
ON public.staff_attendance
FOR SELECT
USING (is_staff(auth.uid()) AND user_id = auth.uid());

-- Policy: Admin can view all attendance
CREATE POLICY "Admin can view all attendance"
ON public.staff_attendance
FOR SELECT
USING (is_admin(auth.uid()));

-- Policy: Admin can manage all attendance
CREATE POLICY "Admin can manage attendance"
ON public.staff_attendance
FOR ALL
USING (is_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_staff_attendance_user ON public.staff_attendance(user_id);
CREATE INDEX idx_staff_attendance_clock_in ON public.staff_attendance(clock_in DESC);

-- Add company_id to call_logs for proper filtering
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Add call_type to distinguish call types
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'outbound';

-- Create index for call logs
CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON public.call_logs(caller_id, created_at DESC);
-- ========================================
-- Migration: 20260131095729_d4f8a61b-6826-4a74-9a04-151e9e4250ca.sql
-- ========================================
-- Create salary slips table
CREATE TABLE public.salary_slips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  
  -- Attendance data
  total_working_days INTEGER DEFAULT 0,
  days_present INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  total_hours_worked DECIMAL(10,2) DEFAULT 0,
  
  -- Salary components
  base_salary DECIMAL(10,2) DEFAULT 0,
  per_day_rate DECIMAL(10,2) DEFAULT 0,
  attendance_salary DECIMAL(10,2) DEFAULT 0,
  
  -- Incentives
  lead_incentive DECIMAL(10,2) DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  incentive_rate DECIMAL(10,2) DEFAULT 0,
  bonus DECIMAL(10,2) DEFAULT 0,
  other_allowances DECIMAL(10,2) DEFAULT 0,
  allowance_description TEXT,
  
  -- Deductions
  deductions DECIMAL(10,2) DEFAULT 0,
  deduction_description TEXT,
  
  -- Totals
  gross_salary DECIMAL(10,2) DEFAULT 0,
  net_salary DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(user_id, month, year)
);

-- Enable RLS
ALTER TABLE public.salary_slips ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage salary slips"
ON public.salary_slips
FOR ALL
USING (public.is_admin(auth.uid()));

-- Staff can view their own salary slips
CREATE POLICY "Staff can view own salary slips"
ON public.salary_slips
FOR SELECT
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_salary_slips_updated_at
BEFORE UPDATE ON public.salary_slips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_salary_slips_user_month_year ON public.salary_slips(user_id, month, year);
CREATE INDEX idx_salary_slips_company_id ON public.salary_slips(company_id);
-- ========================================
-- Migration: 20260131100633_f60456f1-ffe9-48f5-b265-001fc0c5da68.sql
-- ========================================
-- Create function to auto-assign leads to telecaller with fewest unpaid assignments
CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_telecaller()
RETURNS TRIGGER AS $$
DECLARE
  selected_telecaller_id UUID;
  company_telecaller_ids UUID[];
  all_telecaller_ids UUID[];
  min_count INTEGER;
BEGIN
  -- Skip if already assigned
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- First, try to find telecallers linked to the lead's company
  IF NEW.company_id IS NOT NULL THEN
    SELECT ARRAY_AGG(cu.user_id) INTO company_telecaller_ids
    FROM company_users cu
    JOIN user_roles ur ON ur.user_id = cu.user_id
    WHERE cu.company_id = NEW.company_id
      AND ur.role = 'telecaller';
  END IF;

  -- Use company telecallers if found, otherwise fallback to all telecallers
  IF company_telecaller_ids IS NOT NULL AND array_length(company_telecaller_ids, 1) > 0 THEN
    all_telecaller_ids := company_telecaller_ids;
  ELSE
    SELECT ARRAY_AGG(user_id) INTO all_telecaller_ids
    FROM user_roles
    WHERE role = 'telecaller';
  END IF;

  -- If no telecallers available, return without assignment
  IF all_telecaller_ids IS NULL OR array_length(all_telecaller_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Find telecaller with fewest unpaid leads (round-robin)
  SELECT ur.user_id INTO selected_telecaller_id
  FROM user_roles ur
  WHERE ur.role = 'telecaller'
    AND ur.user_id = ANY(all_telecaller_ids)
  ORDER BY (
    SELECT COUNT(*) FROM leads l 
    WHERE l.assigned_to = ur.user_id 
      AND l.status = 'unpaid'
  ) ASC, ur.created_at ASC
  LIMIT 1;

  -- Assign the lead
  IF selected_telecaller_id IS NOT NULL THEN
    NEW.assigned_to := selected_telecaller_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-assign on insert
DROP TRIGGER IF EXISTS trigger_auto_assign_lead ON public.leads;
CREATE TRIGGER trigger_auto_assign_lead
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_lead_to_telecaller();
-- ========================================
-- Migration: 20260131124310_802641e2-0e75-4cb1-91ab-40f1fe468ade.sql
-- ========================================
-- Create function to auto-assign leads based on stage/status changes
CREATE OR REPLACE FUNCTION public.auto_assign_lead_by_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role app_role;
  target_user_id uuid;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Determine target role based on new status
    IF NEW.status = 'verification' OR NEW.status = 'documents_pending' OR NEW.status = 'documents_uploaded' THEN
      target_role := 'verification';
    ELSIF NEW.status = 'verified' OR NEW.status = 'processing' THEN
      target_role := 'login_team';
    ELSE
      -- No reassignment needed for other statuses
      RETURN NEW;
    END IF;
    
    -- Find a user with the target role (round-robin based on least assignments)
    SELECT ur.user_id INTO target_user_id
    FROM user_roles ur
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) as assignment_count
      FROM leads
      WHERE status = NEW.status
      AND assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) counts ON ur.user_id = counts.assigned_to
    WHERE ur.role = target_role
    ORDER BY COALESCE(counts.assignment_count, 0) ASC, RANDOM()
    LIMIT 1;
    
    -- Update the assigned_to field if a target user was found
    IF target_user_id IS NOT NULL THEN
      NEW.assigned_to := target_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stage-based assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_lead_by_stage ON leads;
CREATE TRIGGER trigger_auto_assign_lead_by_stage
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_lead_by_stage();

-- Add display_order column to blog_posts for reordering
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
-- ========================================
-- Migration: 20260131124434_46c8f6ef-387e-4591-a89c-5d16e73f0999.sql
-- ========================================
-- Create public-assets storage bucket for blog images
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view public assets
CREATE POLICY "Public assets are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-assets');

-- Policy: Authenticated users can upload
CREATE POLICY "Authenticated users can upload public assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'public-assets' AND auth.role() = 'authenticated');

-- Policy: Authenticated users can update their uploads  
CREATE POLICY "Authenticated users can update public assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'public-assets' AND auth.role() = 'authenticated');

-- Policy: Authenticated users can delete
CREATE POLICY "Authenticated users can delete public assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'public-assets' AND auth.role() = 'authenticated');
-- ========================================
-- Migration: 20260131154843_ba70a427-f97e-4e21-a46c-90a85d6dc4bb.sql
-- ========================================
-- Leave types table
CREATE TABLE public.leave_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  days_per_year INTEGER DEFAULT 12,
  is_paid BOOLEAN DEFAULT true,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employee leaves table
CREATE TABLE public.employee_leaves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(4,1) NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Public holidays table
CREATE TABLE public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_optional BOOLEAN DEFAULT false,
  description TEXT,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Leave balances table
CREATE TABLE public.leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  total_days NUMERIC(4,1) NOT NULL DEFAULT 12,
  used_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  pending_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type_id, year)
);

-- Enable RLS
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- Leave types policies (public read, admin write)
CREATE POLICY "Anyone can view leave types" ON public.leave_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage leave types" ON public.leave_types FOR ALL USING (public.is_admin(auth.uid()));

-- Employee leaves policies
CREATE POLICY "Staff can view their own leaves" ON public.employee_leaves FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Staff can create their own leaves" ON public.employee_leaves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can update their own pending leaves" ON public.employee_leaves FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins can manage all leaves" ON public.employee_leaves FOR ALL USING (public.is_admin(auth.uid()));

-- Public holidays policies
CREATE POLICY "Anyone can view holidays" ON public.public_holidays FOR SELECT USING (true);
CREATE POLICY "Admins can manage holidays" ON public.public_holidays FOR ALL USING (public.is_admin(auth.uid()));

-- Leave balances policies
CREATE POLICY "Staff can view their own balances" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage all balances" ON public.leave_balances FOR ALL USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_employee_leaves_updated_at BEFORE UPDATE ON public.employee_leaves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default leave types
INSERT INTO public.leave_types (name, description, days_per_year, is_paid, color) VALUES
('Casual Leave', 'For personal matters and short breaks', 12, true, '#3B82F6'),
('Sick Leave', 'For illness and medical appointments', 10, true, '#EF4444'),
('Earned Leave', 'Accumulated leave based on service', 15, true, '#10B981'),
('Maternity Leave', 'For expecting mothers', 180, true, '#EC4899'),
('Paternity Leave', 'For new fathers', 15, true, '#8B5CF6'),
('Unpaid Leave', 'Leave without pay', 0, false, '#6B7280');

-- Insert 2025 Indian public holidays
INSERT INTO public.public_holidays (name, date, year, is_optional) VALUES
('Republic Day', '2025-01-26', 2025, false),
('Maha Shivaratri', '2025-02-26', 2025, true),
('Holi', '2025-03-14', 2025, false),
('Good Friday', '2025-04-18', 2025, true),
('Eid ul-Fitr', '2025-03-31', 2025, false),
('Buddha Purnima', '2025-05-12', 2025, true),
('Eid ul-Adha', '2025-06-07', 2025, false),
('Independence Day', '2025-08-15', 2025, false),
('Janmashtami', '2025-08-16', 2025, true),
('Gandhi Jayanti', '2025-10-02', 2025, false),
('Dussehra', '2025-10-02', 2025, false),
('Diwali', '2025-10-20', 2025, false),
('Guru Nanak Jayanti', '2025-11-05', 2025, true),
('Christmas', '2025-12-25', 2025, false);
-- ========================================
-- Migration: 20260131164729_2251a163-6e51-48bf-aa0a-e62f22220e2d.sql
-- ========================================
-- Update the auto_assign_lead_to_telecaller trigger to NOT assign immediately for website leads
-- Website leads stay unassigned until the background job processes them after 2 minutes
CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_telecaller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if already assigned
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- For website leads (unpaid), do NOT assign immediately
  -- They will be processed by the background job after 2 minutes
  IF NEW.source = 'website' AND NEW.status = 'unpaid' THEN
    RETURN NEW; -- Leave unassigned
  END IF;

  -- For non-website leads (like API leads), assign immediately to telecaller
  IF NEW.status = 'unpaid' THEN
    SELECT ur.user_id INTO NEW.assigned_to
    FROM user_roles ur
    WHERE ur.role = 'telecaller'
    ORDER BY (
      SELECT COUNT(*) FROM leads l 
      WHERE l.assigned_to = ur.user_id 
        AND l.status = 'unpaid'
    ) ASC, ur.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update the auto_assign_lead_by_stage trigger for status changes
CREATE OR REPLACE FUNCTION public.auto_assign_lead_by_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_role app_role;
  target_user_id uuid;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- LOST or REJECTED: Unassign the lead
    IF NEW.status = 'lost' OR NEW.status = 'rejected' THEN
      NEW.assigned_to := NULL;
      RETURN NEW;
    END IF;
    
    -- PAID: Assign to verification team
    IF NEW.status = 'paid' THEN
      target_role := 'verification';
    -- VERIFICATION stages: Keep with verification team
    ELSIF NEW.status = 'verification' OR NEW.status = 'documents_pending' OR NEW.status = 'documents_uploaded' THEN
      target_role := 'verification';
    -- VERIFIED or PROCESSING: Assign to login team (sent to bank)
    ELSIF NEW.status = 'verified' OR NEW.status = 'processing' THEN
      target_role := 'login_team';
    ELSE
      -- No reassignment needed for other statuses
      RETURN NEW;
    END IF;
    
    -- Find a user with the target role (round-robin based on least assignments)
    SELECT ur.user_id INTO target_user_id
    FROM user_roles ur
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) as assignment_count
      FROM leads
      WHERE status = NEW.status
      AND assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) counts ON ur.user_id = counts.assigned_to
    WHERE ur.role = target_role
    ORDER BY COALESCE(counts.assignment_count, 0) ASC, RANDOM()
    LIMIT 1;
    
    -- Update the assigned_to field if a target user was found
    IF target_user_id IS NOT NULL THEN
      NEW.assigned_to := target_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
-- ========================================
-- Migration: 20260131164758_d0353d23-a055-4261-8e83-0d5471ca9163.sql
-- ========================================
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- ========================================
-- Migration: 20260201194857_a123b063-6f47-47a6-9945-46ec68ce719f.sql
-- ========================================
-- Drop and recreate the public lead submission policy to allow early phone-based lead capture
DROP POLICY IF EXISTS "Public can submit loan applications" ON public.leads;

-- Create updated policy that allows website-otp sources and minimal phone-only leads
CREATE POLICY "Public can submit loan applications"
ON public.leads
FOR INSERT
WITH CHECK (
  -- Must be unpaid status
  status = 'unpaid' 
  -- Allow various website sources including OTP-verified leads
  AND (source IS NULL OR source LIKE 'website%' OR source LIKE 'whatsapp%')
  -- Phone is always required and validated
  AND phone IS NOT NULL 
  AND phone ~ '^[6-9][0-9]{9}$'
  -- Full name must exist (can be placeholder for phone-only leads)
  AND full_name IS NOT NULL 
  AND length(trim(full_name)) >= 2
  -- Email must exist (can be placeholder for phone-only leads)  
  AND email IS NOT NULL
  -- Loan amount must be positive
  AND loan_amount IS NOT NULL 
  AND loan_amount > 0
  -- Monthly income must be positive
  AND monthly_income IS NOT NULL 
  AND monthly_income > 0
  -- City is required (can be placeholder)
  AND city IS NOT NULL
  -- Optional fields validation
  AND (pincode IS NULL OR pincode::text ~ '^[1-9][0-9]{5}$')
  AND (state IS NULL OR length(trim(state::text)) <= 50)
);
-- ========================================
-- Migration: 20260201203939_57dcbe55-cfdb-4985-b3c7-a40eb55e2317.sql
-- ========================================
-- Create workflow_logs table to track automation executions
CREATE TABLE public.workflow_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  workflow_name TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  actions_executed JSONB DEFAULT '[]',
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view workflow logs" 
ON public.workflow_logs 
FOR SELECT 
USING (public.is_admin(auth.uid()));

-- Admin can delete logs
CREATE POLICY "Admins can delete workflow logs"
ON public.workflow_logs
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_workflow_logs_workflow_id ON public.workflow_logs(workflow_id);
CREATE INDEX idx_workflow_logs_created_at ON public.workflow_logs(created_at DESC);
-- ========================================
-- Migration: 20260202004504_d77b9b48-9f7d-4b64-aed5-87d5e424af18.sql
-- ========================================
-- Add company_id to accounting_entries for multi-tenant expense tracking
ALTER TABLE public.accounting_entries 
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create index for faster company-based queries
CREATE INDEX idx_accounting_entries_company_id ON public.accounting_entries(company_id);

-- Update RLS policy to include company check
DROP POLICY IF EXISTS "Staff can view accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Staff can manage accounting entries" ON public.accounting_entries;

CREATE POLICY "Staff can view accounting entries"
ON public.accounting_entries FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can manage accounting entries"  
ON public.accounting_entries FOR ALL
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));
-- ========================================
-- Migration: 20260202135438_ccdc47ae-4b64-4b5d-ae49-83f56849da99.sql
-- ========================================

-- Create security definer function to check if user is company owner
CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_owner = true
  )
$$;

-- Create function to get companies where user is owner
CREATE OR REPLACE FUNCTION public.get_owned_companies(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.company_users 
  WHERE user_id = _user_id AND is_owner = true
$$;

-- Drop problematic policies on company_users
DROP POLICY IF EXISTS "Company owners can manage members" ON public.company_users;
DROP POLICY IF EXISTS "Users can view company memberships" ON public.company_users;

-- Recreate policies using security definer functions
CREATE POLICY "Company owners can manage members" 
ON public.company_users 
FOR ALL 
USING (
  public.is_admin(auth.uid()) OR 
  public.is_company_owner(auth.uid(), company_id)
);

CREATE POLICY "Users can view company memberships" 
ON public.company_users 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  company_id IN (SELECT public.get_user_companies(auth.uid()))
);

-- Fix companies table policy for owners
DROP POLICY IF EXISTS "Company owners can update their company" ON public.companies;

CREATE POLICY "Company owners can update their company" 
ON public.companies 
FOR UPDATE 
USING (
  public.is_admin(auth.uid()) OR 
  id IN (SELECT public.get_owned_companies(auth.uid()))
);

-- ========================================
-- Migration: 20260202160921_e3f071bc-8843-416f-bf63-73640b116a61.sql
-- ========================================
-- Enable realtime for payments table to allow real-time notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
-- ========================================
-- Migration: 20260202173734_ed216ef9-de64-4b87-ada0-0eced69d1104.sql
-- ========================================
-- Add columns to whatsapp_messages for API tracking
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS sent_at timestamptz,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS read_at timestamptz,
ADD COLUMN IF NOT EXISTS message_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS cost_credits numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS wamid text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);

-- Add Meta API credentials to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts
ADD COLUMN IF NOT EXISTS meta_business_id text,
ADD COLUMN IF NOT EXISTS webhook_verify_token text;

-- Create whatsapp_api_logs for tracking API usage
CREATE TABLE IF NOT EXISTS public.whatsapp_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  action text NOT NULL,
  request_data jsonb,
  response_data jsonb,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_api_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_api_logs
CREATE POLICY "Staff can view api logs" ON public.whatsapp_api_logs
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert api logs" ON public.whatsapp_api_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
-- ========================================
-- Migration: 20260203035453_d3765418-0e60-4d5d-94fc-384e77232a5f.sql
-- ========================================
-- Add google_analytics_id column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS google_analytics_id text;

-- Update Finance Fundcera with the GA ID
UPDATE public.companies 
SET google_analytics_id = 'G-5255WHW6WW'
WHERE slug = 'finance';
-- ========================================
-- Migration: 20260203035740_d131a266-e1dd-454c-bd56-3185cda298b8.sql
-- ========================================
-- Add invoice_prefix to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV';

-- Add company_id to gst_invoices if not exists
ALTER TABLE public.gst_invoices 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Update company prefixes
UPDATE public.companies SET invoice_prefix = 'CF' WHERE slug = 'fundcera';
UPDATE public.companies SET invoice_prefix = 'LF' WHERE slug = 'capital';
UPDATE public.companies SET invoice_prefix = 'FF' WHERE slug = 'finance';

-- Drop existing function and recreate with company support
DROP FUNCTION IF EXISTS generate_invoice_number();

-- Create new function that generates company-specific invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(p_company_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_year text;
  v_next_num integer;
  v_invoice_number text;
BEGIN
  -- Get current financial year (April to March)
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || 
              SUBSTRING(((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text) FROM 3 FOR 2);
  ELSE
    v_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::text || '-' || 
              SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE)::text) FROM 3 FOR 2);
  END IF;

  -- Get company prefix or default
  IF p_company_id IS NOT NULL THEN
    SELECT COALESCE(invoice_prefix, 'INV') INTO v_prefix 
    FROM companies WHERE id = p_company_id;
  END IF;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'INV';
  END IF;

  -- Get next sequence number for this company and year
  SELECT COALESCE(MAX(
    CAST(
      NULLIF(REGEXP_REPLACE(
        SUBSTRING(invoice_number FROM '[0-9]+$'), 
        '[^0-9]', '', 'g'
      ), '') AS integer
    )
  ), 0) + 1 INTO v_next_num
  FROM gst_invoices
  WHERE invoice_number LIKE v_prefix || '/' || v_year || '/%'
    AND (company_id = p_company_id OR (p_company_id IS NULL AND company_id IS NULL));

  -- Format: PREFIX/YYYY-YY/NNNN
  v_invoice_number := v_prefix || '/' || v_year || '/' || LPAD(v_next_num::text, 4, '0');

  RETURN v_invoice_number;
END;
$$;
-- ========================================
-- Migration: 20260203040335_e85247ba-77a7-4daa-bfeb-0c99d5739654.sql
-- ========================================
-- Add application_id column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS application_id text;

-- Create function to generate application ID
CREATE OR REPLACE FUNCTION generate_application_id()
RETURNS TRIGGER AS $$
DECLARE
  company_prefix text;
  sequence_num int;
  new_app_id text;
BEGIN
  -- Get company prefix based on slug
  SELECT 
    CASE 
      WHEN slug = 'credit' THEN 'CF'
      WHEN slug = 'capital' THEN 'LF'
      WHEN slug = 'finance' THEN 'FF'
      ELSE 'APP'
    END INTO company_prefix
  FROM companies 
  WHERE id = NEW.company_id;
  
  -- If no company found, use default prefix
  IF company_prefix IS NULL THEN
    company_prefix := 'APP';
  END IF;
  
  -- Get next sequence number for this company
  SELECT COALESCE(MAX(
    CASE 
      WHEN application_id ~ ('^' || company_prefix || '[0-9]+$') 
      THEN CAST(SUBSTRING(application_id FROM LENGTH(company_prefix) + 1) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1 INTO sequence_num
  FROM leads
  WHERE company_id = NEW.company_id;
  
  -- Generate application ID (e.g., CF10001, LF10001, FF10001)
  new_app_id := company_prefix || LPAD((10000 + sequence_num)::text, 5, '0');
  
  NEW.application_id := new_app_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate application_id on insert
DROP TRIGGER IF EXISTS generate_lead_application_id ON leads;
CREATE TRIGGER generate_lead_application_id
  BEFORE INSERT ON leads
  FOR EACH ROW
  WHEN (NEW.application_id IS NULL)
  EXECUTE FUNCTION generate_application_id();

-- Generate application IDs for existing leads
DO $$
DECLARE
  lead_record RECORD;
  company_prefix text;
  sequence_num int;
  new_app_id text;
BEGIN
  FOR lead_record IN 
    SELECT l.id, l.company_id, c.slug 
    FROM leads l 
    LEFT JOIN companies c ON l.company_id = c.id 
    WHERE l.application_id IS NULL
    ORDER BY l.created_at
  LOOP
    -- Get prefix
    company_prefix := CASE 
      WHEN lead_record.slug = 'credit' THEN 'CF'
      WHEN lead_record.slug = 'capital' THEN 'LF'
      WHEN lead_record.slug = 'finance' THEN 'FF'
      ELSE 'APP'
    END;
    
    -- Get next sequence
    SELECT COALESCE(MAX(
      CASE 
        WHEN application_id ~ ('^' || company_prefix || '[0-9]+$') 
        THEN CAST(SUBSTRING(application_id FROM LENGTH(company_prefix) + 1) AS INTEGER)
        ELSE 10000 
      END
    ), 10000) + 1 INTO sequence_num
    FROM leads
    WHERE company_id = lead_record.company_id
    AND application_id IS NOT NULL;
    
    new_app_id := company_prefix || LPAD(sequence_num::text, 5, '0');
    
    UPDATE leads SET application_id = new_app_id WHERE id = lead_record.id;
  END LOOP;
END $$;
-- ========================================
-- Migration: 20260203040346_628bf7c3-a5f5-4677-ad3f-fb99bdaf8fc3.sql
-- ========================================
-- Fix the generate_application_id function with proper search_path
CREATE OR REPLACE FUNCTION generate_application_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_prefix text;
  sequence_num int;
  new_app_id text;
BEGIN
  -- Get company prefix based on slug
  SELECT 
    CASE 
      WHEN slug = 'credit' THEN 'CF'
      WHEN slug = 'capital' THEN 'LF'
      WHEN slug = 'finance' THEN 'FF'
      ELSE 'APP'
    END INTO company_prefix
  FROM companies 
  WHERE id = NEW.company_id;
  
  -- If no company found, use default prefix
  IF company_prefix IS NULL THEN
    company_prefix := 'APP';
  END IF;
  
  -- Get next sequence number for this company
  SELECT COALESCE(MAX(
    CASE 
      WHEN application_id ~ ('^' || company_prefix || '[0-9]+$') 
      THEN CAST(SUBSTRING(application_id FROM LENGTH(company_prefix) + 1) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1 INTO sequence_num
  FROM leads
  WHERE company_id = NEW.company_id;
  
  -- Generate application ID (e.g., CF10001, LF10001, FF10001)
  new_app_id := company_prefix || LPAD((10000 + sequence_num)::text, 5, '0');
  
  NEW.application_id := new_app_id;
  
  RETURN NEW;
END;
$$;
-- ========================================
-- Migration: 20260203040422_692e3650-5314-498e-9f73-baaa094b145f.sql
-- ========================================
-- Fix the generate_application_id function with correct slugs
CREATE OR REPLACE FUNCTION generate_application_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_prefix text;
  sequence_num int;
  new_app_id text;
BEGIN
  -- Get company prefix based on slug (Credit=fundcera, Capital=capital, Finance=finance)
  SELECT 
    CASE 
      WHEN slug = 'fundcera' THEN 'CF'
      WHEN slug = 'capital' THEN 'LF'
      WHEN slug = 'finance' THEN 'FF'
      ELSE 'APP'
    END INTO company_prefix
  FROM companies 
  WHERE id = NEW.company_id;
  
  -- If no company found, use default prefix
  IF company_prefix IS NULL THEN
    company_prefix := 'APP';
  END IF;
  
  -- Get next sequence number for this company
  SELECT COALESCE(MAX(
    CASE 
      WHEN application_id ~ ('^' || company_prefix || '[0-9]+$') 
      THEN CAST(SUBSTRING(application_id FROM LENGTH(company_prefix) + 1) AS INTEGER)
      ELSE 10000 
    END
  ), 10000) + 1 INTO sequence_num
  FROM leads
  WHERE company_id = NEW.company_id;
  
  -- Generate application ID (e.g., CF10001, LF10001, FF10001)
  new_app_id := company_prefix || sequence_num::text;
  
  NEW.application_id := new_app_id;
  
  RETURN NEW;
END;
$$;

-- Regenerate application IDs for existing leads using DO block
DO $$
DECLARE
  rec RECORD;
  row_num int;
  prefix text;
BEGIN
  -- Credit Fundcera (fundcera slug)
  row_num := 10000;
  FOR rec IN 
    SELECT id FROM leads 
    WHERE company_id = '0a817e57-9c31-4aba-b709-3647958b917e' 
    ORDER BY created_at
  LOOP
    row_num := row_num + 1;
    UPDATE leads SET application_id = 'CF' || row_num::text WHERE id = rec.id;
  END LOOP;
  
  -- Capital Fundcera
  row_num := 10000;
  FOR rec IN 
    SELECT id FROM leads 
    WHERE company_id = 'bbe9fc5c-0caf-458e-aada-fa33143c4ff4' 
    ORDER BY created_at
  LOOP
    row_num := row_num + 1;
    UPDATE leads SET application_id = 'LF' || row_num::text WHERE id = rec.id;
  END LOOP;
  
  -- Finance Fundcera
  row_num := 10000;
  FOR rec IN 
    SELECT id FROM leads 
    WHERE company_id = 'e00c26fa-d874-4977-9fc6-bdf6e6b66344' 
    ORDER BY created_at
  LOOP
    row_num := row_num + 1;
    UPDATE leads SET application_id = 'FF' || row_num::text WHERE id = rec.id;
  END LOOP;
END $$;
-- ========================================
-- Migration: 20260203050214_72d23ff9-ae67-496a-9589-c1258bde94a4.sql
-- ========================================
-- Add company_id to blog_posts for multi-tenant blog support
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Add index for faster company filtering
CREATE INDEX IF NOT EXISTS idx_blog_posts_company_id ON public.blog_posts(company_id);

-- Allow null company_id to mean "all companies" (global posts)
-- ========================================
-- Migration: 20260203054101_fc604d45-af59-448f-9342-be557622de6a.sql
-- ========================================
-- Add SEO fields to blog_posts
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords TEXT;

-- Create lead_scores table for lead scoring system
CREATE TABLE IF NOT EXISTS public.lead_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  profile_score INTEGER DEFAULT 0,
  activity_score INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Create staff_notifications table for notification center
CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_id ON public.staff_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_is_read ON public.staff_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON public.lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON public.lead_scores(score DESC);

-- Enable RLS on new tables
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_scores (staff can view/update)
CREATE POLICY "Staff can view lead scores" 
ON public.lead_scores 
FOR SELECT 
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert lead scores" 
ON public.lead_scores 
FOR INSERT 
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update lead scores" 
ON public.lead_scores 
FOR UPDATE 
USING (public.is_staff(auth.uid()));

-- RLS policies for staff_notifications (users can only see their own)
CREATE POLICY "Users can view their own notifications" 
ON public.staff_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Staff can create notifications" 
ON public.staff_notifications 
FOR INSERT 
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Users can update their own notifications" 
ON public.staff_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add lead transfer tracking columns to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS transferred_from UUID,
ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS transfer_reason TEXT;

-- Create function to calculate lead score
CREATE OR REPLACE FUNCTION public.calculate_lead_score(p_lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_profile_score INTEGER := 0;
  v_engagement_score INTEGER := 0;
  v_activity_score INTEGER := 0;
  v_total_score INTEGER := 0;
  v_lead RECORD;
  v_call_count INTEGER;
  v_doc_count INTEGER;
BEGIN
  -- Get lead data
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Profile score (max 40 points)
  -- Higher income = higher score
  IF v_lead.monthly_income >= 100000 THEN v_profile_score := v_profile_score + 15;
  ELSIF v_lead.monthly_income >= 50000 THEN v_profile_score := v_profile_score + 10;
  ELSIF v_lead.monthly_income >= 25000 THEN v_profile_score := v_profile_score + 5;
  END IF;
  
  -- Loan amount (higher amounts = higher priority)
  IF v_lead.loan_amount >= 1000000 THEN v_profile_score := v_profile_score + 15;
  ELSIF v_lead.loan_amount >= 500000 THEN v_profile_score := v_profile_score + 10;
  ELSIF v_lead.loan_amount >= 100000 THEN v_profile_score := v_profile_score + 5;
  END IF;
  
  -- CIBIL score (if available)
  IF v_lead.cibil_score_range = '750+' THEN v_profile_score := v_profile_score + 10;
  ELSIF v_lead.cibil_score_range = '650-750' THEN v_profile_score := v_profile_score + 7;
  ELSIF v_lead.cibil_score_range = '550-650' THEN v_profile_score := v_profile_score + 3;
  END IF;
  
  -- Engagement score (max 30 points)
  -- Paid leads get bonus
  IF v_lead.status IN ('paid', 'verification', 'documents_pending', 'documents_uploaded', 'verified', 'processing', 'approved', 'disbursed') THEN
    v_engagement_score := v_engagement_score + 15;
  END IF;
  
  -- Interested leads
  IF v_lead.is_interested = true THEN
    v_engagement_score := v_engagement_score + 10;
  END IF;
  
  -- Recent leads (created in last 7 days)
  IF v_lead.created_at > now() - interval '7 days' THEN
    v_engagement_score := v_engagement_score + 5;
  END IF;
  
  -- Activity score (max 30 points)
  -- Count calls
  SELECT COUNT(*) INTO v_call_count FROM public.call_logs WHERE lead_id = p_lead_id;
  IF v_call_count >= 5 THEN v_activity_score := v_activity_score + 10;
  ELSIF v_call_count >= 2 THEN v_activity_score := v_activity_score + 5;
  END IF;
  
  -- Count documents
  SELECT COUNT(*) INTO v_doc_count FROM public.documents WHERE lead_id = p_lead_id;
  IF v_doc_count >= 3 THEN v_activity_score := v_activity_score + 20;
  ELSIF v_doc_count >= 1 THEN v_activity_score := v_activity_score + 10;
  END IF;
  
  v_total_score := v_profile_score + v_engagement_score + v_activity_score;
  
  -- Upsert score
  INSERT INTO public.lead_scores (lead_id, score, profile_score, engagement_score, activity_score, last_calculated_at)
  VALUES (p_lead_id, v_total_score, v_profile_score, v_engagement_score, v_activity_score, now())
  ON CONFLICT (lead_id) 
  DO UPDATE SET 
    score = EXCLUDED.score,
    profile_score = EXCLUDED.profile_score,
    engagement_score = EXCLUDED.engagement_score,
    activity_score = EXCLUDED.activity_score,
    last_calculated_at = now(),
    updated_at = now();
  
  RETURN v_total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- ========================================
-- Migration: 20260203061210_b4860961-0be2-4acd-8624-de5cff5b68d1.sql
-- ========================================
-- Create trigger to auto-calculate lead score after relevant actions
CREATE OR REPLACE FUNCTION public.trigger_recalculate_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate the lead score
  PERFORM calculate_lead_score(COALESCE(NEW.lead_id, OLD.lead_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on payments
DROP TRIGGER IF EXISTS recalc_score_on_payment ON payments;
CREATE TRIGGER recalc_score_on_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- Trigger on call_logs
DROP TRIGGER IF EXISTS recalc_score_on_call ON call_logs;
CREATE TRIGGER recalc_score_on_call
  AFTER INSERT ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- Trigger on documents
DROP TRIGGER IF EXISTS recalc_score_on_document ON documents;
CREATE TRIGGER recalc_score_on_document
  AFTER INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();

-- Trigger on activity_logs
DROP TRIGGER IF EXISTS recalc_score_on_activity ON activity_logs;
CREATE TRIGGER recalc_score_on_activity
  AFTER INSERT ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_lead_score();
-- ========================================
-- Migration: 20260203083636_ad540245-b739-483f-a6b8-476c0b4b1b40.sql
-- ========================================
-- Insert DLT-whitelisted URLs into system_settings
INSERT INTO system_settings (key, value, description) VALUES
  ('sms_url_credit_telecaller', 'https://credit.fundcera.com/pay/telecaller', 'DLT whitelisted URL for Credit telecaller SMS'),
  ('sms_url_credit_marketing', 'https://credit.fundcera.com/pay/marketing', 'DLT whitelisted URL for Credit marketing SMS'),
  ('sms_url_finance_telecaller', 'https://finance.fundcera.com/pay/telecaller', 'DLT whitelisted URL for Finance telecaller SMS'),
  ('sms_url_finance_marketing', 'https://finance.fundcera.com/pay/marketing', 'DLT whitelisted URL for Finance marketing SMS'),
  ('sms_url_capital_telecaller', 'https://capital.fundcera.com/pay/telecaller', 'DLT whitelisted URL for Capital telecaller SMS'),
  ('sms_url_capital_marketing', 'https://capital.fundcera.com/pay/marketing', 'DLT whitelisted URL for Capital marketing SMS')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();
-- ========================================
-- Migration: 20260203094017_1fbd1848-b162-4b81-9752-5a5ff9bc4159.sql
-- ========================================
-- Add meta_business_id column to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts 
ADD COLUMN IF NOT EXISTS meta_business_id TEXT;

-- Add unique constraint for template sync (account_id + name)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_account_name_idx 
ON public.whatsapp_templates (account_id, name);

-- Add chatbot_enabled flag to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts 
ADD COLUMN IF NOT EXISTS chatbot_enabled BOOLEAN DEFAULT false;

-- Enable realtime for whatsapp_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
-- ========================================
-- Migration: 20260203124840_dd2e8023-982d-461e-8227-a8d82780d863.sql
-- ========================================
-- Create remarketing_cycles table to track SMS campaigns for leads
CREATE TABLE public.remarketing_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '3 days'),
  sms_sent_count INTEGER NOT NULL DEFAULT 0,
  last_sms_sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Enable RLS
ALTER TABLE public.remarketing_cycles ENABLE ROW LEVEL SECURITY;

-- Policies for admin access
CREATE POLICY "Admins can manage remarketing cycles"
ON public.remarketing_cycles
FOR ALL
USING (public.is_admin(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_remarketing_cycles_updated_at
BEFORE UPDATE ON public.remarketing_cycles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_remarketing_cycles_status ON public.remarketing_cycles(status);
CREATE INDEX idx_remarketing_cycles_lead_id ON public.remarketing_cycles(lead_id);

-- Enable realtime for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.remarketing_cycles;
-- ========================================
-- Migration: 20260203175747_d8147a40-fe8c-4763-8d05-6d93adf9a441.sql
-- ========================================
-- Create RPC function to get accurate SMS statistics without row limits
CREATE OR REPLACE FUNCTION get_sms_stats(start_date TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ)
RETURNS TABLE (
  total_count BIGINT,
  sent_count BIGINT,
  delivered_count BIGINT,
  failed_count BIGINT,
  pending_count BIGINT,
  submitted_count BIGINT,
  rejected_count BIGINT,
  total_cost NUMERIC,
  by_type JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_count,
    COALESCE(SUM(COALESCE(cost_credits, 0)), 0)::NUMERIC as total_cost,
    COALESCE(
      (SELECT jsonb_object_agg(sms_type, cnt) 
       FROM (SELECT sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs 
             WHERE created_at >= start_date
             GROUP BY sms_type) sub),
      '{}'::jsonb
    ) as by_type
  FROM sms_logs
  WHERE created_at >= start_date;
END;
$$;
-- ========================================
-- Migration: 20260203180822_d251bbfd-3259-49a5-9cfd-01ca7d77782e.sql
-- ========================================
-- Add 'whatsapp' to payment_source enum
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'whatsapp';

-- Add system settings for WhatsApp payment URLs for each company
INSERT INTO system_settings (key, value, description)
VALUES 
  ('payment_url_whatsapp_fundcera', 'https://credit.fundcera.com/whatsapp', 'WhatsApp marketing payment URL for Credit Fundcera'),
  ('payment_url_whatsapp_capital', 'https://capital.fundcera.com/whatsapp', 'WhatsApp marketing payment URL for Loan Fundcera'),
  ('payment_url_whatsapp_finance', 'https://financefundcera.com/whatsapp', 'WhatsApp marketing payment URL for Finance Fundcera')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- ========================================
-- Migration: 20260203181309_09c29c1a-b072-4106-9637-d558e69e75e1.sql
-- ========================================
-- Update get_sms_stats function to support end_date parameter for accurate date range filtering
CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  total_count bigint, 
  sent_count bigint, 
  delivered_count bigint, 
  failed_count bigint, 
  pending_count bigint, 
  submitted_count bigint, 
  rejected_count bigint, 
  total_cost numeric, 
  by_type jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_count,
    COALESCE(SUM(COALESCE(cost_credits, 0)), 0)::NUMERIC as total_cost,
    COALESCE(
      (SELECT jsonb_object_agg(sms_type, cnt) 
       FROM (SELECT l.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs l
             WHERE l.created_at >= start_date
               AND (end_date IS NULL OR l.created_at <= end_date)
             GROUP BY l.sms_type) sub),
      '{}'::jsonb
    ) as by_type
  FROM sms_logs s
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date);
END;
$function$;
-- ========================================
-- Migration: 20260204035918_261a4985-31ed-4f4e-a141-237b4ab645ff.sql
-- ========================================
-- Drop the overloaded version and recreate with inclusive end_date comparison
CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  total_count bigint,
  sent_count bigint,
  delivered_count bigint,
  failed_count bigint,
  pending_count bigint,
  submitted_count bigint,
  rejected_count bigint,
  total_cost numeric,
  by_type jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_count,
    COALESCE(SUM(COALESCE(cost_credits, 0)), 0)::NUMERIC as total_cost,
    COALESCE(
      (SELECT jsonb_object_agg(l.sms_type, cnt) 
       FROM (SELECT sl.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs sl
             WHERE sl.created_at >= start_date
               AND (end_date IS NULL OR sl.created_at <= end_date)
             GROUP BY sl.sms_type) l),
      '{}'::jsonb
    ) as by_type
  FROM sms_logs s
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date);
END;
$function$;
-- ========================================
-- Migration: 20260204093314_d186abee-34f2-4f3e-ba80-475960cd8261.sql
-- ========================================
-- Add bank_application_id column to bank_submissions table
ALTER TABLE public.bank_submissions 
ADD COLUMN IF NOT EXISTS bank_application_id text;
-- ========================================
-- Migration: 20260204094802_e7afe453-e415-4f38-b797-9d3eff835e85.sql
-- ========================================
-- Create WhatsApp automation workflows table
CREATE TABLE public.whatsapp_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'incoming_message', 'keyword', 'button_click', 'no_reply_timeout'
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create workflow actions table
CREATE TABLE public.whatsapp_workflow_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'send_message', 'send_template', 'ai_reply', 'assign_agent', 'add_tag', 'stop_automation', 'delay'
  action_config JSONB DEFAULT '{}',
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create workflow execution logs
CREATE TABLE public.whatsapp_workflow_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  workflow_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  actions_executed JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'stopped'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for workflows
CREATE POLICY "Staff can view workflows" ON public.whatsapp_workflows
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage workflows" ON public.whatsapp_workflows
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS policies for actions
CREATE POLICY "Staff can view workflow actions" ON public.whatsapp_workflow_actions
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage workflow actions" ON public.whatsapp_workflow_actions
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS policies for logs
CREATE POLICY "Staff can view workflow logs" ON public.whatsapp_workflow_logs
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage workflow logs" ON public.whatsapp_workflow_logs
  FOR ALL USING (public.is_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_whatsapp_workflows_account ON public.whatsapp_workflows(account_id);
CREATE INDEX idx_whatsapp_workflows_active ON public.whatsapp_workflows(is_active);
CREATE INDEX idx_whatsapp_workflow_actions_workflow ON public.whatsapp_workflow_actions(workflow_id);
CREATE INDEX idx_whatsapp_workflow_logs_workflow ON public.whatsapp_workflow_logs(workflow_id);
CREATE INDEX idx_whatsapp_workflow_logs_phone ON public.whatsapp_workflow_logs(phone_number);
-- ========================================
-- Migration: 20260204102110_7e1fbded-949b-4f43-b904-df6a2e3789a3.sql
-- ========================================
-- Create tables for unified messaging (WhatsApp, FB Messenger, Instagram)

-- Platform type enum
DO $$ BEGIN
  CREATE TYPE message_platform AS ENUM ('whatsapp', 'facebook', 'instagram');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Meta Pages table (for FB and Instagram)
CREATE TABLE IF NOT EXISTS public.meta_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform message_platform NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT,
  instagram_account_id TEXT,
  is_active BOOLEAN DEFAULT true,
  webhook_subscribed BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, page_id)
);

-- Unified messages table to store all platform messages
CREATE TABLE IF NOT EXISTS public.unified_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform message_platform NOT NULL,
  account_id UUID, -- Reference to whatsapp_accounts for WhatsApp
  page_id UUID REFERENCES public.meta_pages(id), -- Reference to meta_pages for FB/IG
  external_id TEXT, -- Platform-specific message ID (wamid, mid, etc.)
  sender_id TEXT NOT NULL, -- Platform-specific sender ID
  sender_name TEXT,
  sender_profile_pic TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, video, audio, etc.
  attachment_url TEXT,
  direction TEXT NOT NULL DEFAULT 'incoming', -- incoming or outgoing
  status TEXT DEFAULT 'received', -- sent, delivered, read, failed
  lead_id UUID REFERENCES public.leads(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_messages_platform ON public.unified_messages(platform);
CREATE INDEX IF NOT EXISTS idx_unified_messages_sender ON public.unified_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_created ON public.unified_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_messages_lead ON public.unified_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_platform ON public.meta_pages(platform);

-- Enable RLS
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meta_pages
CREATE POLICY "Staff can view meta pages"
ON public.meta_pages FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage meta pages"
ON public.meta_pages FOR ALL
USING (public.is_admin(auth.uid()));

-- RLS Policies for unified_messages
CREATE POLICY "Staff can view unified messages"
ON public.unified_messages FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert unified messages"
ON public.unified_messages FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update unified messages"
ON public.unified_messages FOR UPDATE
USING (public.is_staff(auth.uid()));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_messages;

-- Update trigger
CREATE TRIGGER update_meta_pages_updated_at
  BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- ========================================
-- Migration: 20260205093150_c3b42344-5706-43f5-b156-e8697df14bb0.sql
-- ========================================
-- Create a table to track lead assignment history
CREATE TABLE public.lead_assignment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID, -- Can be NULL (unassigned)
  assigned_by UUID, -- Can be NULL if system-assigned
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient lookups by lead
CREATE INDEX idx_lead_assignment_history_lead_id ON public.lead_assignment_history(lead_id);
CREATE INDEX idx_lead_assignment_history_assigned_to ON public.lead_assignment_history(assigned_to);
CREATE INDEX idx_lead_assignment_history_created_at ON public.lead_assignment_history(created_at);

-- Enable RLS
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - only staff can read (all staff members can view assignment history)
CREATE POLICY "Staff can view assignment history"
ON public.lead_assignment_history
FOR SELECT
USING (public.is_staff(auth.uid()));

-- Only system (triggers) inserts records, but also allow admins
CREATE POLICY "Admins can insert assignment history"
ON public.lead_assignment_history
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Create trigger function to log assignment changes
CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log when assigned_to actually changes (including to/from NULL)
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.lead_assignment_history (lead_id, assigned_to, reason)
    VALUES (NEW.id, NEW.assigned_to, NEW.transfer_reason);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on leads table
CREATE TRIGGER trg_log_lead_assignment_change
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_assignment_change();

-- Also log initial assignment on INSERT
CREATE OR REPLACE FUNCTION public.log_initial_lead_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.lead_assignment_history (lead_id, assigned_to, reason)
    VALUES (NEW.id, NEW.assigned_to, 'Initial assignment');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_log_initial_lead_assignment
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_initial_lead_assignment();
-- ========================================
-- Migration: 20260205095335_0651f36a-4ae1-42b4-84b8-e2ecf3bb2d2e.sql
-- ========================================
-- Create table to track scheduled WhatsApp messages (for delay workflows)
CREATE TABLE IF NOT EXISTS public.whatsapp_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  message TEXT,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sequence_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, cancelled
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_pending ON public.whatsapp_scheduled_messages(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_lead ON public.whatsapp_scheduled_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_workflow ON public.whatsapp_scheduled_messages(workflow_id);

-- Enable RLS
ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Policy for staff access
CREATE POLICY "Staff can view scheduled messages"
  ON public.whatsapp_scheduled_messages
  FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage scheduled messages"
  ON public.whatsapp_scheduled_messages
  FOR ALL
  USING (public.is_staff(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_scheduled_updated_at
  BEFORE UPDATE ON public.whatsapp_scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_scheduled_messages;
-- ========================================
-- Migration: 20260205185123_ca27b1bf-9fa3-4162-ba5f-edcc67d83814.sql
-- ========================================

-- Add page_path column for analytics "Pages and Screens" reporting
ALTER TABLE public.analytics_events 
ADD COLUMN IF NOT EXISTS page_path TEXT;

-- Create index for faster page path queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON public.analytics_events(page_path);

-- ========================================
-- Migration: 20260208043734_f2d18c05-33d7-4cd7-8ba3-d1d471898f6e.sql
-- ========================================
-- Fix: Retain assignment on lost/rejected instead of clearing it
CREATE OR REPLACE FUNCTION public.auto_assign_lead_by_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_role app_role;
  target_user_id uuid;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- LOST or REJECTED: Keep the current assignment (do NOT clear it)
    IF NEW.status = 'lost' OR NEW.status = 'rejected' THEN
      RETURN NEW;
    END IF;
    
    -- PAID: Assign to verification team
    IF NEW.status = 'paid' THEN
      target_role := 'verification';
    -- VERIFICATION stages: Keep with verification team
    ELSIF NEW.status = 'verification' OR NEW.status = 'documents_pending' OR NEW.status = 'documents_uploaded' THEN
      target_role := 'verification';
    -- VERIFIED or PROCESSING: Assign to login team (sent to bank)
    ELSIF NEW.status = 'verified' OR NEW.status = 'processing' THEN
      target_role := 'login_team';
    ELSE
      -- No reassignment needed for other statuses
      RETURN NEW;
    END IF;
    
    -- Find a user with the target role (round-robin based on least assignments)
    SELECT ur.user_id INTO target_user_id
    FROM user_roles ur
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) as assignment_count
      FROM leads
      WHERE status = NEW.status
      AND assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) counts ON ur.user_id = counts.assigned_to
    WHERE ur.role = target_role
    ORDER BY COALESCE(counts.assignment_count, 0) ASC, RANDOM()
    LIMIT 1;
    
    -- Update the assigned_to field if a target user was found
    IF target_user_id IS NOT NULL THEN
      NEW.assigned_to := target_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
-- ========================================
-- Migration: 20260208045455_97cc3a06-f0f2-450b-b163-cf593a14937e.sql
-- ========================================
-- Add configurable lead assignment percentages as a system setting
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'lead_assignment_weights',
  '{"2ad61b79-d8c7-468e-a1f2-c11303167be8": 70, "c0913134-b0db-4b08-863f-e35c943a860c": 30}',
  'JSON map of telecaller user_id to assignment percentage (must sum to 100). Used by process-pending-leads for round-robin weighted distribution.'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;
-- ========================================
-- Migration: 20260208134119_1d95ac14-3886-4fb5-9f62-40381533cf59.sql
-- ========================================

-- Performance indexes for leads table
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_company_status ON public.leads (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads (assigned_to);

-- Performance indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON public.payments (lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_status ON public.payments (company_id, status, created_at DESC);

-- Performance indexes for activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_id ON public.activity_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- Performance index for call_logs
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.call_logs (lead_id);

-- Performance index for analytics created_at
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events (created_at DESC);

-- ========================================
-- Migration: 20260208135847_dfb6d509-c710-44db-83b7-046bf5a74aa6.sql
-- ========================================

-- Add company_id to workflows table for multi-tenant isolation
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Backfill: set existing workflows to the first active company (fundcera/credit)
UPDATE public.workflows 
SET company_id = (SELECT id FROM public.companies WHERE slug = 'fundcera' AND is_active = true LIMIT 1)
WHERE company_id IS NULL;

-- ========================================
-- Migration: 20260208142455_cee358e7-737d-4738-9734-0e8a4014ee46.sql
-- ========================================

-- ============================================================
-- FIX 1: Leads table - Remove overly permissive public SELECT
-- Replace with a restricted view for public phone lookups
-- ============================================================

-- Drop the dangerous public SELECT policy
DROP POLICY IF EXISTS "Public can lookup leads by phone" ON public.leads;

-- Create a restricted view with ONLY the fields needed for public flows
-- (Returning Customer lookup, Telecaller Payment Portal)
CREATE OR REPLACE VIEW public.leads_public
WITH (security_invoker = false) AS
SELECT id, full_name, phone, status, company_id, application_id, created_at
FROM public.leads;

-- Grant anonymous access to the view (not the full table)
GRANT SELECT ON public.leads_public TO anon;

-- ============================================================
-- FIX 2: OTP codes - Remove all public access policies
-- Edge functions use SERVICE_ROLE_KEY so they bypass RLS
-- ============================================================

DROP POLICY IF EXISTS "Anyone can verify OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can request OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can mark OTP verified" ON public.otp_codes;

-- Only allow service role (edge functions) to access OTP codes
-- Staff can view for debugging
CREATE POLICY "Staff can view OTP codes"
ON public.otp_codes FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- ============================================================
-- FIX 3: Storage - Restrict anonymous document uploads
-- Require path to match UUID/filename pattern (leadId folder)
-- ============================================================

DROP POLICY IF EXISTS "Anyone can upload documents" ON storage.objects;

-- Restrict uploads: path must start with a UUID-like folder name
-- and only allow specific file types
CREATE POLICY "Restricted document uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) >= 30
  AND name ~ '\.(pdf|jpg|jpeg|png|PDF|JPG|JPEG|PNG)$'
);

-- ========================================
-- Migration: 20260208142548_8f37ee5e-f5c5-4f49-927f-57ab333f4489.sql
-- ========================================

DROP VIEW IF EXISTS public.leads_public;

CREATE VIEW public.leads_public
WITH (security_invoker = false) AS
SELECT 
  id, full_name, phone, email, status, company_id, application_id, 
  loan_type, loan_amount, emi_amount, interest_rate, tenure_months,
  city, state, pincode, employment_type, source, created_at
FROM public.leads;

GRANT SELECT ON public.leads_public TO anon;
GRANT SELECT ON public.leads_public TO authenticated;

-- ========================================
-- Migration: 20260208143028_e2877d12-c65a-435f-a604-d79ed7d2ad64.sql
-- ========================================

-- ============================================================
-- FIX 1: Replace Security Definer VIEW with Security Definer FUNCTION
-- Functions with security definer are the accepted pattern
-- ============================================================

DROP VIEW IF EXISTS public.leads_public;

CREATE OR REPLACE FUNCTION public.lookup_leads_by_phone(_phone text)
RETURNS TABLE (
  id uuid, full_name text, phone text, email text, status lead_status,
  company_id uuid, application_id text, loan_type loan_type, loan_amount numeric,
  emi_amount numeric, interest_rate numeric, tenure_months integer,
  city text, state text, pincode text, employment_type employment_type,
  source text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, phone, email, status, company_id, application_id,
         loan_type, loan_amount, emi_amount, interest_rate, tenure_months,
         city, state, pincode, employment_type, source, created_at
  FROM public.leads
  WHERE phone = _phone
  ORDER BY created_at DESC;
$$;

-- Also create a lookup by ID function for DocumentUpload/CustomerPortal
CREATE OR REPLACE FUNCTION public.lookup_lead_by_id(_lead_id uuid)
RETURNS TABLE (
  id uuid, full_name text, phone text, email text, status lead_status,
  company_id uuid, application_id text, loan_type loan_type, loan_amount numeric,
  emi_amount numeric, interest_rate numeric, tenure_months integer,
  city text, state text, pincode text, employment_type employment_type,
  source text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, phone, email, status, company_id, application_id,
         loan_type, loan_amount, emi_amount, interest_rate, tenure_months,
         city, state, pincode, employment_type, source, created_at
  FROM public.leads
  WHERE id = _lead_id
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.lookup_leads_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_lead_by_id(uuid) TO anon, authenticated;

-- ============================================================
-- FIX 2: Restrict analytics_events INSERT policy
-- Require at least event_type and limit to valid event types
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Public can insert analytics events"
ON public.analytics_events FOR INSERT
WITH CHECK (
  event_type IS NOT NULL
  AND length(event_type) <= 100
  AND (page_url IS NULL OR length(page_url) <= 2000)
  AND (visitor_id IS NULL OR length(visitor_id) <= 100)
);

-- ========================================
-- Migration: 20260208143343_b71c10de-e82a-4589-987b-fbc349a9e006.sql
-- ========================================

-- Add a hashed_code column to store SHA-256 hashed OTP codes
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS hashed_code text;

-- Drop all existing public/anon policies on otp_codes to lock it down
DROP POLICY IF EXISTS "Staff can view OTP codes for debugging" ON public.otp_codes;
DROP POLICY IF EXISTS "Public can insert OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Public can update OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can insert OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can update OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Service role manages OTP codes" ON public.otp_codes;

-- Only authenticated staff (admin) can SELECT for debugging
CREATE POLICY "Only admins can view OTP codes"
ON public.otp_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No public INSERT/UPDATE/DELETE - all managed by edge functions via service role
-- RLS is enabled but no anon policies exist = anon cannot touch this table

-- ========================================
-- Migration: 20260208150902_0bcae1ce-d9e9-4197-a467-95907ef23aaa.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.get_analytics_counts(
  p_start timestamptz,
  p_end timestamptz,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE (pageviews bigint, visitors bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    COUNT(*)::bigint as pageviews,
    COUNT(DISTINCT visitor_id)::bigint as visitors
  FROM public.analytics_events
  WHERE event_type IN ('pageview', 'page_view')
    AND (page_path NOT LIKE '/admin%' OR page_path IS NULL)
    AND created_at >= p_start
    AND created_at <= p_end
    AND (
      p_company_id IS NULL 
      OR company_id = p_company_id 
      OR company_id IS NULL
    );
$$;

-- ========================================
-- Migration: 20260209161515_6ce24d42-858b-4740-a4bc-6e39622df906.sql
-- ========================================

-- Fix: Add 'received' to allowed status values for incoming messages
ALTER TABLE whatsapp_messages DROP CONSTRAINT whatsapp_messages_status_check;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check 
  CHECK (status = ANY (ARRAY['pending','sent','delivered','read','failed','received']));

-- Fix: Add more message types for incoming messages
ALTER TABLE whatsapp_messages DROP CONSTRAINT whatsapp_messages_message_type_check;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_type_check 
  CHECK (message_type = ANY (ARRAY['text','image','document','template','button','interactive','audio','video','sticker','location','contacts']));

-- ========================================
-- Migration: 20260209163233_fb38da93-20a8-444f-9d00-132cc3b94930.sql
-- ========================================

-- Add Meta-specific fields to whatsapp_templates
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS category text DEFAULT 'UTILITY';
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS meta_status text DEFAULT 'LOCAL';
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS meta_template_id text;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- ========================================
-- Migration: 20260209181935_0753139c-8ffd-4c80-bb1e-403de89f099b.sql
-- ========================================

-- Table to store scheduled workflow actions (for delays/drip sequences)
CREATE TABLE public.workflow_scheduled_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  workflow_name TEXT,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  remaining_nodes JSONB NOT NULL DEFAULT '[]',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient polling
CREATE INDEX idx_scheduled_actions_pending ON public.workflow_scheduled_actions(status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX idx_scheduled_actions_lead ON public.workflow_scheduled_actions(lead_id);

-- Enable RLS
ALTER TABLE public.workflow_scheduled_actions ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Staff can view scheduled actions"
  ON public.workflow_scheduled_actions FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage scheduled actions"
  ON public.workflow_scheduled_actions FOR ALL
  USING (public.is_staff(auth.uid()));

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_scheduled_actions;

-- ========================================
-- Migration: 20260209182620_015017bf-bf77-4ada-ab34-a8640b5593be.sql
-- ========================================

-- Drop both overloads of get_sms_stats
DROP FUNCTION IF EXISTS public.get_sms_stats(timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_sms_stats(timestamp with time zone, timestamp with time zone);

-- Recreate with error code breakdown
CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  total_count bigint, 
  sent_count bigint, 
  delivered_count bigint, 
  failed_count bigint, 
  pending_count bigint, 
  submitted_count bigint, 
  rejected_count bigint, 
  total_cost numeric, 
  by_type jsonb,
  by_error jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_count,
    COALESCE(SUM(COALESCE(cost_credits, 0)), 0)::NUMERIC as total_cost,
    COALESCE(
      (SELECT jsonb_object_agg(l.sms_type, cnt) 
       FROM (SELECT sl.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs sl
             WHERE sl.created_at >= start_date
               AND (end_date IS NULL OR sl.created_at <= end_date)
             GROUP BY sl.sms_type) l),
      '{}'::jsonb
    ) as by_type,
    COALESCE(
      (SELECT jsonb_object_agg(err_code, err_cnt)
       FROM (SELECT 
               CASE 
                 WHEN el.error_message LIKE 'Failed (Error: %)' 
                   THEN SUBSTRING(el.error_message FROM 'Failed \(Error: ([^)]+)\)')
                 WHEN el.error_message IS NOT NULL THEN el.error_message
                 ELSE 'unknown'
               END as err_code,
               COUNT(*)::BIGINT as err_cnt
             FROM sms_logs el
             WHERE el.status = 'failed'
               AND el.created_at >= start_date
               AND (end_date IS NULL OR el.created_at <= end_date)
             GROUP BY 1) errs),
      '{}'::jsonb
    ) as by_error
  FROM sms_logs s
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date);
END;
$function$;

-- ========================================
-- Migration: 20260209183430_0f52d594-aaef-4c41-903f-af57e65c2d76.sql
-- ========================================

DROP FUNCTION IF EXISTS public.get_sms_stats(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  total_count bigint, 
  sent_count bigint, 
  delivered_count bigint, 
  failed_count bigint, 
  pending_count bigint, 
  submitted_count bigint, 
  rejected_count bigint, 
  total_cost numeric, 
  total_segments bigint,
  delivered_segments bigint,
  by_type jsonb,
  by_error jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE s.status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE s.status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE s.status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::BIGINT as rejected_count,
    -- Cost based on segments: >160 chars = 2 segments, else 1
    COALESCE(
      SUM(CASE WHEN s.status = 'delivered' THEN 
        (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END) * 0.11
      ELSE 0 END), 0
    )::NUMERIC as total_cost,
    -- Total segments (all SMS)
    COALESCE(SUM(CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END), 0)::BIGINT as total_segments,
    -- Delivered segments only
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COALESCE(
      (SELECT jsonb_object_agg(l.sms_type, cnt) 
       FROM (SELECT sl.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs sl
             WHERE sl.created_at >= start_date
               AND (end_date IS NULL OR sl.created_at <= end_date)
             GROUP BY sl.sms_type) l),
      '{}'::jsonb
    ) as by_type,
    COALESCE(
      (SELECT jsonb_object_agg(err_code, err_cnt)
       FROM (SELECT 
               CASE 
                 WHEN el.error_message LIKE 'Failed (Error: %)' 
                   THEN SUBSTRING(el.error_message FROM 'Failed \(Error: ([^)]+)\)')
                 WHEN el.error_message IS NOT NULL THEN el.error_message
                 ELSE 'unknown'
               END as err_code,
               COUNT(*)::BIGINT as err_cnt
             FROM sms_logs el
             WHERE el.status = 'failed'
               AND el.created_at >= start_date
               AND (end_date IS NULL OR el.created_at <= end_date)
             GROUP BY 1) errs),
      '{}'::jsonb
    ) as by_error
  FROM sms_logs s
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date);
END;
$function$;

-- ========================================
-- Migration: 20260209193849_35f32678-f36a-49f6-9e00-d9ee2162c64b.sql
-- ========================================
ALTER TABLE public.whatsapp_campaigns ADD COLUMN IF NOT EXISTS template_name text;
-- ========================================
-- Migration: 20260209195313_d604993a-b187-41b8-bf9b-40add0ab0241.sql
-- ========================================
ALTER TABLE public.whatsapp_campaigns 
ADD COLUMN IF NOT EXISTS target_date_from timestamptz,
ADD COLUMN IF NOT EXISTS target_date_to timestamptz;
-- ========================================
-- Migration: 20260209202921_b890ebe6-2065-4ada-8a04-458e14d973e8.sql
-- ========================================
-- Add is_starred to whatsapp_messages for starring conversations
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- Add is_interested flag tracking - already exists on leads table
-- No additional schema needed for "mark as interested"

-- ========================================
-- Migration: 20260210203151_e71d9342-4508-4fae-8cc4-2e11b02ededc.sql
-- ========================================

-- Internal Chats (1:1 and group)
CREATE TABLE public.internal_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, -- null for 1:1, set for groups
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat members
CREATE TABLE public.internal_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Messages
CREATE TABLE public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, image, file
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read receipts
CREATE TABLE public.internal_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.internal_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.internal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see chats they're members of
CREATE POLICY "Users can view their chats"
  ON public.internal_chats FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_chat_members WHERE chat_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "Staff can create chats"
  ON public.internal_chats FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Admins can update chats"
  ON public.internal_chats FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.internal_chat_members WHERE chat_id = id AND user_id = auth.uid() AND role = 'admin')
  );

-- Members policies
CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_chat_members cm WHERE cm.chat_id = internal_chat_members.chat_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage members"
  ON public.internal_chat_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.internal_chat_members cm WHERE cm.chat_id = internal_chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

CREATE POLICY "Admins can remove members"
  ON public.internal_chat_members FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.internal_chat_members cm WHERE cm.chat_id = internal_chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
  );

-- Messages policies
CREATE POLICY "Members can view messages"
  ON public.internal_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_chat_members WHERE chat_id = internal_messages.chat_id AND user_id = auth.uid()
  ));

CREATE POLICY "Members can send messages"
  ON public.internal_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.internal_chat_members WHERE chat_id = internal_messages.chat_id AND user_id = auth.uid())
  );

-- Read receipts policies
CREATE POLICY "Members can view reads"
  ON public.internal_message_reads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.internal_messages m
    JOIN public.internal_chat_members cm ON cm.chat_id = m.chat_id
    WHERE m.id = internal_message_reads.message_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Users can mark as read"
  ON public.internal_message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_message_reads;

-- Trigger for updated_at
CREATE TRIGGER update_internal_chats_updated_at
  BEFORE UPDATE ON public.internal_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Migration: 20260210203701_08d3789c-cc63-458d-9589-27d71cf7fd86.sql
-- ========================================

-- Fix infinite recursion in internal_chat_members SELECT policy
DROP POLICY IF EXISTS "Members can view chat members" ON public.internal_chat_members;

CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    chat_id IN (SELECT icm.chat_id FROM public.internal_chat_members icm WHERE icm.user_id = auth.uid())
  );

-- Fix INSERT policy to allow chat creators to add initial members
DROP POLICY IF EXISTS "Admins can manage members" ON public.internal_chat_members;

CREATE POLICY "Staff can add members"
  ON public.internal_chat_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
  );

-- ========================================
-- Migration: 20260210204531_a400632b-6cd9-446c-91be-5d5ed273be04.sql
-- ========================================

-- Drop ALL existing policies on internal_chat_members to start fresh
DROP POLICY IF EXISTS "Members can view chat members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Staff can add members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.internal_chat_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.internal_chat_members;

-- Create a security definer function to check chat membership (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_chat_member(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_chat_members
    WHERE user_id = _user_id AND chat_id = _chat_id
  )
$$;

-- SELECT: staff can see members of chats they belong to
CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (public.is_chat_member(auth.uid(), chat_id));

-- INSERT: any staff can add members
CREATE POLICY "Staff can add members"
  ON public.internal_chat_members FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- DELETE: admins can remove members
CREATE POLICY "Admins can remove members"
  ON public.internal_chat_members FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ========================================
-- Migration: 20260210204852_4a21bb4e-bebb-434b-91b4-20e69009f16b.sql
-- ========================================

-- Fix: Allow users to always see their own membership + members of chats they belong to
DROP POLICY IF EXISTS "Members can view chat members" ON public.internal_chat_members;

CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_chat_member(auth.uid(), chat_id)
  );

-- ========================================
-- Migration: 20260210205425_511b2ef6-1c45-44a4-aace-607dfd583d34.sql
-- ========================================
-- Add meta_variables_count to track how many params each template expects from Meta
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS meta_variables_count integer DEFAULT 0;

-- Update existing "morning" template which expects 1 param (name)
UPDATE public.whatsapp_templates SET meta_variables_count = 1 WHERE name = 'morning';
-- ========================================
-- Migration: 20260211041121_cd3bc8eb-5725-4c69-911f-664f1630a189.sql
-- ========================================
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS header_type TEXT DEFAULT NULL;
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS header_url TEXT DEFAULT NULL;
-- ========================================
-- Migration: 20260211131738_a54c5cfd-0711-4331-b24e-7d43d90899d6.sql
-- ========================================

-- Add error_details column to whatsapp_messages for tracking delivery failures
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS error_details text;

-- Fix the expired scontent.whatsapp.net URL in morning template
UPDATE public.whatsapp_templates 
SET header_url = 'https://oreyfqrqkdgbkmnnnlqh.supabase.co/storage/v1/object/public/public-assets/fundcera-logo.png'
WHERE name = 'morning' AND header_url LIKE '%scontent.whatsapp.net%';

-- ========================================
-- Migration: 20260211133004_3c513734-a168-4a69-a7ae-169efa5903eb.sql
-- ========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('public-assets', 'public-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for public-assets" ON storage.objects FOR SELECT USING (bucket_id = 'public-assets');

-- ========================================
-- Migration: 20260212075043_280e18a5-c191-4f6f-9d46-a2be6d712481.sql
-- ========================================
-- Fix broken RLS policy for internal_chats SELECT
DROP POLICY IF EXISTS "Users can view their chats" ON public.internal_chats;
CREATE POLICY "Users can view their chats" ON public.internal_chats
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM internal_chat_members
    WHERE internal_chat_members.chat_id = internal_chats.id
    AND internal_chat_members.user_id = auth.uid()
  ));

-- Fix broken RLS policy for internal_chats UPDATE
DROP POLICY IF EXISTS "Admins can update chats" ON public.internal_chats;
CREATE POLICY "Admins can update chats" ON public.internal_chats
  FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid()) 
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM internal_chat_members
      WHERE internal_chat_members.chat_id = internal_chats.id
      AND internal_chat_members.user_id = auth.uid()
      AND internal_chat_members.role = 'admin'
    )
  );
-- ========================================
-- Migration: 20260212075930_8e89365f-288c-4296-8e17-92a6c870d0e4.sql
-- ========================================

-- Create DND (Do Not Disturb) table for WhatsApp opt-outs
CREATE TABLE public.whatsapp_dnd (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'customer_stop',
  lead_id UUID REFERENCES public.leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_dnd ENABLE ROW LEVEL SECURITY;

-- Admin/staff can view DND list
CREATE POLICY "Authenticated users can view DND list"
  ON public.whatsapp_dnd FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()));

-- Admin can manage DND
CREATE POLICY "Admins can manage DND"
  ON public.whatsapp_dnd FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Index for fast lookups
CREATE INDEX idx_whatsapp_dnd_phone ON public.whatsapp_dnd(phone);

-- ========================================
-- Migration: 20260212122912_0917aad3-38d6-4f4d-bb0e-a53e09b98283.sql
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
-- ========================================
-- Migration: 20260212135937_a329a577-98d9-400e-88f0-6eae284fd93c.sql
-- ========================================

-- 1. Create a restricted public view for system_settings (only client-safe keys)
CREATE VIEW public.public_system_settings
WITH (security_invoker = on) AS
SELECT key, value 
FROM public.system_settings
WHERE key IN (
  'consulting_fee',
  'gst_percentage', 
  'min_interest_rate',
  'max_interest_rate',
  'min_tenure_months',
  'max_tenure_months',
  'meta_pixel_id'
);

-- Allow anonymous and authenticated to read public settings
GRANT SELECT ON public.public_system_settings TO anon, authenticated;

-- 2. Remove the overly permissive policy on system_settings
DROP POLICY IF EXISTS "Anyone can read settings" ON public.system_settings;

-- 3. Create a new restricted policy - only staff can read all settings
CREATE POLICY "Staff can read all settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- 4. Create policy for anon to read only through the view
-- (The view with security_invoker will use the caller's permissions,
--  so we need a policy that allows reading the specific public keys)
CREATE POLICY "Public can read safe settings"
ON public.system_settings
FOR SELECT
TO anon
USING (key IN (
  'consulting_fee',
  'gst_percentage', 
  'min_interest_rate',
  'max_interest_rate',
  'min_tenure_months',
  'max_tenure_months',
  'meta_pixel_id'
));

-- ========================================
-- Migration: 20260213055706_951acec6-39ae-4690-80bc-895b48b4e3b6.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_telecaller()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if already assigned
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- For website/OTP leads (unpaid), do NOT assign immediately
  -- They will be processed by the background job (process-pending-leads) 
  -- which respects weighted distribution settings
  IF (NEW.source LIKE 'website%' OR NEW.source LIKE '%otp%') AND NEW.status = 'unpaid' THEN
    RETURN NEW; -- Leave unassigned for weighted assignment
  END IF;

  -- For non-website leads (like API leads, exit popup), assign immediately to telecaller
  IF NEW.status = 'unpaid' THEN
    SELECT ur.user_id INTO NEW.assigned_to
    FROM user_roles ur
    WHERE ur.role = 'telecaller'
    ORDER BY (
      SELECT COUNT(*) FROM leads l 
      WHERE l.assigned_to = ur.user_id 
        AND l.status = 'unpaid'
    ) ASC, ur.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$function$;

-- ========================================
-- Migration: 20260213060858_5b7b05ae-7009-4926-96ad-631d19d43d0a.sql
-- ========================================

-- Update the stage-based auto-assign trigger to handle the new flow:
-- If a lead transitions from 'unpaid' to 'paid' and has NO telecaller assignment,
-- it means they paid within 2 minutes (direct payment) — assign straight to verification.
-- The process-pending-leads function already handles the "not paid in 2 min → telecaller" path.

CREATE OR REPLACE FUNCTION public.auto_assign_lead_by_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_verification_user_id UUID;
  v_login_user_id UUID;
BEGIN
  -- Only act on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- PAID: Assign to verification team
  IF NEW.status = 'paid' THEN
    SELECT ur.user_id INTO v_verification_user_id
    FROM user_roles ur
    WHERE ur.role = 'verification'
    LIMIT 1;

    IF v_verification_user_id IS NOT NULL THEN
      NEW.assigned_to := v_verification_user_id;
      
      -- Log the assignment
      INSERT INTO lead_assignment_history (lead_id, assigned_to, assigned_by, reason)
      VALUES (NEW.id, v_verification_user_id, NULL, 
        CASE 
          WHEN OLD.assigned_to IS NULL THEN 'Direct payment (paid within 2 min) → verification'
          ELSE 'Paid → auto-assigned to verification'
        END
      );
    END IF;
  END IF;

  -- VERIFIED / PROCESSING: Assign to login team
  IF NEW.status IN ('verified', 'processing') AND OLD.status NOT IN ('verified', 'processing') THEN
    SELECT ur.user_id INTO v_login_user_id
    FROM user_roles ur
    WHERE ur.role = 'login_team'
    LIMIT 1;

    IF v_login_user_id IS NOT NULL THEN
      NEW.assigned_to := v_login_user_id;
      
      INSERT INTO lead_assignment_history (lead_id, assigned_to, assigned_by, reason)
      VALUES (NEW.id, v_login_user_id, NULL, 'Verified → auto-assigned to login team');
    END IF;
  END IF;

  -- LOST / REJECTED: Keep current assignment (don't clear)
  -- This ensures telecallers can still see these leads in their "Lost" tab

  RETURN NEW;
END;
$function$;

-- Ensure the trigger fires on UPDATE
DROP TRIGGER IF EXISTS trigger_auto_assign_lead_by_stage ON leads;
CREATE TRIGGER trigger_auto_assign_lead_by_stage
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_lead_by_stage();

-- ========================================
-- Migration: 20260213105323_b443fc38-2cdc-4a8b-871b-ddf208f2f6f9.sql
-- ========================================
-- Add retry tracking columns to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS retry_eligible boolean NOT NULL DEFAULT true;

-- Index for finding retryable failed messages efficiently
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_retry 
ON public.whatsapp_messages (status, retry_count, retry_eligible) 
WHERE status = 'failed' AND retry_count < 2 AND retry_eligible = true;
-- ========================================
-- Migration: 20260214061016_dc25b317-78b4-49b4-9784-95bbe9496137.sql
-- ========================================

-- Add needs_agent flag to whatsapp_messages for inbox agent identification
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS needs_agent boolean DEFAULT false;

-- Create index for quick filtering of agent-needed messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_needs_agent ON public.whatsapp_messages (needs_agent) WHERE needs_agent = true;

-- ========================================
-- Migration: 20260214125845_d40c6e55-adfe-42e8-8ff5-ea50d5228939.sql
-- ========================================

-- Add 'manager' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- ========================================
-- Migration: 20260214125855_433c3a34-052e-4596-ae5b-62ca6e2296c9.sql
-- ========================================

-- Create staff module permissions table
CREATE TABLE public.staff_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

-- Enable RLS
ALTER TABLE public.staff_module_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage all module permissions"
  ON public.staff_module_permissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Staff can read their own permissions
CREATE POLICY "Staff can read own permissions"
  ON public.staff_module_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can read all permissions
CREATE POLICY "Managers can read all permissions"
  ON public.staff_module_permissions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- Trigger for updated_at
CREATE TRIGGER update_staff_module_permissions_updated_at
  BEFORE UPDATE ON public.staff_module_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Migration: 20260217045256_063e0643-8ef6-4c56-ac1d-7cf5b0dfd963.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.get_sms_stats_by_company(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  company_id uuid,
  delivered_count bigint,
  delivered_segments bigint,
  otp_count bigint,
  remarketing_count bigint,
  other_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    l.company_id,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type = 'otp')::BIGINT as otp_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type IN ('remarketing', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as remarketing_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type NOT IN ('otp', 'remarketing', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as other_count
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
  GROUP BY l.company_id;
END;
$function$;

-- ========================================
-- Migration: 20260217072944_4168f162-0f58-40c4-a8fc-31fcecb636f2.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.get_sms_stats_by_company(start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(company_id uuid, delivered_count bigint, delivered_segments bigint, otp_count bigint, remarketing_count bigint, other_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(l.company_id, s_lead.company_id) as company_id,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type = 'otp')::BIGINT as otp_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type IN ('remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as remarketing_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type NOT IN ('otp', 'remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as other_count
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  LEFT JOIN leads s_lead ON s.lead_id IS NULL AND s_lead.phone = RIGHT(s.phone, 10)
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
  GROUP BY COALESCE(l.company_id, s_lead.company_id);
END;
$function$;

-- ========================================
-- Migration: 20260217074238_1b5f3587-fd6c-4c21-8dcf-1d1fcb199857.sql
-- ========================================

-- 1. Rename "Fundcera" to "Credit Fundcera"
UPDATE whatsapp_accounts SET name = 'Credit Fundcera' WHERE id = '14695e74-2978-492a-9d22-43a5237da840';

-- 2. Add company_id column to whatsapp_accounts
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 3. Link existing accounts to companies
UPDATE whatsapp_accounts SET company_id = '0a817e57-9c31-4aba-b709-3647958b917e' WHERE id = '14695e74-2978-492a-9d22-43a5237da840'; -- Credit Fundcera
UPDATE whatsapp_accounts SET company_id = 'e00c26fa-d874-4977-9fc6-bdf6e6b66344' WHERE id = '86053797-3ea3-4e6c-ab5e-32f770cbe579'; -- Finance Fundcera
UPDATE whatsapp_accounts SET company_id = 'bbe9fc5c-0caf-458e-aada-fa33143c4ff4' WHERE id = 'd0eb940b-2d3c-4774-a46a-a89548af4004'; -- Capital Fundcera

-- 4. Create index for company filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_company_id ON whatsapp_accounts(company_id);

-- ========================================
-- Migration: 20260217092111_614d39f8-44ae-4688-9850-5432b52e4777.sql
-- ========================================

DROP FUNCTION IF EXISTS public.get_sms_stats_by_company(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_sms_stats_by_company(start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(company_id uuid, total_sent_count bigint, delivered_count bigint, failed_count bigint, pending_count bigint, delivered_segments bigint, otp_count bigint, remarketing_count bigint, other_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(l.company_id, s_lead.company_id) as company_id,
    COUNT(*)::BIGINT as total_sent_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE s.status IN ('pending', 'submitted', 'sent'))::BIGINT as pending_count,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type = 'otp')::BIGINT as otp_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type IN ('remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as remarketing_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type NOT IN ('otp', 'remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as other_count
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  LEFT JOIN leads s_lead ON s.lead_id IS NULL AND s_lead.phone = RIGHT(s.phone, 10)
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
  GROUP BY COALESCE(l.company_id, s_lead.company_id);
END;
$function$;

-- ========================================
-- Migration: 20260217092210_123931e5-58b6-4353-a485-bdf3fe2e8346.sql
-- ========================================

ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS verified_name text;

-- ========================================
-- Migration: 20260217094321_90342a05-c65c-45a9-97ac-d0ad20cc074a.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE(
  total_count bigint,
  sent_count bigint,
  delivered_count bigint,
  failed_count bigint,
  pending_count bigint,
  submitted_count bigint,
  rejected_count bigint,
  total_cost numeric,
  total_segments bigint,
  delivered_segments bigint,
  by_type jsonb,
  by_error jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE s.status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE s.status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE s.status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::BIGINT as rejected_count,
    COALESCE(
      SUM(CASE WHEN s.status = 'delivered' THEN 
        (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END) * 0.11
      ELSE 0 END), 0
    )::NUMERIC as total_cost,
    COALESCE(SUM(CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END), 0)::BIGINT as total_segments,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COALESCE(
      (SELECT jsonb_object_agg(l.sms_type, cnt) 
       FROM (SELECT sl.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs sl
             LEFT JOIN leads ld ON sl.lead_id = ld.id
             LEFT JOIN leads ld2 ON sl.lead_id IS NULL AND ld2.phone = RIGHT(sl.phone, 10)
             WHERE sl.created_at >= start_date
               AND (end_date IS NULL OR sl.created_at <= end_date)
               AND (p_company_id IS NULL OR COALESCE(ld.company_id, ld2.company_id) = p_company_id)
             GROUP BY sl.sms_type) l),
      '{}'::jsonb
    ) as by_type,
    COALESCE(
      (SELECT jsonb_object_agg(err_code, err_cnt)
       FROM (SELECT 
               CASE 
                 WHEN el.error_message LIKE 'Failed (Error: %)' 
                   THEN SUBSTRING(el.error_message FROM 'Failed \(Error: ([^)]+)\)')
                 WHEN el.error_message IS NOT NULL THEN el.error_message
                 ELSE 'unknown'
               END as err_code,
               COUNT(*)::BIGINT as err_cnt
             FROM sms_logs el
             LEFT JOIN leads eld ON el.lead_id = eld.id
             LEFT JOIN leads eld2 ON el.lead_id IS NULL AND eld2.phone = RIGHT(el.phone, 10)
             WHERE el.status = 'failed'
               AND el.created_at >= start_date
               AND (end_date IS NULL OR el.created_at <= end_date)
               AND (p_company_id IS NULL OR COALESCE(eld.company_id, eld2.company_id) = p_company_id)
             GROUP BY 1) errs),
      '{}'::jsonb
    ) as by_error
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  LEFT JOIN leads s_lead ON s.lead_id IS NULL AND s_lead.phone = RIGHT(s.phone, 10)
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
    AND (p_company_id IS NULL OR COALESCE(l.company_id, s_lead.company_id) = p_company_id);
END;
$function$;

-- ========================================
-- Migration: 20260217102306_12a7e13c-4ca2-4fb3-96a0-874f3c798271.sql
-- ========================================
-- Drop the old 2-param version that doesn't support company filtering
DROP FUNCTION IF EXISTS public.get_sms_stats(timestamp with time zone, timestamp with time zone);

-- ========================================
-- Migration: 20260218055407_d953c3d8-b5e7-47ec-87f9-4d0f72a70c3d.sql
-- ========================================
-- Allow admins to INSERT new system settings
CREATE POLICY "Admin can insert settings"
ON public.system_settings
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- ========================================
-- Migration: 20260219115531_794f764e-c529-4a9e-94eb-b362dc37dcf4.sql
-- ========================================
-- Add media_url column to whatsapp_messages to store media URLs for images, audio, video, documents
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT DEFAULT NULL;
-- ========================================
-- Migration: 20260225055501_58ebb18b-d048-4e3c-ae7d-7b361b57d52f.sql
-- ========================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ads';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gst';
-- ========================================
-- Migration: 20260306053946_3003a759-6098-4123-9063-32d8cc09adf4.sql
-- ========================================

-- Allow staff members to manage blog posts (not just admins)
CREATE POLICY "Staff can manage blog posts"
ON public.blog_posts
FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

-- ========================================
-- Migration: 20260310074512_46dfb664-97a0-4e88-a67e-1a75c13dfdbb.sql
-- ========================================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_fbc text DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_fbp text DEFAULT NULL;
-- ========================================
-- Migration: 20260311115809_72fd6bcb-9f9c-490f-8497-e05eaa22dc7f.sql
-- ========================================

-- Add SaaS columns to companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS setup_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_fee_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS royalty_per_lead NUMERIC DEFAULT 0;

-- Company integrations table (BYOK credentials per service)
CREATE TABLE public.company_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL, -- 'whatsapp', 'sms', 'google_analytics', 'meta_pixel', 'meta_ads'
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, service_type)
);

-- Royalty transactions table
CREATE TABLE public.royalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  royalty_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'collected', 'waived'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage integrations
CREATE POLICY "Admin can manage integrations" ON public.company_integrations
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view integrations" ON public.company_integrations
  FOR SELECT USING (is_staff(auth.uid()));

-- RLS: Only admins can manage royalties
CREATE POLICY "Admin can manage royalties" ON public.royalty_transactions
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Staff can view royalties" ON public.royalty_transactions
  FOR SELECT USING (is_staff(auth.uid()));

-- Public domain lookup function (for resolving domain → company)
CREATE OR REPLACE FUNCTION public.lookup_company_by_domain(_domain TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, logo_url TEXT, primary_color TEXT, secondary_color TEXT, 
              phone TEXT, email TEXT, whatsapp_number TEXT, website_url TEXT, meta_pixel_id TEXT, 
              google_analytics_id TEXT, custom_domain TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.secondary_color,
         c.phone, c.email, c.whatsapp_number, c.website_url, c.meta_pixel_id,
         c.google_analytics_id, c.custom_domain
  FROM public.companies c
  WHERE c.is_active = true
    AND (c.custom_domain = _domain OR c.website_url LIKE '%' || _domain || '%')
  LIMIT 1;
$$;

-- Trigger function to auto-create royalty on paid leads
CREATE OR REPLACE FUNCTION public.auto_create_royalty_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_royalty NUMERIC;
  v_company_id UUID;
BEGIN
  -- Only trigger on status change to paid-related statuses
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_company_id := NEW.company_id;
    
    IF v_company_id IS NOT NULL THEN
      SELECT royalty_per_lead INTO v_royalty 
      FROM companies WHERE id = v_company_id;
      
      IF v_royalty IS NOT NULL AND v_royalty > 0 THEN
        -- Check if royalty already exists for this lead
        IF NOT EXISTS (SELECT 1 FROM royalty_transactions WHERE lead_id = NEW.id) THEN
          INSERT INTO royalty_transactions (company_id, lead_id, royalty_amount, status)
          VALUES (v_company_id, NEW.id, v_royalty, 'pending');
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to leads table
CREATE TRIGGER trigger_auto_royalty_on_paid
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_royalty_on_payment();

-- ========================================
-- Migration: 20260311120542_6d84846a-e27e-4c7b-9284-9613b2976f70.sql
-- ========================================

-- RPC to get per-company stats (bypasses 1000-row limit)
CREATE OR REPLACE FUNCTION public.get_agency_company_stats()
RETURNS TABLE(
  company_id UUID,
  total_leads BIGINT,
  paid_leads BIGINT,
  total_revenue NUMERIC,
  pending_royalty NUMERIC,
  collected_royalty NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id AS company_id,
    COALESCE(l.total_leads, 0) AS total_leads,
    COALESCE(l.paid_leads, 0) AS paid_leads,
    COALESCE(p.total_revenue, 0) AS total_revenue,
    COALESCE(r.pending_royalty, 0) AS pending_royalty,
    COALESCE(r.collected_royalty, 0) AS collected_royalty
  FROM companies c
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::BIGINT AS total_leads,
      COUNT(*) FILTER (WHERE status IN ('paid','verification','documents_pending','documents_uploaded','verified','processing','approved','disbursed'))::BIGINT AS paid_leads
    FROM leads WHERE leads.company_id = c.id
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC AS total_revenue
    FROM payments WHERE payments.company_id = c.id AND payments.status = 'captured'
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT 
      COALESCE(SUM(royalty_amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC AS pending_royalty,
      COALESCE(SUM(royalty_amount) FILTER (WHERE status = 'collected'), 0)::NUMERIC AS collected_royalty
    FROM royalty_transactions WHERE royalty_transactions.company_id = c.id
  ) r ON true
  WHERE c.is_active = true
  ORDER BY l.total_leads DESC;
$$;

-- ========================================
-- Migration: 20260325063024_78f934c3-7bc3-47dd-882f-eb9ed46bd079.sql
-- ========================================
UPDATE companies SET meta_pixel_id = '2138604833617582' WHERE slug = 'fundcera';
-- ========================================
-- Migration: 20260326042200_b0955c87-a52b-469b-8e7b-64d04059be2e.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.get_agency_company_stats()
 RETURNS TABLE(company_id uuid, total_leads bigint, paid_leads bigint, total_revenue numeric, pending_royalty numeric, collected_royalty numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    c.id AS company_id,
    COALESCE(l.total_leads, 0) AS total_leads,
    COALESCE(l.paid_leads, 0) AS paid_leads,
    COALESCE(p.total_revenue, 0) AS total_revenue,
    COALESCE(r.pending_royalty, 0) AS pending_royalty,
    COALESCE(r.collected_royalty, 0) AS collected_royalty
  FROM companies c
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::BIGINT AS total_leads,
      COUNT(*) FILTER (WHERE status IN ('paid','verification','documents_pending','documents_uploaded','verified','processing','approved','disbursed'))::BIGINT AS paid_leads
    FROM leads WHERE leads.company_id = c.id
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC AS total_revenue
    FROM payments WHERE payments.company_id = c.id AND payments.status IN ('captured', 'completed', 'paid')
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT 
      COALESCE(SUM(royalty_amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC AS pending_royalty,
      COALESCE(SUM(royalty_amount) FILTER (WHERE status = 'collected'), 0)::NUMERIC AS collected_royalty
    FROM royalty_transactions WHERE royalty_transactions.company_id = c.id
  ) r ON true
  WHERE c.is_active = true
  ORDER BY l.total_leads DESC;
$$;

-- ========================================
-- Migration: 20260423050200_01eefb92-eac2-4b54-ba98-13b2a231c5b5.sql
-- ========================================
-- 1. Drop the dangerous public SELECT policy
DROP POLICY IF EXISTS "Public can view own lead documents" ON public.documents;

-- 2. Create a SECURITY DEFINER function that returns ONLY document types
-- (no file_url, no remarks, no PII) for a given lead_id.
-- This lets the public upload page show "already uploaded" checkmarks
-- without exposing file URLs to the world.
CREATE OR REPLACE FUNCTION public.get_uploaded_document_types(_lead_id uuid)
RETURNS TABLE(document_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT document_type
  FROM public.documents
  WHERE lead_id = _lead_id;
$$;

-- 3. Allow anon + authenticated to call the safe function
GRANT EXECUTE ON FUNCTION public.get_uploaded_document_types(uuid) TO anon, authenticated;
-- ========================================
-- Migration: 20260423050400_519eba02-d094-4c8e-8c66-6717479e9aee.sql
-- ========================================
-- =========================================================
-- 1. REALTIME: Restrict postgres_changes subscriptions
-- =========================================================
-- Enable RLS on realtime.messages (idempotent)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior policy with the same name
DROP POLICY IF EXISTS "Staff can subscribe to realtime channels" ON realtime.messages;

-- Only authenticated staff users can read realtime broadcast/changes messages
CREATE POLICY "Staff can subscribe to realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- =========================================================
-- 2. STORAGE: Tighten documents bucket upload policy
-- =========================================================
-- Helper: validate that a folder name is a real lead UUID
CREATE OR REPLACE FUNCTION public.lead_exists(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads WHERE id = _lead_id);
$$;

GRANT EXECUTE ON FUNCTION public.lead_exists(uuid) TO anon, authenticated;

-- Replace weak upload policy with one that verifies the lead exists
DROP POLICY IF EXISTS "Restricted document uploads" ON storage.objects;

CREATE POLICY "Restricted document uploads"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) = 36  -- UUID length
  AND name ~ '\.(pdf|jpg|jpeg|png|PDF|JPG|JPEG|PNG)$'
  AND public.lead_exists(((storage.foldername(name))[1])::uuid)
);
-- ========================================
-- Migration: 20260424122940_86561e86-ac79-458f-a202-44978195d717.sql
-- ========================================
UPDATE public.companies SET meta_pixel_id = '2560561001026701', updated_at = now() WHERE slug = 'finance';
-- ========================================
-- Migration: 20260506082944_2695166c-8831-44ff-a60a-0e3202efea07.sql
-- ========================================
-- Restrict realtime channel subscriptions to staff users only
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read realtime messages" ON realtime.messages;
CREATE POLICY "Staff can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can broadcast realtime" ON realtime.messages;
CREATE POLICY "Staff can broadcast realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- Restrict listing of the public-assets bucket (still allow direct file reads via getPublicUrl)
-- The existing "Public read access for public-assets" policy permits SELECT on storage.objects which lets clients enumerate files.
-- Replace it so only staff can list, while object reads through public URL/CDN still work (CDN bypasses RLS for public buckets).
DROP POLICY IF EXISTS "Public assets are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for public-assets" ON storage.objects;

CREATE POLICY "Staff can list public-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));
-- ========================================
-- Migration: 20260509072252_cedb0b12-51f4-4615-82b2-8f422f7b3a70.sql
-- ========================================
-- 1. OTP codes: remove staff read & drop plaintext column
DROP POLICY IF EXISTS "Staff can view OTP codes" ON public.otp_codes;
ALTER TABLE public.otp_codes DROP COLUMN IF EXISTS code;

-- 2. WhatsApp / Meta / Integrations: remove broad staff SELECT (admin ALL policy already exists)
DROP POLICY IF EXISTS "Staff can view WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Staff can view meta pages" ON public.meta_pages;
DROP POLICY IF EXISTS "Staff can view integrations" ON public.company_integrations;

-- 3. public-assets storage bucket: restrict mutations to staff
DROP POLICY IF EXISTS "Authenticated users can upload public assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update public assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete public assets" ON storage.objects;

CREATE POLICY "Staff can upload public assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update public assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'public-assets' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete public assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'public-assets' AND public.is_staff(auth.uid()));

-- 4. staff_notifications: target user must be a staff member
DROP POLICY IF EXISTS "Staff can create notifications" ON public.staff_notifications;
CREATE POLICY "Staff can create notifications"
ON public.staff_notifications FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND public.is_staff(user_id));

-- 5. Remove remarketing_cycles from realtime publication (no staff SELECT policy exists; admin-only)
ALTER PUBLICATION supabase_realtime DROP TABLE public.remarketing_cycles;
-- ========================================
-- Migration: 20260522092639_90476ec1-dafa-4af7-bdd6-51680ab98b65.sql
-- ========================================
UPDATE public.leads
SET
  city = trim(split_part(city, ',', 1)),
  state = COALESCE(NULLIF(trim(substring(city from ',(.*)$')), ''), state),
  cibil_score_range = COALESCE(
    NULLIF(cibil_score_range, ''),
    NULLIF(substring(source from 'cibil=([^;]+)'), '')
  ),
  current_monthly_emi = COALESCE(
    current_monthly_emi,
    NULLIF(substring(source from 'emi=([^;]+)'), '')::numeric
  ),
  source = NULLIF(trim(split_part(source, ';', 1)), ''),
  updated_at = now()
WHERE
  (city LIKE '%,%' OR source LIKE '%;cibil=%' OR source LIKE '%;emi=%')
  AND source LIKE 'fundkredit%';
-- ========================================
-- Migration: 20260522092704_0479161e-7774-46d1-93bf-408ae1d72ab0.sql
-- ========================================
UPDATE public.leads
SET source = 'fundkredit', updated_at = now()
WHERE source ILIKE 'fundkredit%';
-- ========================================
-- Migration: 20260526074909_764b522e-46bb-4779-b7de-38f782c64505.sql
-- ========================================

CREATE TEMP TABLE _lead_dup_map AS
WITH ranked AS (
  SELECT id, company_id, phone,
    ROW_NUMBER() OVER (PARTITION BY company_id, phone ORDER BY created_at DESC, id DESC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY company_id, phone ORDER BY created_at DESC, id DESC) AS keeper_id
  FROM public.leads
)
SELECT id AS dup_id, keeper_id FROM ranked WHERE rn > 1;

DELETE FROM public.lead_scores WHERE lead_id IN (SELECT dup_id FROM _lead_dup_map);
DELETE FROM public.remarketing_cycles WHERE lead_id IN (SELECT dup_id FROM _lead_dup_map);

UPDATE public.payments p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.documents p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.call_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.activity_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.bank_submissions p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.accounting_entries p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.gst_invoices p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_messages p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.sms_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.workflow_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_workflow_logs p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.unified_messages p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.lead_assignment_history p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_scheduled_messages p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.workflow_scheduled_actions p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.whatsapp_dnd p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;
UPDATE public.royalty_transactions p SET lead_id = m.keeper_id FROM _lead_dup_map m WHERE p.lead_id = m.dup_id;

DELETE FROM public.leads WHERE id IN (SELECT dup_id FROM _lead_dup_map);

CREATE UNIQUE INDEX IF NOT EXISTS leads_company_phone_unique ON public.leads (company_id, phone);

-- ========================================
-- Migration: 20260526080503_5f788ba9-f302-4204-865c-f5bda1abb15e.sql
-- ========================================
ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_lead_id_fkey;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
-- ========================================
-- Migration: 20260606055547_9b8fefcb-ce91-40cd-b785-24dee6bfc300.sql
-- ========================================
SELECT cron.schedule(
  'whatsapp-remarketing-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oreyfqrqkdgbkmnnnlqh.supabase.co/functions/v1/whatsapp-remarketing-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
-- ========================================
-- Migration: 20260606055603_b23f83c7-e547-4d18-a877-ce588a7fd948.sql
-- ========================================
SELECT cron.unschedule('whatsapp-remarketing-scheduler');
SELECT cron.schedule(
  'whatsapp-remarketing-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://oreyfqrqkdgbkmnnnlqh.supabase.co/functions/v1/whatsapp-remarketing-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZXlmcXJxa2RnYmttbm5ubHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTEzMTYsImV4cCI6MjA4NTA4NzMxNn0.1TKH9Bs-coTUNdfK6kkXJoFIDLXOWFUzjt60dkfXLFk"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
-- ========================================
-- Migration: 20260606060500_dd8fcfa7-b2dd-4f3b-a233-908882bcbaaa.sql
-- ========================================
DROP POLICY IF EXISTS "Public can upload documents via link" ON public.documents;
CREATE POLICY "Public can upload documents via link"
ON public.documents
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = ANY (ARRAY['pending'::document_status, 'uploaded'::document_status])
  AND lead_id IS NOT NULL
  AND public.lead_exists(lead_id)
);
-- ========================================
-- Migration: 20260609051903_b6f8f991-e49f-4c30-a19a-527bf7abee70.sql
-- ========================================
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS stable_header_image_url text;
-- ========================================
-- Migration: 20260609053904_df5e1d18-fcef-4995-8bfd-7b95f3bfa2dd.sql
-- ========================================
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'telecaller', 'verification', 'login_team')
  )
$function$;

DROP POLICY IF EXISTS "Block client OTP inserts" ON public.otp_codes;
CREATE POLICY "Block client OTP inserts"
  ON public.otp_codes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block client OTP deletes" ON public.otp_codes;
CREATE POLICY "Block client OTP deletes"
  ON public.otp_codes
  FOR DELETE
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Block client OTP updates" ON public.otp_codes;
CREATE POLICY "Block client OTP updates"
  ON public.otp_codes
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Admin can update documents" ON storage.objects;
CREATE POLICY "Admin can update documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'::app_role));
-- ========================================
-- Migration: 20260612120000_franchise_sms_company.sql
-- ========================================
-- Migration: 20260612120000_franchise_sms_company.sql
-- Add company_id to sms_logs for per-franchise SMS tracking

ALTER TABLE public.sms_logs 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_company_id ON public.sms_logs(company_id);

-- ========================================
-- Migration: 20260612120100_franchise_whatsapp_company.sql
-- ========================================
-- Migration: 20260612120100_franchise_whatsapp_company.sql
-- Link whatsapp_accounts to companies for per-franchise WABA

ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_company_id ON public.whatsapp_accounts(company_id);

-- Helper: get default WhatsApp account for a company
CREATE OR REPLACE FUNCTION public.get_company_whatsapp_account(p_company_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.whatsapp_accounts 
  WHERE company_id = p_company_id 
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- ========================================
-- Migration: 20260612120200_franchise_owner_role.sql
-- ========================================
-- Migration: 20260612120200_franchise_owner_role.sql
-- Add franchise_owner role and supporting table/functions/policies

-- Add franchise_owner to app_role enum
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'franchise_owner';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table to map franchise owners to their company
CREATE TABLE IF NOT EXISTS public.franchise_owner_companies (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.franchise_owner_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages franchise owners" ON public.franchise_owner_companies
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Franchise owner sees own record" ON public.franchise_owner_companies
  FOR SELECT USING (auth.uid() = user_id);

-- Helper: get franchise owner's company_id
CREATE OR REPLACE FUNCTION public.get_franchise_owner_company(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.franchise_owner_companies WHERE user_id = _user_id;
$$;

-- Helper: check if user is a franchise owner
CREATE OR REPLACE FUNCTION public.is_franchise_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.franchise_owner_companies WHERE user_id = _user_id
  );
$$;

-- Update is_staff to include franchise_owner
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'manager', 'telecaller', 'verification', 'login_team', 'franchise_owner')
  ) OR public.is_franchise_owner(_user_id);
$$;

-- RLS: Franchise owner sees only their company's leads
CREATE POLICY "Franchise owner sees own company leads" ON public.leads
  FOR SELECT USING (
    public.company_id = public.get_franchise_owner_company(auth.uid())
  );

-- RLS: Franchise owner sees only their company's payments
CREATE POLICY "Franchise owner sees own company payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leads l 
      WHERE l.id = lead_id 
        AND l.company_id = public.get_franchise_owner_company(auth.uid())
    )
  );

-- RLS: Franchise owner sees only their company's documents
CREATE POLICY "Franchise owner sees own company documents" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leads l 
      WHERE l.id = lead_id 
        AND l.company_id = public.get_franchise_owner_company(auth.uid())
    )
  );

-- ========================================
-- Migration: 20260612120300_royalty_enhancements.sql
-- ========================================
-- Migration: 20260612120300_royalty_enhancements.sql
-- Enhance royalty tracking with invoice numbers, due dates, monthly grouping, and bulk collection

-- Enhance royalty_transactions table
ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS royalty_type    TEXT NOT NULL DEFAULT 'per_lead',
  ADD COLUMN IF NOT EXISTS invoice_number  TEXT,
  ADD COLUMN IF NOT EXISTS due_date        DATE,
  ADD COLUMN IF NOT EXISTS month_year      TEXT; -- e.g. '2026-06' for grouping

-- Auto-set month_year (and optionally due_date) on insert
CREATE OR REPLACE FUNCTION public.set_royalty_month_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.month_year := TO_CHAR(NEW.created_at, 'YYYY-MM');
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (DATE_TRUNC('month', NEW.created_at) + INTERVAL '1 month' + INTERVAL '7 days')::DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger first if it exists, then recreate to keep idempotent
DROP TRIGGER IF EXISTS trigger_royalty_month_year ON public.royalty_transactions;

CREATE TRIGGER trigger_royalty_month_year
  BEFORE INSERT ON public.royalty_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_royalty_month_year();

-- Monthly summary view
CREATE OR REPLACE VIEW public.royalty_monthly_summary AS
SELECT 
  rt.company_id,
  c.name                                                                          AS company_name,
  rt.month_year,
  COUNT(*)                                                                        AS transaction_count,
  SUM(rt.royalty_amount)                                                          AS total_royalty,
  SUM(CASE WHEN rt.status = 'collected' THEN rt.royalty_amount ELSE 0 END)       AS collected,
  SUM(CASE WHEN rt.status = 'pending'   THEN rt.royalty_amount ELSE 0 END)       AS pending,
  MIN(rt.due_date)                                                                AS earliest_due_date,
  MAX(rt.created_at)                                                              AS last_transaction_at
FROM public.royalty_transactions rt
JOIN public.companies c ON c.id = rt.company_id
GROUP BY rt.company_id, c.name, rt.month_year;

-- Sequence for sequential invoice numbers
CREATE SEQUENCE IF NOT EXISTS royalty_invoice_seq START 1000;

-- Generate a formatted invoice number: ROY-YYYYMM-NNNN
CREATE OR REPLACE FUNCTION public.generate_royalty_invoice_number(p_company_id UUID, p_month_year TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num TEXT;
BEGIN
  v_num := 'ROY-' || REPLACE(p_month_year, '-', '') || '-' || LPAD(NEXTVAL('royalty_invoice_seq')::TEXT, 4, '0');
  RETURN v_num;
END;
$$;

-- Bulk-collect all pending royalties for a company+month and stamp them with one invoice number
CREATE OR REPLACE FUNCTION public.collect_royalties_bulk(p_company_id UUID, p_month_year TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice TEXT;
  v_count   INTEGER;
BEGIN
  v_invoice := public.generate_royalty_invoice_number(p_company_id, p_month_year);

  UPDATE public.royalty_transactions
  SET status         = 'collected',
      collected_at   = now(),
      invoice_number = v_invoice
  WHERE company_id = p_company_id
    AND month_year  = p_month_year
    AND status      = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ========================================
-- Migration: 20260613110000_add_monthly_fee_to_companies.sql
-- ========================================
-- Add monthly_fee column to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 0;

-- ========================================
-- Migration: 20260613112000_fix_royalty_trigger_month_year.sql
-- ========================================
-- Migration: 20260613112000_fix_royalty_trigger_month_year.sql
-- Fix set_royalty_month_year function to handle default created_at being evaluated after before-insert trigger

CREATE OR REPLACE FUNCTION public.set_royalty_month_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.month_year := TO_CHAR(COALESCE(NEW.created_at, now()), 'YYYY-MM');
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (DATE_TRUNC('month', COALESCE(NEW.created_at, now())) + INTERVAL '1 month' + INTERVAL '7 days')::DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- Update any existing royalty transactions with NULL month_year or due_date
UPDATE public.royalty_transactions
SET month_year = TO_CHAR(created_at, 'YYYY-MM')
WHERE month_year IS NULL;

UPDATE public.royalty_transactions
SET due_date = (DATE_TRUNC('month', created_at) + INTERVAL '1 month' + INTERVAL '7 days')::DATE
WHERE due_date IS NULL;

-- ========================================
-- Migration: 20260614111940_81b22706-6751-43f7-a840-5ad1e40435a3.sql
-- ========================================

ALTER VIEW public.royalty_monthly_summary SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'manager', 'telecaller', 'verification', 'login_team')
  );
$function$;

DROP POLICY IF EXISTS "Only admins can view OTP codes" ON public.otp_codes;

-- ========================================
-- Migration: 20260614112000_seed_default_companies.sql
-- ========================================
-- Migration: 20260614112000_seed_default_companies.sql
-- Seed default companies for Capital Fundcera and Finance Fundcera if they don't exist

-- 1. Seed 'capital' company
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active)
VALUES (
  'bbe9fc5c-0caf-458e-aada-fa33143c4ff4', -- Hardcoded UUID referenced in previous migrations for Capital
  'Capital Fundcera',
  'capital',
  '#0f2744',
  '#f59e0b',
  '+91 9422799318',
  'capital@fundcera.com',
  '918469391818',
  'Surat, Gujarat, India',
  'https://capital.fundcera.com',
  true
)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    phone = COALESCE(companies.phone, EXCLUDED.phone),
    email = COALESCE(companies.email, EXCLUDED.email),
    whatsapp_number = COALESCE(companies.whatsapp_number, EXCLUDED.whatsapp_number),
    address = COALESCE(companies.address, EXCLUDED.address),
    website_url = COALESCE(companies.website_url, EXCLUDED.website_url);

-- 2. Seed 'finance' company
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active)
VALUES (
  'cce9fc5c-0caf-458e-aada-fa33143c4ff5',
  'Finance Fundcera',
  'finance',
  '#1e3a5f',
  '#f59e0b',
  '+91 9422799318',
  'finance@fundcera.com',
  '918469391818',
  'Surat, Gujarat, India',
  'https://finance.fundcera.com',
  true
)
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    phone = COALESCE(companies.phone, EXCLUDED.phone),
    email = COALESCE(companies.email, EXCLUDED.email),
    whatsapp_number = COALESCE(companies.whatsapp_number, EXCLUDED.whatsapp_number),
    address = COALESCE(companies.address, EXCLUDED.address),
    website_url = COALESCE(companies.website_url, EXCLUDED.website_url);

-- 3. Link loose leads matching target slug source directly to their corresponding company_id
UPDATE public.leads
SET company_id = 'bbe9fc5c-0caf-458e-aada-fa33143c4ff4'
WHERE company_id IS NULL AND source = 'capital';

UPDATE public.leads
SET company_id = 'cce9fc5c-0caf-458e-aada-fa33143c4ff5'
WHERE company_id IS NULL AND source = 'finance';

-- ========================================
-- Migration: 20260614123000_franchise_logins_and_fees.sql
-- ========================================
-- Migration: 20260614123000_franchise_logins_and_fees.sql
-- Configure franchise details and logins for credit, finance, and capital

-- 1. Ensure the default companies exist and have pricing terms configured
-- Update 'fundcera' (Credit)
UPDATE public.companies
SET monthly_fee = 10000,
    setup_fee = 50000,
    setup_fee_paid = true,
    royalty_per_lead = 100,
    is_active = true
WHERE slug = 'fundcera';

-- Seed / Update 'capital'
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active, monthly_fee, setup_fee, setup_fee_paid, royalty_per_lead)
VALUES (
  'bbe9fc5c-0caf-458e-aada-fa33143c4ff4',
  'Capital Fundcera',
  'capital',
  '#0f2744',
  '#f59e0b',
  '+91 9422799318',
  'capital@fundcera.com',
  '918469391818',
  'Surat, Gujarat, India',
  'https://capital.fundcera.com',
  true,
  10000,
  50000,
  true,
  100
)
ON CONFLICT (slug) DO UPDATE
SET monthly_fee = EXCLUDED.monthly_fee,
    setup_fee = EXCLUDED.setup_fee,
    setup_fee_paid = EXCLUDED.setup_fee_paid,
    royalty_per_lead = EXCLUDED.royalty_per_lead;

-- Seed / Update 'finance'
INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, phone, email, whatsapp_number, address, website_url, is_active, monthly_fee, setup_fee, setup_fee_paid, royalty_per_lead)
VALUES (
  'cce9fc5c-0caf-458e-aada-fa33143c4ff5',
  'Finance Fundcera',
  'finance',
  '#1e3a5f',
  '#f59e0b',
  '+91 9422799318',
  'finance@fundcera.com',
  '918469391818',
  'Surat, Gujarat, India',
  'https://finance.fundcera.com',
  true,
  10000,
  50000,
  true,
  100
)
ON CONFLICT (slug) DO UPDATE
SET monthly_fee = EXCLUDED.monthly_fee,
    setup_fee = EXCLUDED.setup_fee,
    setup_fee_paid = EXCLUDED.setup_fee_paid,
    royalty_per_lead = EXCLUDED.royalty_per_lead;


-- 2. Seed default franchise owner & admin accounts in auth.users using a robust DO block
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- A. Capital Owner: capital_owner@fundcera.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'capital_owner@fundcera.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Password123', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda1-0caf-458e-aada-fa33143c4ff4';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'capital_owner@fundcera.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Capital Franchise Owner"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Capital Owner
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'capital_owner@fundcera.com'),
      'email',
      now(),
      now(),
      now(),
      'capital_owner@fundcera.com'
    );
  END IF;

  -- B. Finance Owner: finance_owner@fundcera.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'finance_owner@fundcera.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Password123', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda2-0caf-458e-aada-fa33143c4ff5';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'finance_owner@fundcera.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Finance Franchise Owner"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Finance Owner
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'finance_owner@fundcera.com'),
      'email',
      now(),
      now(),
      now(),
      'finance_owner@fundcera.com'
    );
  END IF;

  -- C. Master Admin Account: fundcera@gmail.com / Fundcera@1818
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'fundcera@gmail.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Fundcera@1818', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda0-0caf-458e-aada-fa33143c4ff3';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'fundcera@gmail.com',
      extensions.crypt('Fundcera@1818', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Master Admin"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Master Admin
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'fundcera@gmail.com'),
      'email',
      now(),
      now(),
      now(),
      'fundcera@gmail.com'
    );
  END IF;

  -- D. Credit Owner: credit_owner@fundcera.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'credit_owner@fundcera.com' AND deleted_at IS NULL LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Password123', extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := 'abeceda3-0caf-458e-aada-fa33143c4ff6';
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, email_change_token_current, 
      phone_change, phone_change_token, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'credit_owner@fundcera.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Credit Franchise Owner"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '',
      '', '', ''
    );
  END IF;

  -- Identity for Credit Owner
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
    VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', 'credit_owner@fundcera.com'),
      'email',
      now(),
      now(),
      now(),
      'credit_owner@fundcera.com'
    );
  END IF;
END $$;


-- 3. Dynamically resolve User IDs & Company IDs and map roles and companies
DO $$
DECLARE
  v_capital_user_id UUID;
  v_finance_user_id UUID;
  v_credit_user_id UUID;
  v_admin_user_id UUID;
  
  v_capital_company_id UUID;
  v_finance_company_id UUID;
  v_fundcera_company_id UUID;
BEGIN
  -- Fetch user IDs dynamically by email (handles cases where users already exist with other UUIDs)
  SELECT id INTO v_capital_user_id FROM auth.users WHERE email = 'capital_owner@fundcera.com' LIMIT 1;
  SELECT id INTO v_finance_user_id FROM auth.users WHERE email = 'finance_owner@fundcera.com' LIMIT 1;
  SELECT id INTO v_credit_user_id FROM auth.users WHERE email = 'credit_owner@fundcera.com' LIMIT 1;
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = 'fundcera@gmail.com' LIMIT 1;

  -- Fetch company IDs dynamically by slug
  SELECT id INTO v_capital_company_id FROM public.companies WHERE slug = 'capital' LIMIT 1;
  SELECT id INTO v_finance_company_id FROM public.companies WHERE slug = 'finance' LIMIT 1;
  SELECT id INTO v_fundcera_company_id FROM public.companies WHERE slug = 'fundcera' LIMIT 1;

  -- A. Setup Capital Owner Profiles, Roles, and Mappings
  IF v_capital_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_capital_user_id, 'capital_owner@fundcera.com', 'Capital Franchise Owner')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_capital_user_id, 'franchise_owner')
    ON CONFLICT DO NOTHING;

    IF v_capital_company_id IS NOT NULL THEN
      INSERT INTO public.franchise_owner_companies (user_id, company_id)
      VALUES (v_capital_user_id, v_capital_company_id)
      ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

      INSERT INTO public.company_users (user_id, company_id)
      VALUES (v_capital_user_id, v_capital_company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- B. Setup Finance Owner Profiles, Roles, and Mappings
  IF v_finance_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_finance_user_id, 'finance_owner@fundcera.com', 'Finance Franchise Owner')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_finance_user_id, 'franchise_owner')
    ON CONFLICT DO NOTHING;

    IF v_finance_company_id IS NOT NULL THEN
      INSERT INTO public.franchise_owner_companies (user_id, company_id)
      VALUES (v_finance_user_id, v_finance_company_id)
      ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

      INSERT INTO public.company_users (user_id, company_id)
      VALUES (v_finance_user_id, v_finance_company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- C. Setup Master Admin Profiles and Roles (no company lock)
  IF v_admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_admin_user_id, 'fundcera@gmail.com', 'Master Admin')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_user_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  -- D. Setup Credit Owner (Fundcera) Profiles, Roles, and Mappings
  IF v_credit_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_credit_user_id, 'credit_owner@fundcera.com', 'Credit Franchise Owner')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_credit_user_id, 'franchise_owner')
    ON CONFLICT DO NOTHING;

    IF v_fundcera_company_id IS NOT NULL THEN
      INSERT INTO public.franchise_owner_companies (user_id, company_id)
      VALUES (v_credit_user_id, v_fundcera_company_id)
      ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

      INSERT INTO public.company_users (user_id, company_id)
      VALUES (v_credit_user_id, v_fundcera_company_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;


-- 4. Clean up any existing manual auth.users rows that have NULL values in required text fields
UPDATE auth.users 
SET confirmation_token = COALESCE(confirmation_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    recovery_token = COALESCE(recovery_token, '')
WHERE email IN ('fundcera@gmail.com', 'capital_owner@fundcera.com', 'finance_owner@fundcera.com', 'credit_owner@fundcera.com');

-- ========================================
-- Migration: 20260614133000_monthly_royalty_billing.sql
-- ========================================
-- Migration: 20260614133000_monthly_royalty_billing.sql
-- Restructure royalty transactions from per-lead events to monthly aggregated invoices with GST and revenue-share percentage options.

-- 1. Clean up old transaction-level rows
TRUNCATE public.royalty_transactions CASCADE;

-- 2. Add new columns to companies table for pricing models
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS royalty_type        TEXT NOT NULL DEFAULT 'per_lead',
  ADD COLUMN IF NOT EXISTS royalty_percentage  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_rate            NUMERIC NOT NULL DEFAULT 18.0;

-- 3. Modify royalty_transactions to support monthly invoices
ALTER TABLE public.royalty_transactions
  ALTER COLUMN lead_id DROP NOT NULL,
  ALTER COLUMN payment_id DROP NOT NULL;

ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS monthly_fee     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount      NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_amount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure unique constraint on company_id and month_year
ALTER TABLE public.royalty_transactions
  DROP CONSTRAINT IF EXISTS unique_company_month_invoice;

ALTER TABLE public.royalty_transactions
  ADD CONSTRAINT unique_company_month_invoice UNIQUE (company_id, month_year);

-- 4. Drop old triggers and functions
DROP TRIGGER IF EXISTS trigger_auto_royalty_on_paid ON public.leads;
DROP FUNCTION IF EXISTS public.auto_create_royalty_on_payment();
DROP TRIGGER IF EXISTS trigger_royalty_month_year ON public.royalty_transactions;
DROP FUNCTION IF EXISTS public.set_royalty_month_year();

-- 5. Create core PL/pgSQL function to refresh/calculate a monthly invoice
CREATE OR REPLACE FUNCTION public.refresh_monthly_royalty_invoice(p_company_id UUID, p_month_year TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_fee NUMERIC;
  v_setup_fee NUMERIC;
  v_royalty_per_lead NUMERIC;
  v_royalty_type TEXT;
  v_royalty_percentage NUMERIC;
  v_gst_rate NUMERIC;
  
  v_lead_count INTEGER;
  v_revenue_amount NUMERIC;
  v_royalty_amount NUMERIC;
  v_gst_amount NUMERIC;
  v_total_amount NUMERIC;
  v_invoice_number TEXT;
  v_due_date DATE;
  v_status TEXT := 'pending';
BEGIN
  -- A. Fetch company pricing terms
  SELECT 
    COALESCE(monthly_fee, 0), 
    COALESCE(setup_fee, 0), 
    COALESCE(royalty_per_lead, 0), 
    COALESCE(royalty_type, 'per_lead'), 
    COALESCE(royalty_percentage, 0), 
    COALESCE(gst_rate, 18.0)
  INTO 
    v_monthly_fee, v_setup_fee, v_royalty_per_lead, v_royalty_type, v_royalty_percentage, v_gst_rate
  FROM public.companies
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- B. Count paid leads in that month
  SELECT COUNT(*)::INTEGER INTO v_lead_count
  FROM public.leads
  WHERE company_id = p_company_id
    AND status = 'paid'
    AND TO_CHAR(updated_at, 'YYYY-MM') = p_month_year;
     
  -- C. Sum completed payments in that month
  SELECT COALESCE(SUM(amount), 0)::NUMERIC INTO v_revenue_amount
  FROM public.payments
  WHERE company_id = p_company_id
    AND status IN ('captured', 'completed', 'paid')
    AND TO_CHAR(created_at, 'YYYY-MM') = p_month_year;
     
  -- D. Calculate royalty amount based on pricing model
  IF v_royalty_type = 'percentage' THEN
    v_royalty_amount := v_revenue_amount * (v_royalty_percentage / 100.0);
  ELSE
    v_royalty_amount := v_lead_count * v_royalty_per_lead;
  END IF;
  
  -- E. Calculate GST of 18% (or company set gst_rate) on the royalty amount
  v_gst_amount := v_royalty_amount * (v_gst_rate / 100.0);
  
  -- F. Calculate invoice total
  v_total_amount := v_monthly_fee + v_royalty_amount + v_gst_amount;
  
  -- G. Keep existing status and invoice number if already present
  SELECT status, invoice_number INTO v_status, v_invoice_number
  FROM public.royalty_transactions
  WHERE company_id = p_company_id AND month_year = p_month_year;
  
  IF v_invoice_number IS NULL THEN
    v_invoice_number := public.generate_royalty_invoice_number(p_company_id, p_month_year);
  END IF;
  
  IF v_status IS NULL THEN
    v_status := 'pending';
  END IF;
  
  -- Calculate due date: 7th of next month
  v_due_date := (DATE_TRUNC('month', TO_DATE(p_month_year || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' + INTERVAL '6 days')::DATE;
  
  -- H. Upsert invoice row
  INSERT INTO public.royalty_transactions (
    company_id,
    month_year,
    royalty_amount,
    monthly_fee,
    gst_amount,
    total_amount,
    lead_count,
    revenue_amount,
    invoice_number,
    due_date,
    status,
    royalty_type
  )
  VALUES (
    p_company_id,
    p_month_year,
    v_royalty_amount,
    v_monthly_fee,
    v_gst_amount,
    v_total_amount,
    v_lead_count,
    v_revenue_amount,
    v_invoice_number,
    v_due_date,
    v_status,
    v_royalty_type
  )
  ON CONFLICT (company_id, month_year) DO UPDATE SET
    royalty_amount = EXCLUDED.royalty_amount,
    monthly_fee = EXCLUDED.monthly_fee,
    gst_amount = EXCLUDED.gst_amount,
    total_amount = EXCLUDED.total_amount,
    lead_count = EXCLUDED.lead_count,
    revenue_amount = EXCLUDED.revenue_amount,
    due_date = EXCLUDED.due_date,
    royalty_type = EXCLUDED.royalty_type,
    updated_at = now();
END;
$$;

-- 6. Trigger for leads updates
CREATE OR REPLACE FUNCTION public.trigger_refresh_monthly_royalty_on_lead_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    PERFORM public.refresh_monthly_royalty_invoice(NEW.company_id, TO_CHAR(NEW.updated_at, 'YYYY-MM'));
  END IF;
  IF OLD.company_id IS NOT NULL AND OLD.company_id != NEW.company_id THEN
    PERFORM public.refresh_monthly_royalty_invoice(OLD.company_id, TO_CHAR(OLD.updated_at, 'YYYY-MM'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_lead_refresh_monthly_royalty
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_monthly_royalty_on_lead_change();

-- 7. Trigger for payments updates/inserts
CREATE OR REPLACE FUNCTION public.trigger_refresh_monthly_royalty_on_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    PERFORM public.refresh_monthly_royalty_invoice(NEW.company_id, TO_CHAR(NEW.created_at, 'YYYY-MM'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_payment_refresh_monthly_royalty
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_monthly_royalty_on_payment_change();

-- 8. Re-define royalty_monthly_summary view to serve from new invoice structure
CREATE OR REPLACE VIEW public.royalty_monthly_summary AS
SELECT 
  rt.id                                                                  AS id,
  rt.company_id,
  c.name                                                                 AS company_name,
  rt.month_year,
  rt.lead_count                                                          AS transaction_count,
  rt.revenue_amount                                                      AS revenue_amount,
  rt.royalty_amount                                                      AS total_royalty,
  rt.monthly_fee                                                         AS monthly_fee,
  rt.gst_amount                                                          AS gst_amount,
  rt.total_amount                                                        AS total_amount,
  CASE WHEN rt.status = 'collected' THEN rt.total_amount ELSE 0 END      AS collected,
  CASE WHEN rt.status = 'pending'   THEN rt.total_amount ELSE 0 END      AS pending,
  rt.due_date                                                            AS earliest_due_date,
  rt.updated_at                                                          AS last_transaction_at,
  rt.invoice_number                                                      AS invoice_number,
  rt.status                                                              AS status
FROM public.royalty_transactions rt
JOIN public.companies c ON c.id = rt.company_id;

-- 9. Auto-calculate and seed invoices based on all existing leads and payments in the DB
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT company_id, TO_CHAR(updated_at, 'YYYY-MM') AS month_year
    FROM public.leads
    WHERE company_id IS NOT NULL
    UNION
    SELECT DISTINCT company_id, TO_CHAR(created_at, 'YYYY-MM') AS month_year
    FROM public.payments
    WHERE company_id IS NOT NULL
  ) LOOP
    PERFORM public.refresh_monthly_royalty_invoice(r.company_id, r.month_year);
  END LOOP;
END $$;

-- ========================================
-- Migration: 20260614140000_add_pricing_columns_companies.sql
-- ========================================
-- Safe migration: add royalty pricing & GST columns to companies table
-- Uses IF NOT EXISTS so it is safe to run multiple times

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS royalty_type        TEXT    NOT NULL DEFAULT 'per_lead',
  ADD COLUMN IF NOT EXISTS royalty_percentage  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_rate            NUMERIC NOT NULL DEFAULT 18.0;

-- Add monthly invoice columns to royalty_transactions (safe, idempotent)
ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS monthly_fee     NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount      NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_amount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- Make lead_id nullable (safe: only drops NOT NULL if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'royalty_transactions'
      AND column_name = 'lead_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.royalty_transactions ALTER COLUMN lead_id DROP NOT NULL;
  END IF;
END $$;

-- Add unique constraint on (company_id, month_year) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'royalty_transactions'
      AND constraint_name = 'unique_company_month_invoice'
  ) THEN
    ALTER TABLE public.royalty_transactions
      ADD CONSTRAINT unique_company_month_invoice UNIQUE (company_id, month_year);
  END IF;
END $$;

-- Reload PostgREST schema cache so new columns are immediately visible
NOTIFY pgrst, 'reload schema';

-- ========================================
-- Migration: 20260614150000_fix_royalty_billing_complete.sql
-- ========================================
-- Migration: 20260614150000_fix_royalty_billing_complete.sql
-- Fixes:
--   1. Add missing sms_charges, whatsapp_charges, other_charges, other_charges_description columns
--   2. Add royalty_type column to royalty_transactions (for view)
--   3. Fix GST: apply on full subtotal (monthly_fee + royalty + extra charges)
--   4. Update royalty_monthly_summary view to expose all new columns
--   5. Add trigger: when company pricing config changes → recalculate all invoices
--   6. Re-seed all invoices with corrected GST logic

-- ─── Step 1: Add missing charge columns to royalty_transactions ─────────────
ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS sms_charges               NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_charges          NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges             NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges_description TEXT;

ALTER TABLE public.royalty_transactions
  ADD COLUMN IF NOT EXISTS royalty_type TEXT NOT NULL DEFAULT 'per_lead';

-- ─── Step 2: Fix refresh_monthly_royalty_invoice function ───────────────────
-- Corrects GST: apply on full subtotal (monthly_fee + royalty_amount + extra charges)
-- Preserves sms_charges / whatsapp_charges / other_charges already stored
CREATE OR REPLACE FUNCTION public.refresh_monthly_royalty_invoice(p_company_id UUID, p_month_year TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_fee      NUMERIC;
  v_royalty_per_lead NUMERIC;
  v_royalty_type     TEXT;
  v_royalty_percentage NUMERIC;
  v_gst_rate         NUMERIC;

  v_lead_count       INTEGER;
  v_revenue_amount   NUMERIC;
  v_royalty_amount   NUMERIC;

  -- Preserve existing extra charges (don't overwrite manual entries)
  v_sms_charges      NUMERIC := 0;
  v_whatsapp_charges NUMERIC := 0;
  v_other_charges    NUMERIC := 0;
  v_other_desc       TEXT    := NULL;

  v_subtotal         NUMERIC;
  v_gst_amount       NUMERIC;
  v_total_amount     NUMERIC;
  v_invoice_number   TEXT;
  v_due_date         DATE;
  v_status           TEXT := 'pending';
BEGIN
  -- A. Fetch company pricing terms
  SELECT
    COALESCE(monthly_fee, 0),
    COALESCE(royalty_per_lead, 0),
    COALESCE(royalty_type, 'per_lead'),
    COALESCE(royalty_percentage, 0),
    COALESCE(gst_rate, 18.0)
  INTO
    v_monthly_fee, v_royalty_per_lead, v_royalty_type, v_royalty_percentage, v_gst_rate
  FROM public.companies
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- B. Count paid leads in that month
  SELECT COUNT(*)::INTEGER INTO v_lead_count
  FROM public.leads
  WHERE company_id = p_company_id
    AND status = 'paid'
    AND TO_CHAR(updated_at, 'YYYY-MM') = p_month_year;

  -- C. Sum completed payments in that month (use total_amount if available, else amount)
  SELECT COALESCE(SUM(COALESCE(total_amount, amount)), 0)::NUMERIC INTO v_revenue_amount
  FROM public.payments
  WHERE company_id = p_company_id
    AND status IN ('captured', 'completed', 'paid')
    AND TO_CHAR(created_at, 'YYYY-MM') = p_month_year;

  -- D. Calculate royalty based on pricing model
  IF v_royalty_type = 'percentage' THEN
    v_royalty_amount := v_revenue_amount * (v_royalty_percentage / 100.0);
  ELSE
    v_royalty_amount := v_lead_count * v_royalty_per_lead;
  END IF;

  -- E. Preserve existing status, invoice_number, and extra charges (don't reset manual edits)
  SELECT
    COALESCE(status, 'pending'),
    invoice_number,
    COALESCE(sms_charges, 0),
    COALESCE(whatsapp_charges, 0),
    COALESCE(other_charges, 0),
    other_charges_description
  INTO
    v_status, v_invoice_number, v_sms_charges, v_whatsapp_charges, v_other_charges, v_other_desc
  FROM public.royalty_transactions
  WHERE company_id = p_company_id AND month_year = p_month_year;

  IF v_invoice_number IS NULL THEN
    v_invoice_number := public.generate_royalty_invoice_number(p_company_id, p_month_year);
  END IF;

  -- F. Calculate GST on FULL subtotal (correct: monthly fee + royalty + all charges)
  v_subtotal    := v_monthly_fee + v_royalty_amount + v_sms_charges + v_whatsapp_charges + v_other_charges;
  v_gst_amount  := ROUND(v_subtotal * (v_gst_rate / 100.0), 2);
  v_total_amount := v_subtotal + v_gst_amount;

  -- G. Due date: 7th of next month
  v_due_date := (DATE_TRUNC('month', TO_DATE(p_month_year || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' + INTERVAL '6 days')::DATE;

  -- H. Upsert invoice row — always recalculate royalty/gst/total; preserve extra charges and status
  INSERT INTO public.royalty_transactions (
    company_id,
    month_year,
    royalty_amount,
    monthly_fee,
    gst_amount,
    total_amount,
    lead_count,
    revenue_amount,
    invoice_number,
    due_date,
    status,
    royalty_type,
    sms_charges,
    whatsapp_charges,
    other_charges,
    other_charges_description
  )
  VALUES (
    p_company_id,
    p_month_year,
    v_royalty_amount,
    v_monthly_fee,
    v_gst_amount,
    v_total_amount,
    v_lead_count,
    v_revenue_amount,
    v_invoice_number,
    v_due_date,
    v_status,
    v_royalty_type,
    v_sms_charges,
    v_whatsapp_charges,
    v_other_charges,
    v_other_desc
  )
  ON CONFLICT (company_id, month_year) DO UPDATE SET
    royalty_amount             = EXCLUDED.royalty_amount,
    monthly_fee                = EXCLUDED.monthly_fee,
    gst_amount                 = EXCLUDED.gst_amount,
    total_amount               = EXCLUDED.total_amount,
    lead_count                 = EXCLUDED.lead_count,
    revenue_amount             = EXCLUDED.revenue_amount,
    due_date                   = EXCLUDED.due_date,
    royalty_type               = EXCLUDED.royalty_type,
    -- sms/whatsapp/other charges are NOT overwritten here so manual edits are preserved
    updated_at                 = now();
END;
$$;

-- ─── Step 3: Add trigger for company pricing config changes ──────────────────
-- When admin changes royalty_per_lead, royalty_percentage, royalty_type, gst_rate, monthly_fee
-- → recalculate ALL existing monthly invoices for that company
CREATE OR REPLACE FUNCTION public.trigger_refresh_all_company_invoices_on_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Only recompute if pricing-related fields changed
  IF (
    OLD.royalty_per_lead      IS DISTINCT FROM NEW.royalty_per_lead      OR
    OLD.royalty_type          IS DISTINCT FROM NEW.royalty_type          OR
    OLD.royalty_percentage    IS DISTINCT FROM NEW.royalty_percentage    OR
    OLD.gst_rate              IS DISTINCT FROM NEW.gst_rate              OR
    OLD.monthly_fee           IS DISTINCT FROM NEW.monthly_fee
  ) THEN
    -- Refresh every existing invoice for this company
    FOR r IN (
      SELECT DISTINCT month_year
      FROM public.royalty_transactions
      WHERE company_id = NEW.id
    ) LOOP
      PERFORM public.refresh_monthly_royalty_invoice(NEW.id, r.month_year);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_company_config_refresh_invoices ON public.companies;

CREATE TRIGGER trigger_company_config_refresh_invoices
  AFTER UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_all_company_invoices_on_config_change();

-- ─── Step 4: Update royalty_monthly_summary view ─────────────────────────────
-- Expose all new columns including sms/whatsapp/other charges and royalty_type
DROP VIEW IF EXISTS public.royalty_monthly_summary CASCADE;
CREATE OR REPLACE VIEW public.royalty_monthly_summary AS
SELECT
  rt.id,
  rt.company_id,
  c.name                                                                  AS company_name,
  rt.month_year,
  rt.lead_count                                                           AS transaction_count,
  rt.revenue_amount,
  rt.royalty_amount                                                       AS total_royalty,
  rt.monthly_fee,
  rt.sms_charges,
  rt.whatsapp_charges,
  rt.other_charges,
  rt.other_charges_description,
  rt.royalty_type,
  rt.gst_amount,
  rt.total_amount,
  CASE WHEN rt.status = 'collected' THEN rt.total_amount ELSE 0 END       AS collected,
  CASE WHEN rt.status = 'pending'   THEN rt.total_amount ELSE 0 END       AS pending,
  rt.due_date                                                             AS earliest_due_date,
  rt.updated_at                                                           AS last_transaction_at,
  rt.invoice_number,
  rt.status
FROM public.royalty_transactions rt
JOIN public.companies c ON c.id = rt.company_id;

-- ─── Step 5: Re-seed all invoices with corrected GST logic ───────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT company_id, month_year
    FROM public.royalty_transactions
    WHERE company_id IS NOT NULL AND month_year IS NOT NULL
  ) LOOP
    PERFORM public.refresh_monthly_royalty_invoice(r.company_id, r.month_year);
  END LOOP;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ========================================
-- Migration: 20260614160000_add_company_gst_number_and_rpc_stats_by_month.sql
-- ========================================
-- Migration: 20260614160000_add_company_gst_number_and_rpc_stats_by_month.sql
-- 1. Add gst_number column to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

-- 2. Create get_agency_company_stats_by_month RPC function
CREATE OR REPLACE FUNCTION public.get_agency_company_stats_by_month(p_month_year text)
 RETURNS TABLE(
   company_id uuid, 
   total_leads bigint, 
   paid_leads bigint, 
   total_revenue numeric, 
   pending_royalty numeric, 
   collected_royalty numeric
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    c.id AS company_id,
    COALESCE(l.total_leads, 0) AS total_leads,
    COALESCE(l.paid_leads, 0) AS paid_leads,
    COALESCE(p.total_revenue, 0) AS total_revenue,
    COALESCE(r.pending_royalty, 0) AS pending_royalty,
    COALESCE(r.collected_royalty, 0) AS collected_royalty
  FROM companies c
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::BIGINT AS total_leads,
      COUNT(*) FILTER (WHERE status IN ('paid','verification','documents_pending','documents_uploaded','verified','processing','approved','disbursed'))::BIGINT AS paid_leads
    FROM leads 
    WHERE leads.company_id = c.id 
      AND (p_month_year = 'all' OR TO_CHAR(leads.created_at, 'YYYY-MM') = p_month_year)
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC AS total_revenue
    FROM payments 
    WHERE payments.company_id = c.id 
      AND payments.status IN ('captured', 'completed', 'paid')
      AND (p_month_year = 'all' OR TO_CHAR(payments.created_at, 'YYYY-MM') = p_month_year)
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT 
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC AS pending_royalty,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'collected'), 0)::NUMERIC AS collected_royalty
    FROM royalty_monthly_summary 
    WHERE royalty_monthly_summary.company_id = c.id
      AND (p_month_year = 'all' OR royalty_monthly_summary.month_year = p_month_year)
  ) r ON true
  WHERE c.is_active = true
  ORDER BY l.total_leads DESC;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ========================================
-- Migration: 20260620120000_fix_sms_stats_coalesce_company.sql
-- ========================================
-- Update get_sms_stats to correctly coalesce direct company_id column from sms_logs
CREATE OR REPLACE FUNCTION public.get_sms_stats(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE(
  total_count bigint,
  sent_count bigint,
  delivered_count bigint,
  failed_count bigint,
  pending_count bigint,
  submitted_count bigint,
  rejected_count bigint,
  total_cost numeric,
  total_segments bigint,
  delivered_segments bigint,
  by_type jsonb,
  by_error jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE s.status = 'sent')::BIGINT as sent_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE s.status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE s.status = 'submitted')::BIGINT as submitted_count,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::BIGINT as rejected_count,
    COALESCE(
      SUM(CASE WHEN s.status = 'delivered' THEN 
        (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END) * 0.11
      ELSE 0 END), 0
    )::NUMERIC as total_cost,
    COALESCE(SUM(CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END), 0)::BIGINT as total_segments,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COALESCE(
      (SELECT jsonb_object_agg(l.sms_type, cnt) 
       FROM (SELECT sl.sms_type, COUNT(*)::BIGINT as cnt 
             FROM sms_logs sl
             LEFT JOIN leads ld ON sl.lead_id = ld.id
             LEFT JOIN leads ld2 ON sl.lead_id IS NULL AND ld2.phone = RIGHT(sl.phone, 10)
             WHERE sl.created_at >= start_date
               AND (end_date IS NULL OR sl.created_at <= end_date)
               AND (p_company_id IS NULL OR COALESCE(sl.company_id, ld.company_id, ld2.company_id) = p_company_id)
             GROUP BY sl.sms_type) l),
      '{}'::jsonb
    ) as by_type,
    COALESCE(
      (SELECT jsonb_object_agg(err_code, err_cnt)
       FROM (SELECT 
               CASE 
                 WHEN el.error_message LIKE 'Failed (Error: %)' 
                   THEN SUBSTRING(el.error_message FROM 'Failed \(Error: ([^)]+)\)')
                 WHEN el.error_message IS NOT NULL THEN el.error_message
                 ELSE 'unknown'
               END as err_code,
               COUNT(*)::BIGINT as err_cnt
             FROM sms_logs el
             LEFT JOIN leads eld ON el.lead_id = eld.id
             LEFT JOIN leads eld2 ON el.lead_id IS NULL AND eld2.phone = RIGHT(el.phone, 10)
             WHERE el.status = 'failed'
               AND el.created_at >= start_date
               AND (end_date IS NULL OR el.created_at <= end_date)
               AND (p_company_id IS NULL OR COALESCE(el.company_id, eld.company_id, eld2.company_id) = p_company_id)
             GROUP BY 1) errs),
      '{}'::jsonb
    ) as by_error
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  LEFT JOIN leads s_lead ON s.lead_id IS NULL AND s_lead.phone = RIGHT(s.phone, 10)
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
    AND (p_company_id IS NULL OR COALESCE(s.company_id, l.company_id, s_lead.company_id) = p_company_id);
END;
$function$;


-- Update get_sms_stats_by_company to also include direct company_id column from sms_logs
CREATE OR REPLACE FUNCTION public.get_sms_stats_by_company(
  start_date timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone, 
  end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  company_id uuid, 
  total_sent_count bigint, 
  delivered_count bigint, 
  failed_count bigint, 
  pending_count bigint, 
  delivered_segments bigint, 
  otp_count bigint, 
  remarketing_count bigint, 
  other_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(s.company_id, l.company_id, s_lead.company_id) as company_id,
    COUNT(*)::BIGINT as total_sent_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered')::BIGINT as delivered_count,
    COUNT(*) FILTER (WHERE s.status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE s.status IN ('pending', 'submitted', 'sent'))::BIGINT as pending_count,
    COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN 
      (CASE WHEN LENGTH(s.message) > 160 THEN 2 ELSE 1 END)
    ELSE 0 END), 0)::BIGINT as delivered_segments,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type = 'otp')::BIGINT as otp_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type IN ('remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as remarketing_count,
    COUNT(*) FILTER (WHERE s.status = 'delivered' AND s.sms_type NOT IN ('otp', 'remarketing', 'remarketing_credit', 'remarketing_finance', 'remarketing_capital', 'remarketing_day1', 'remarketing_day3', 'remarketing_day5', 'remarketing_day7'))::BIGINT as other_count
  FROM sms_logs s
  LEFT JOIN leads l ON s.lead_id = l.id
  LEFT JOIN leads s_lead ON s.lead_id IS NULL AND s_lead.phone = RIGHT(s.phone, 10)
  WHERE s.created_at >= start_date
    AND (end_date IS NULL OR s.created_at <= end_date)
  GROUP BY COALESCE(s.company_id, l.company_id, s_lead.company_id);
END;
$function$;

-- ========================================
-- Migration: 20260621012800_add_zaakpay_columns.sql
-- ========================================
-- Add Zaakpay tracking columns to the payments table
ALTER TABLE "public"."payments"
ADD COLUMN IF NOT EXISTS "zaakpay_order_id" text,
ADD COLUMN IF NOT EXISTS "zaakpay_payment_id" text,
ADD COLUMN IF NOT EXISTS "zaakpay_signature" text;

-- Add an index to speed up webhook lookups by zaakpay_order_id
CREATE INDEX IF NOT EXISTS "idx_payments_zaakpay_order_id" ON "public"."payments" ("zaakpay_order_id");

-- ========================================
-- Migration: 20260621134500_restore_staff_wa_view_policy.sql
-- ========================================
-- Re-add RLS policy so managers/telecallers/staff can view WhatsApp accounts
-- This was dropped in migration 20260509072252 but is needed for the Unified Inbox
-- to show WhatsApp chats for non-admin users.

-- Allow staff (admin, manager, telecaller, verification, login_team) to SELECT whatsapp_accounts
CREATE POLICY "Staff can view WhatsApp accounts"
  ON public.whatsapp_accounts FOR SELECT
  USING (public.is_staff(auth.uid()));

-- ========================================
-- Migration: 20260622100000_manager_is_franchise_owner.sql
-- ========================================
-- Migration: 20260622100000_manager_is_franchise_owner.sql
-- Description: Makes manager roles equivalent to franchise owners for RLS policies

CREATE OR REPLACE FUNCTION public.get_franchise_owner_company(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.franchise_owner_companies WHERE user_id = _user_id
  UNION
  SELECT company_id FROM public.company_users WHERE user_id = _user_id AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'manager')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_franchise_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.franchise_owner_companies WHERE user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'manager'
  );
$$;

-- ========================================
-- Migration: 20260623130000_complete_franchise_isolation.sql
-- ========================================
-- Migration: 20260623130000_complete_franchise_isolation.sql
-- Description: Implement strict brand/franchise isolation by adding company_id columns, backfilling them, and defining strict RLS policies.

-- 1. Helper function to get company_id for any user
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_users WHERE user_id = _user_id LIMIT 1;
$$;

-- 2. Add company_id columns to tables
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_campaigns ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_workflows ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_workflow_actions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_workflow_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_scheduled_messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_scheduled_actions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 3. Backfill company_id columns
UPDATE public.whatsapp_templates t 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE t.account_id = a.id AND t.company_id IS NULL;

UPDATE public.whatsapp_campaigns c 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE c.account_id = a.id AND c.company_id IS NULL;

UPDATE public.whatsapp_workflows w 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE w.account_id = a.id AND w.company_id IS NULL;

UPDATE public.whatsapp_workflow_actions a 
SET company_id = w.company_id 
FROM public.whatsapp_workflows w 
WHERE a.workflow_id = w.id AND a.company_id IS NULL;

UPDATE public.whatsapp_workflow_logs l 
SET company_id = w.company_id 
FROM public.whatsapp_workflows w 
WHERE l.workflow_id = w.id AND l.company_id IS NULL;

UPDATE public.whatsapp_scheduled_messages m 
SET company_id = a.company_id 
FROM public.whatsapp_accounts a 
WHERE m.account_id = a.id AND m.company_id IS NULL;

UPDATE public.workflow_scheduled_actions a 
SET company_id = l.company_id 
FROM public.leads l 
WHERE a.lead_id = l.id AND a.company_id IS NULL;

UPDATE public.workflow_logs l 
SET company_id = w.company_id 
FROM public.workflows w 
WHERE l.workflow_id = w.id AND l.company_id IS NULL;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_otp_codes_company_id ON public.otp_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_company_id ON public.whatsapp_campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_company_id ON public.whatsapp_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_company_id ON public.whatsapp_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_actions_company_id ON public.whatsapp_workflow_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_logs_company_id ON public.whatsapp_workflow_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_company_id ON public.whatsapp_scheduled_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_scheduled_actions_company_id ON public.workflow_scheduled_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_company_id ON public.workflow_logs(company_id);

-- 5. Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_scheduled_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- 6. Define strict, isolated RLS policies

-- A. whatsapp_accounts
DROP POLICY IF EXISTS "Admin can manage WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Staff can view WhatsApp accounts" ON public.whatsapp_accounts;
DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Admin can manage WhatsApp accounts" ON public.whatsapp_accounts FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view WhatsApp accounts" ON public.whatsapp_accounts FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- B. whatsapp_templates
DROP POLICY IF EXISTS "Admin can manage WhatsApp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Staff can view WhatsApp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "Admin can manage WhatsApp templates" ON public.whatsapp_templates FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view WhatsApp templates" ON public.whatsapp_templates FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- C. whatsapp_campaigns
DROP POLICY IF EXISTS "Admin can manage WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Admin can manage WhatsApp campaigns" ON public.whatsapp_campaigns FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- D. whatsapp_messages
DROP POLICY IF EXISTS "Admin can manage messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Staff can view and send messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Staff can insert messages" ON public.whatsapp_messages;
CREATE POLICY "Admin can manage messages" ON public.whatsapp_messages FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view and send messages" ON public.whatsapp_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = public.get_user_company_id(auth.uid())
  )
);
CREATE POLICY "Staff can insert messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = public.get_user_company_id(auth.uid())
  )
);

-- E. workflows (General Automations)
DROP POLICY IF EXISTS "Admin can manage workflows" ON public.workflows;
DROP POLICY IF EXISTS "Staff can view workflows" ON public.workflows;
DROP POLICY IF EXISTS "Franchise owner can manage workflows" ON public.workflows;
CREATE POLICY "Admin can manage workflows" ON public.workflows FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view workflows" ON public.workflows FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage workflows" ON public.workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- F. whatsapp_workflows
DROP POLICY IF EXISTS "Admin can manage whatsapp workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Staff can view whatsapp workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Admins can manage workflows" ON public.whatsapp_workflows;
DROP POLICY IF EXISTS "Staff can view workflows" ON public.whatsapp_workflows;
CREATE POLICY "Admin can manage whatsapp workflows" ON public.whatsapp_workflows FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp workflows" ON public.whatsapp_workflows FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- G. whatsapp_workflow_actions
DROP POLICY IF EXISTS "Admin can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Admins can manage workflow actions" ON public.whatsapp_workflow_actions;
DROP POLICY IF EXISTS "Staff can view workflow actions" ON public.whatsapp_workflow_actions;
CREATE POLICY "Admin can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- H. whatsapp_workflow_logs & workflow_logs
DROP POLICY IF EXISTS "Admin can manage whatsapp workflow logs" ON public.whatsapp_workflow_logs;
DROP POLICY IF EXISTS "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs;
DROP POLICY IF EXISTS "Admins can manage workflow logs" ON public.whatsapp_workflow_logs;
DROP POLICY IF EXISTS "Staff can view workflow logs" ON public.whatsapp_workflow_logs;
CREATE POLICY "Admin can manage whatsapp workflow logs" ON public.whatsapp_workflow_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage general workflow logs" ON public.workflow_logs;
DROP POLICY IF EXISTS "Staff can view general workflow logs" ON public.workflow_logs;
CREATE POLICY "Admin can manage general workflow logs" ON public.workflow_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view general workflow logs" ON public.workflow_logs FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- I. whatsapp_scheduled_messages
DROP POLICY IF EXISTS "Admin can manage whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can view scheduled messages" ON public.whatsapp_scheduled_messages;
DROP POLICY IF EXISTS "Staff can manage scheduled messages" ON public.whatsapp_scheduled_messages;
CREATE POLICY "Admin can manage whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR DELETE USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- J. workflow_scheduled_actions
DROP POLICY IF EXISTS "Admin can manage workflow scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can view scheduled actions" ON public.workflow_scheduled_actions;
DROP POLICY IF EXISTS "Staff can manage scheduled actions" ON public.workflow_scheduled_actions;
CREATE POLICY "Admin can manage workflow scheduled actions" ON public.workflow_scheduled_actions FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions FOR DELETE USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- K. sms_logs
DROP POLICY IF EXISTS "Admin can manage sms logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Staff can view sms logs" ON public.sms_logs;
CREATE POLICY "Admin can manage sms logs" ON public.sms_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view sms logs" ON public.sms_logs FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);

-- L. otp_codes
DROP POLICY IF EXISTS "Staff can view company OTP logs" ON public.otp_codes;
CREATE POLICY "Staff can view company OTP logs" ON public.otp_codes FOR SELECT USING (
  public.is_admin(auth.uid()) OR company_id = public.get_user_company_id(auth.uid())
);

-- M. remarketing_cycles
DROP POLICY IF EXISTS "Admin can manage remarketing cycles" ON public.remarketing_cycles;
DROP POLICY IF EXISTS "Staff can view remarketing cycles" ON public.remarketing_cycles;
DROP POLICY IF EXISTS "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles;
CREATE POLICY "Admin can manage remarketing cycles" ON public.remarketing_cycles FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view remarketing cycles" ON public.remarketing_cycles FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);

-- N. company_integrations
DROP POLICY IF EXISTS "Admin manages company integrations" ON public.company_integrations;
DROP POLICY IF EXISTS "Staff can view company integrations" ON public.company_integrations;
DROP POLICY IF EXISTS "Franchise owner can manage company integrations" ON public.company_integrations;
CREATE POLICY "Admin manages company integrations" ON public.company_integrations FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff can view company integrations" ON public.company_integrations FOR SELECT USING (
  company_id = public.get_user_company_id(auth.uid())
);
CREATE POLICY "Franchise owner can manage company integrations" ON public.company_integrations FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = public.get_user_company_id(auth.uid())
);


-- ========================================
-- Migration: 20260623140000_workflow_triggers.sql
-- ========================================
-- Migration: 20260623140000_workflow_triggers.sql
-- Description: Define BEFORE INSERT triggers to automatically populate company_id based on parent relations or authenticated user context.

-- 1. Create or replace the auto-setting company_id function
CREATE OR REPLACE FUNCTION public.auto_set_company_id()
RETURNS TRIGGER AS $$
DECLARE
  resolved_company_id UUID := NULL;
BEGIN
  -- If company_id is already set, don't overwrite it
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Try to resolve based on parent table relationships
  IF TG_TABLE_NAME = 'whatsapp_campaigns' OR TG_TABLE_NAME = 'whatsapp_templates' OR TG_TABLE_NAME = 'whatsapp_workflows' OR TG_TABLE_NAME = 'whatsapp_scheduled_messages' OR TG_TABLE_NAME = 'whatsapp_messages' THEN
    IF NEW.account_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.whatsapp_accounts WHERE id = NEW.account_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'whatsapp_workflow_actions' OR TG_TABLE_NAME = 'whatsapp_workflow_logs' THEN
    IF NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.whatsapp_workflows WHERE id = NEW.workflow_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_scheduled_actions' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
    IF resolved_company_id IS NULL AND NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.workflows WHERE id = NEW.workflow_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_logs' THEN
    IF NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.workflows WHERE id = NEW.workflow_id;
    END IF;
    IF resolved_company_id IS NULL AND NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'sms_logs' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'otp_codes' THEN
    IF NEW.user_id IS NOT NULL THEN
      resolved_company_id := public.get_user_company_id(NEW.user_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'remarketing_cycles' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  END IF;

  -- 2. Fallback: resolve from authenticated user
  IF resolved_company_id IS NULL AND auth.uid() IS NOT NULL THEN
    resolved_company_id := public.get_user_company_id(auth.uid());
  END IF;

  -- Apply resolved company_id
  IF resolved_company_id IS NOT NULL THEN
    NEW.company_id := resolved_company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create triggers for each table

-- A. whatsapp_campaigns
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_campaigns;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- B. whatsapp_templates
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_templates;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- C. whatsapp_workflows
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_workflows;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_workflows
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- D. whatsapp_workflow_actions
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_workflow_actions;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_workflow_actions
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- E. whatsapp_workflow_logs
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_workflow_logs;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_workflow_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- F. whatsapp_scheduled_messages
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_scheduled_messages;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- G. whatsapp_messages
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.whatsapp_messages;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- H. workflow_scheduled_actions
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.workflow_scheduled_actions;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.workflow_scheduled_actions
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- I. workflow_logs
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.workflow_logs;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.workflow_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- J. sms_logs
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.sms_logs;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.sms_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- K. otp_codes
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.otp_codes;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.otp_codes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- L. remarketing_cycles
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.remarketing_cycles;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.remarketing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- M. workflows (general)
DROP TRIGGER IF EXISTS trigger_auto_set_company_id ON public.workflows;
CREATE TRIGGER trigger_auto_set_company_id
  BEFORE INSERT ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- ========================================
-- Migration: 20260624120000_optimize_rls_policies.sql
-- ========================================
-- Migration: 20260624120000_optimize_rls_policies.sql
-- Description: Optimize RLS policies to use inline subqueries for user company lookup, preventing statement timeouts.

-- A. whatsapp_accounts
DROP POLICY IF EXISTS "Staff can view WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Staff can view WhatsApp accounts" ON public.whatsapp_accounts FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts;
CREATE POLICY "Franchise owner can manage WhatsApp accounts" ON public.whatsapp_accounts FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- B. whatsapp_templates
DROP POLICY IF EXISTS "Staff can view WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "Staff can view WhatsApp templates" ON public.whatsapp_templates FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "Franchise owner can manage WhatsApp templates" ON public.whatsapp_templates FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- C. whatsapp_campaigns
DROP POLICY IF EXISTS "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Staff can view WhatsApp campaigns" ON public.whatsapp_campaigns FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Franchise owner can manage WhatsApp campaigns" ON public.whatsapp_campaigns FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- D. whatsapp_messages
DROP POLICY IF EXISTS "Staff can view and send messages" ON public.whatsapp_messages;
CREATE POLICY "Staff can view and send messages" ON public.whatsapp_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
  )
);

DROP POLICY IF EXISTS "Staff can insert messages" ON public.whatsapp_messages;
CREATE POLICY "Staff can insert messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_accounts a
    WHERE a.id = account_id AND a.company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
  )
);

-- E. workflows (General Automations)
DROP POLICY IF EXISTS "Staff can view workflows" ON public.workflows;
CREATE POLICY "Staff can view workflows" ON public.workflows FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage workflows" ON public.workflows;
CREATE POLICY "Franchise owner can manage workflows" ON public.workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- F. whatsapp_workflows
DROP POLICY IF EXISTS "Staff can view whatsapp workflows" ON public.whatsapp_workflows;
CREATE POLICY "Staff can view whatsapp workflows" ON public.whatsapp_workflows FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows;
CREATE POLICY "Franchise owner can manage whatsapp workflows" ON public.whatsapp_workflows FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- G. whatsapp_workflow_actions
DROP POLICY IF EXISTS "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions;
CREATE POLICY "Staff can view whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions;
CREATE POLICY "Franchise owner can manage whatsapp workflow actions" ON public.whatsapp_workflow_actions FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- H. whatsapp_workflow_logs & workflow_logs
DROP POLICY IF EXISTS "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs;
CREATE POLICY "Staff can view whatsapp workflow logs" ON public.whatsapp_workflow_logs FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Staff can view general workflow logs" ON public.workflow_logs;
CREATE POLICY "Staff can view general workflow logs" ON public.workflow_logs FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- I. whatsapp_scheduled_messages
DROP POLICY IF EXISTS "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
CREATE POLICY "Staff can view whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages;
CREATE POLICY "Staff can delete whatsapp scheduled messages" ON public.whatsapp_scheduled_messages FOR DELETE USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- J. workflow_scheduled_actions
DROP POLICY IF EXISTS "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions;
CREATE POLICY "Staff can view workflow scheduled actions" ON public.workflow_scheduled_actions FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions;
CREATE POLICY "Staff can delete workflow scheduled actions" ON public.workflow_scheduled_actions FOR DELETE USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- K. sms_logs
DROP POLICY IF EXISTS "Staff can view sms logs" ON public.sms_logs;
CREATE POLICY "Staff can view sms logs" ON public.sms_logs FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- L. otp_codes
DROP POLICY IF EXISTS "Staff can view company OTP logs" ON public.otp_codes;
CREATE POLICY "Staff can view company OTP logs" ON public.otp_codes FOR SELECT USING (
  public.is_admin(auth.uid()) OR company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- M. remarketing_cycles
DROP POLICY IF EXISTS "Staff can view remarketing cycles" ON public.remarketing_cycles;
CREATE POLICY "Staff can view remarketing cycles" ON public.remarketing_cycles FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles;
CREATE POLICY "Franchise owner can manage remarketing cycles" ON public.remarketing_cycles FOR ALL USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- N. company_integrations
DROP POLICY IF EXISTS "Staff can view company integrations" ON public.company_integrations;
CREATE POLICY "Staff can view company integrations" ON public.company_integrations FOR SELECT USING (
  company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Franchise owner can manage company integrations" ON public.company_integrations;
CREATE POLICY "Franchise owner can manage company integrations" ON public.company_integrations FOR UPDATE USING (
  public.is_franchise_owner(auth.uid()) AND company_id = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1)
);

-- ========================================
-- Migration: 20260627100000_fix_otp_codes_trigger.sql
-- ========================================
-- Migration: 20260627100000_fix_otp_codes_trigger.sql
-- Description: Fix public.auto_set_company_id() trigger function to remove references to non-existent user_id column on public.otp_codes.

CREATE OR REPLACE FUNCTION public.auto_set_company_id()
RETURNS TRIGGER AS $$
DECLARE
  resolved_company_id UUID := NULL;
BEGIN
  -- If company_id is already set, don't overwrite it
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Try to resolve based on parent table relationships
  IF TG_TABLE_NAME = 'whatsapp_campaigns' OR TG_TABLE_NAME = 'whatsapp_templates' OR TG_TABLE_NAME = 'whatsapp_workflows' OR TG_TABLE_NAME = 'whatsapp_scheduled_messages' OR TG_TABLE_NAME = 'whatsapp_messages' THEN
    IF NEW.account_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.whatsapp_accounts WHERE id = NEW.account_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'whatsapp_workflow_actions' OR TG_TABLE_NAME = 'whatsapp_workflow_logs' THEN
    IF NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.whatsapp_workflows WHERE id = NEW.workflow_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_scheduled_actions' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
    IF resolved_company_id IS NULL AND NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.workflows WHERE id = NEW.workflow_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'workflow_logs' THEN
    IF NEW.workflow_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.workflows WHERE id = NEW.workflow_id;
    END IF;
    IF resolved_company_id IS NULL AND NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'sms_logs' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'remarketing_cycles' THEN
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO resolved_company_id FROM public.leads WHERE id = NEW.lead_id;
    END IF;
  END IF;

  -- 2. Fallback: resolve from authenticated user
  IF resolved_company_id IS NULL AND auth.uid() IS NOT NULL THEN
    resolved_company_id := public.get_user_company_id(auth.uid());
  END IF;

  -- Apply resolved company_id
  IF resolved_company_id IS NOT NULL THEN
    NEW.company_id := resolved_company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- SEED: Initial Hariox company record
-- ========================================
INSERT INTO companies (name, slug, primary_color, is_active, website_url)
VALUES ('Hariox', 'hariox', '#38BDF8', true, 'https://hariox.com')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  primary_color = EXCLUDED.primary_color,
  is_active = EXCLUDED.is_active;
