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