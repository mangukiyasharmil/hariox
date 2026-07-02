
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
