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