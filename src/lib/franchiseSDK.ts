/**
 * Hariox Franchise SDK
 * 
 * Use this to integrate any external website (Next.js, React, plain HTML)
 * with the Hariox backend as a franchise partner.
 * 
 * Usage:
 *   import { HarioxSDK } from '@/lib/franchiseSDK';
 *   const fc = new HarioxSDK({ companySlug: 'my-franchise', supabaseUrl: '...', supabaseAnonKey: '...' });
 *   const result = await fc.submitLead({ ... });
 * 
 * Or via CDN (for plain HTML sites):
 *   <script src="https://cdn.hariox.com/sdk.js"></script>
 *   <script>const fc = new HarioxSDK({ companySlug: 'my-franchise' });</script>
 */

export interface HarioxSDKConfig {
  companySlug: string;       // Your franchise slug registered in Hariox
  supabaseUrl?: string;      // Override Supabase URL (optional — uses default Hariox backend)
  supabaseAnonKey?: string;  // Override anon key (optional)
  debug?: boolean;           // Log debug info to console
}

export interface LeadSubmissionData {
  full_name: string;
  phone: string;
  email?: string;
  city: string;
  state?: string;
  loan_type: 'personal' | 'business' | 'home' | 'education' | 'vehicle' | 'gold' | 'marriage';
  loan_amount: number;
  employment_type: 'salaried' | 'self_employed' | 'business_owner';
  monthly_income: number;
  // Optional tracking
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  source?: string;
}

export interface OTPVerifyData {
  phone: string;
  otp: string;
  lead_id: string;
}

export interface HarioxCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
  custom_domain: string | null;
}

export interface LeadSubmissionResult {
  success: boolean;
  lead_id?: string;
  payment_url?: string;
  error?: string;
}

export interface OTPResult {
  success: boolean;
  error?: string;
}

