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