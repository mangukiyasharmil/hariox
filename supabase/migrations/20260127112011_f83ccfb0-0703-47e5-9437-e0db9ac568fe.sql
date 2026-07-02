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