const DEFAULT_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://uzfccftfizleiyqzqoki.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export class HarioxSDK {
  private config: HarioxSDKConfig;
  private supabaseUrl: string;
  private supabaseAnonKey: string;
  private companyId: string | null = null;
  private companyData: HarioxCompany | null = null;

  constructor(config: HarioxSDKConfig) {
    this.config = config;
    this.supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
    this.supabaseAnonKey = config.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
  }

  private log(...args: any[]) {
    if (this.config.debug) {
      console.log('[HarioxSDK]', ...args);
    }
  }

  private async fetchSupabase(
    path: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.supabaseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.supabaseAnonKey,
        'Authorization': `Bearer ${this.supabaseAnonKey}`,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${error}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private async invokeFunction(name: string, body: Record<string, any>): Promise<any> {
    return this.fetchSupabase(`/functions/v1/${name}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Resolve company data by slug.
   * Called automatically on first lead submission.
   */
  async resolveCompany(): Promise<HarioxCompany | null> {
    if (this.companyData) return this.companyData;

    try {
      const data = await this.fetchSupabase(
        `/rest/v1/companies?slug=eq.${this.config.companySlug}&is_active=eq.true&select=*&limit=1`
      );

      if (data && data.length > 0) {
        this.companyData = data[0] as HarioxCompany;
        this.companyId = data[0].id;
        this.log('Company resolved:', this.companyData.name);
        return this.companyData;
      }
    } catch (e) {
      this.log('Error resolving company:', e);
    }

    return null;
  }

  /**
   * Get company branding data (colors, logo, name).
   * Use this to apply your franchise's branding on your website.
   */
  async getBranding(): Promise<{ primaryColor: string; secondaryColor: string; logo: string | null; name: string } | null> {
    const company = await this.resolveCompany();
    if (!company) return null;

    return {
      primaryColor: company.primary_color,
      secondaryColor: company.secondary_color,
      logo: company.logo_url,
      name: company.name,
    };
  }

  /**
   * Submit a new lead to the Hariox CRM.
   * Automatically tagged to your franchise company.
   * Returns a lead_id for OTP verification and payment_url for checkout.
   */
  async submitLead(data: LeadSubmissionData): Promise<LeadSubmissionResult> {
    try {
      // Resolve company first
      const company = await this.resolveCompany();
      if (!company) {
        return { success: false, error: `Company '${this.config.companySlug}' not found` };
      }

      this.log('Submitting lead for company:', company.name);

      const result = await this.invokeFunction('collect-lead', {
        ...data,
        company_id: this.companyId,
        source: data.source || 'external_website',
        utm_source: data.utm_source || new URLSearchParams(window.location.search).get('utm_source') || undefined,
        utm_medium: data.utm_medium || new URLSearchParams(window.location.search).get('utm_medium') || undefined,
        utm_campaign: data.utm_campaign || new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
      });

      return {
        success: true,
        lead_id: result?.lead_id,
        payment_url: result?.payment_url,
      };
    } catch (err: any) {
      this.log('Error submitting lead:', err);
      return { success: false, error: err.message || 'Failed to submit lead' };
    }
  }

  /**
   * Send OTP to phone number for verification.
   */
  async sendOTP(phone: string, leadId?: string): Promise<OTPResult> {
    try {
      await this.invokeFunction('send-otp', { phone, lead_id: leadId });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Verify OTP entered by the user.
   */
  async verifyOTP(data: OTPVerifyData): Promise<OTPResult> {
    try {
      const result = await this.invokeFunction('verify-otp', data);
      return { success: result?.success === true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Track a page view for analytics.
   */
  trackPageView(pageName: string) {
    if ((this.companyData as any)?.meta_pixel_id) {
      // Meta Pixel tracking
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'PageView');
      }
    }
    this.log('Page view tracked:', pageName);
  }

  /**
   * Track a custom event (e.g., form start, button click).
   */
  trackEvent(eventName: string, data?: Record<string, any>) {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', eventName, data);
    }
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, data);
    }
    this.log('Event tracked:', eventName, data);
  }

  /**
   * Get the WhatsApp contact URL for the franchise.
   */
  getWhatsAppURL(message?: string): string {
    const number = this.companyData?.whatsapp_number || '';
    const encodedMsg = encodeURIComponent(message || 'Hello, I need help with a loan.');
    return `https://wa.me/${number}?text=${encodedMsg}`;
  }

  /**
   * Get the franchise's payment page URL for a lead.
   * Use this to redirect users after lead submission.
   */
  getPaymentURL(leadId: string): string {
    const domain = this.companyData?.custom_domain 
      ? `https://${this.companyData.custom_domain}`
      : `https://app.hariox.com`;
    return `${domain}/payment?lead=${leadId}&company=${this.config.companySlug}`;
  }
}

/**
 * Integration Method B: iFrame Embed Helper
 * 
 * For websites that want to embed the Hariox application form as an iframe,
 * use this utility to generate the embed code.
 */
export const generateIframeEmbedCode = (companySlug: string, height = 700): string => {
  const src = `https://app.hariox.com/apply?company=${companySlug}`;
  return `<iframe 
  src="${src}" 
  width="100%" 
  height="${height}px"
  style="border: none; border-radius: 12px;"
  allow="payment"
  title="Apply for Loan - ${companySlug}"
></iframe>`;
};

/**
 * Integration Method C: React hook for franchise branding
 * Use in your React/Next.js application to apply franchise branding.
 */
export const useFranchiseBranding = (companySlug: string) => {
  // Dynamic import to avoid SSR issues
  const [branding, setBranding] = (typeof window !== 'undefined'
    ? require('react').useState
    : () => [null, () => {}])(null as { primaryColor: string; secondaryColor: string; logo: string | null; name: string } | null);
  
  const [loading, setLoading] = (typeof window !== 'undefined'
    ? require('react').useState
    : () => [true, () => {}])(true);

  (typeof window !== 'undefined' ? require('react').useEffect : () => {})(() => {
    const sdk = new HarioxSDK({ companySlug });
    sdk.getBranding().then((b) => {
      setBranding(b);
      setLoading(false);
    });
  }, [companySlug]);

  return { branding, loading };
};

export default HarioxSDK;
