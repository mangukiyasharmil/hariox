export type LoanType = 'home' | 'business' | 'personal' | 'education' | 'vehicle' | 'gold' | 'marriage';
export type EmploymentType = 'salaried' | 'self_employed' | 'business_owner';
export type LeadStatus = 'unpaid' | 'paid' | 'verification' | 'documents_pending' | 'documents_uploaded' | 'verified' | 'rejected' | 'processing' | 'approved' | 'disbursed' | 'lost';
export type PaymentSource = 'direct' | 'telecaller' | 'manual' | 'marketing';
export type DocumentStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';
export type AppRole = 'admin' | 'telecaller' | 'verification' | 'login_team' | 'manager' | 'ads' | 'finance' | 'gst' | 'franchise_owner';

export interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state: string | null;
  loan_type: LoanType;
  loan_amount: number;
  employment_type: EmploymentType;
  monthly_income: number;
  emi_amount: number | null;
  current_monthly_emi: number | null;
  cibil_score_range: string | null;
  interest_rate: number;
  tenure_months: number;
  status: LeadStatus;
  assigned_to: string | null;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  updated_at: string;
  company_id?: string | null;
}

export interface Payment {
  id: string;
  lead_id: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  payment_source: PaymentSource;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status: string;
  collected_by: string | null;
  payment_date: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface Document {
  id: string;
  lead_id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  status: DocumentStatus;
  remarks: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallLog {
  id: string;
  lead_id: string;
  caller_id: string;
  call_duration: number | null;
  notes: string | null;
  outcome: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface BankSubmission {
  id: string;
  lead_id: string;
  bank_name: string;
  submitted_by: string;
  submission_date: string;
  status: string;
  remarks: string | null;
  approval_amount: number | null;
  disbursement_date: string | null;
  created_at: string;
  updated_at: string;
}

// EMI Calculator types
export interface EMICalculation {
  principal: number;
  interestRate: number;
  tenureMonths: number;
  emi: number;
  totalInterest: number;
  totalPayment: number;
}
