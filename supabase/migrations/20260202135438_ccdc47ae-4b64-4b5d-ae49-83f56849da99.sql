
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
