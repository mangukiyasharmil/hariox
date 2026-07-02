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