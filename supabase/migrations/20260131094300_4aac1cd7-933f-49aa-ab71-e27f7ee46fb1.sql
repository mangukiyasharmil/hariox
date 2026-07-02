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