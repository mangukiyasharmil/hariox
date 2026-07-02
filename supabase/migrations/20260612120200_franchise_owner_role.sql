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
