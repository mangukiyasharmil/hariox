-- Add SEO fields to blog_posts
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords TEXT;

-- Create lead_scores table for lead scoring system
CREATE TABLE IF NOT EXISTS public.lead_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  profile_score INTEGER DEFAULT 0,
  activity_score INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Create staff_notifications table for notification center
CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_id ON public.staff_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_is_read ON public.staff_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON public.lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON public.lead_scores(score DESC);

-- Enable RLS on new tables
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_scores (staff can view/update)
CREATE POLICY "Staff can view lead scores" 
ON public.lead_scores 
FOR SELECT 
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert lead scores" 
ON public.lead_scores 
FOR INSERT 
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update lead scores" 
ON public.lead_scores 
FOR UPDATE 
USING (public.is_staff(auth.uid()));

-- RLS policies for staff_notifications (users can only see their own)
CREATE POLICY "Users can view their own notifications" 
ON public.staff_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Staff can create notifications" 
ON public.staff_notifications 
FOR INSERT 
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Users can update their own notifications" 
ON public.staff_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add lead transfer tracking columns to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS transferred_from UUID,
ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS transfer_reason TEXT;

-- Create function to calculate lead score
CREATE OR REPLACE FUNCTION public.calculate_lead_score(p_lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_profile_score INTEGER := 0;
  v_engagement_score INTEGER := 0;
  v_activity_score INTEGER := 0;
  v_total_score INTEGER := 0;
  v_lead RECORD;
  v_call_count INTEGER;
  v_doc_count INTEGER;
BEGIN
  -- Get lead data
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Profile score (max 40 points)
  -- Higher income = higher score
  IF v_lead.monthly_income >= 100000 THEN v_profile_score := v_profile_score + 15;
  ELSIF v_lead.monthly_income >= 50000 THEN v_profile_score := v_profile_score + 10;
  ELSIF v_lead.monthly_income >= 25000 THEN v_profile_score := v_profile_score + 5;
  END IF;
  
  -- Loan amount (higher amounts = higher priority)
  IF v_lead.loan_amount >= 1000000 THEN v_profile_score := v_profile_score + 15;
  ELSIF v_lead.loan_amount >= 500000 THEN v_profile_score := v_profile_score + 10;
  ELSIF v_lead.loan_amount >= 100000 THEN v_profile_score := v_profile_score + 5;
  END IF;
  
  -- CIBIL score (if available)
  IF v_lead.cibil_score_range = '750+' THEN v_profile_score := v_profile_score + 10;
  ELSIF v_lead.cibil_score_range = '650-750' THEN v_profile_score := v_profile_score + 7;
  ELSIF v_lead.cibil_score_range = '550-650' THEN v_profile_score := v_profile_score + 3;
  END IF;
  
  -- Engagement score (max 30 points)
  -- Paid leads get bonus
  IF v_lead.status IN ('paid', 'verification', 'documents_pending', 'documents_uploaded', 'verified', 'processing', 'approved', 'disbursed') THEN
    v_engagement_score := v_engagement_score + 15;
  END IF;
  
  -- Interested leads
  IF v_lead.is_interested = true THEN
    v_engagement_score := v_engagement_score + 10;
  END IF;
  
  -- Recent leads (created in last 7 days)
  IF v_lead.created_at > now() - interval '7 days' THEN
    v_engagement_score := v_engagement_score + 5;
  END IF;
  
  -- Activity score (max 30 points)
  -- Count calls
  SELECT COUNT(*) INTO v_call_count FROM public.call_logs WHERE lead_id = p_lead_id;
  IF v_call_count >= 5 THEN v_activity_score := v_activity_score + 10;
  ELSIF v_call_count >= 2 THEN v_activity_score := v_activity_score + 5;
  END IF;
  
  -- Count documents
  SELECT COUNT(*) INTO v_doc_count FROM public.documents WHERE lead_id = p_lead_id;
  IF v_doc_count >= 3 THEN v_activity_score := v_activity_score + 20;
  ELSIF v_doc_count >= 1 THEN v_activity_score := v_activity_score + 10;
  END IF;
  
  v_total_score := v_profile_score + v_engagement_score + v_activity_score;
  
  -- Upsert score
  INSERT INTO public.lead_scores (lead_id, score, profile_score, engagement_score, activity_score, last_calculated_at)
  VALUES (p_lead_id, v_total_score, v_profile_score, v_engagement_score, v_activity_score, now())
  ON CONFLICT (lead_id) 
  DO UPDATE SET 
    score = EXCLUDED.score,
    profile_score = EXCLUDED.profile_score,
    engagement_score = EXCLUDED.engagement_score,
    activity_score = EXCLUDED.activity_score,
    last_calculated_at = now(),
    updated_at = now();
  
  RETURN v_total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;