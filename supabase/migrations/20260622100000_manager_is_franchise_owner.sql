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
