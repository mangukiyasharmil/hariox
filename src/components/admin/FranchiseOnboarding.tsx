import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Building2, Globe, MessageCircle, MessageSquare, BarChart3, Megaphone,
  Check, ChevronRight, ChevronLeft, User, Loader2, Copy, ExternalLink,
  IndianRupee, Shield, Zap, RefreshCw, AlertCircle
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Company Info', icon: Building2, desc: 'Basic franchise details' },
  { id: 2, title: 'Domain Setup', icon: Globe, desc: 'Custom domain configuration' },
  { id: 3, title: 'Contact Details', icon: User, desc: 'Phone, email, address' },
  { id: 4, title: 'SMS Setup', icon: MessageSquare, desc: 'GreenSMS DLT configuration' },
  { id: 5, title: 'WhatsApp WABA', icon: MessageCircle, desc: 'Meta Business API setup' },
  { id: 6, title: 'Analytics', icon: BarChart3, desc: 'GA & Meta Pixel' },
  { id: 7, title: 'Franchise Terms', icon: IndianRupee, desc: 'Fees & royalty' },
  { id: 8, title: 'Owner Login', icon: Shield, desc: 'Create franchise owner account' },
];

const FranchiseOnboarding = () => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const [isDomainVerifying, setIsDomainVerifying] = useState(false);
  const [domainVerified, setDomainVerified] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Domain verification state (no Cloudflare dependency)
  const [cfStatus, setCfStatus] = useState<string | null>(null);
  const [cfValidationRecords, setCfValidationRecords] = useState<Array<{txt_name: string, txt_value: string}>>([]);
  const [isCheckingCf, setIsCheckingCf] = useState(false);

  // Form state
  const [companyInfo, setCompanyInfo] = useState({
    name: '', slug: '', logo_url: '',
    primary_color: '#1e3a5f', secondary_color: '#f59e0b',
  });
  const [domainInfo, setDomainInfo] = useState({ custom_domain: '' });
  const [contactInfo, setContactInfo] = useState({
    phone: '', email: '', address: '', website_url: '',
  });
  const [smsConfig, setSmsConfig] = useState({
    username: '', api_key: '', sender_id: '',
    dlt_entity_id: '',
    dlt_template_ids: {
      payment_success: '', welcome: '', telecaller: '',
      remarketing: '', payment_failed: '', rejected: ''
    }
  });
  const [wabaConfig, setWabaConfig] = useState({
    meta_phone_id: '', meta_access_token: '',
    meta_business_id: '', webhook_verify_token: '', waba_id: ''
  });
  const [analyticsConfig, setAnalyticsConfig] = useState({
    google_analytics_id: '', meta_pixel_id: '', meta_ads_account_id: ''
  });
  const [franchiseTerms, setFranchiseTerms] = useState({
    setup_fee: '0',
    setup_fee_paid: false,
    royalty_per_lead: '0',
    monthly_fee: '0',
    royalty_type: 'per_lead',
    royalty_percentage: '0',
    gst_rate: '18.0',
  });
  const [ownerAccount, setOwnerAccount] = useState({
    create_account: true, full_name: '', email: '', password: '',
  });

  const generateSlug = (name: string) => {
    let cleaned = name.toLowerCase();
    cleaned = cleaned.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.replace(/[^a-z0-9]+/g, '-');
    cleaned = cleaned.replace(/(^-|-$)/g, '');
    cleaned = cleaned.replace(/^(https?)-/, '');
    return cleaned;
  };

  const getMainDomain = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port || '8080';
      return `localhost:${port}`;
    }
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  };

  const getCnameTarget = () => {
    const hostname = window.location.hostname;
    // On localhost return the known Lovable production URL
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'app.hariox.com';
    }
    // Return actual deployed hostname (e.g. xyz.lovable.app or custom domain)
    return hostname;
  };

  const getFranchisePortalUrl = () => {
    if (domainInfo.custom_domain) {
      return `https://${domainInfo.custom_domain}/franchise-admin`;
    }
    // Main domain slug-based: e.g. https://hariox.com/company-slug/franchise-admin
    const cleanHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.hostname}:${window.location.port || '8080'}`
      : 'hariox.com';
    return `https://${cleanHost}/${companyInfo.slug || 'slug'}/franchise-admin`;
  };

  // Removed Cloudflare dependency — domain verification only checks format
  const checkCloudflareStatus = async (_domainToVerify = domainInfo.custom_domain) => {
    // No-op: Cloudflare edge function not available on Lovable hosting
    // DNS propagation is handled by the franchise partner in their DNS provider
  };

  const verifyDomain = async () => {
    if (!domainInfo.custom_domain) {
      toast.error('Please enter a domain first');
      return;
    }
    setIsDomainVerifying(true);
    try {
      // Basic format validation
      const raw = domainInfo.custom_domain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '').trim();
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(raw)) {
        toast.error('Please enter a valid domain (e.g. finance.yourcompany.com)');
        return;
      }
      setDomainVerified(true);
      toast.success('Domain format verified! Follow the DNS instructions below.');
    } finally {
      setIsDomainVerifying(false);
    }
  };

  const createCompany = async (): Promise<string | null> => {
    const { data, error } = await supabase.from('companies').insert({
      name: companyInfo.name,
      slug: companyInfo.slug,
      logo_url: companyInfo.logo_url || null,
      primary_color: companyInfo.primary_color,
      secondary_color: companyInfo.secondary_color,
      phone: contactInfo.phone || null,
      email: contactInfo.email || null,
      address: contactInfo.address || null,
      website_url: contactInfo.website_url || null,
      custom_domain: domainInfo.custom_domain || null,
      meta_pixel_id: analyticsConfig.meta_pixel_id || null,
      google_analytics_id: analyticsConfig.google_analytics_id || null,
      setup_fee: parseFloat(franchiseTerms.setup_fee) || 0,
      setup_fee_paid: franchiseTerms.setup_fee_paid,
      royalty_per_lead: parseFloat(franchiseTerms.royalty_per_lead) || 0,
      monthly_fee: parseFloat(franchiseTerms.monthly_fee) || 0,
      royalty_type: franchiseTerms.royalty_type,
      royalty_percentage: parseFloat(franchiseTerms.royalty_percentage) || 0,
      gst_rate: parseFloat(franchiseTerms.gst_rate) || 0,
      is_active: true,
    }).select('id').single();

    if (error) throw error;
    return data?.id || null;
  };

  const saveIntegrations = async (companyId: string) => {
    const integrations: any[] = [];

    // SMS integration
    if (smsConfig.api_key) {
      integrations.push({
        company_id: companyId,
        service_type: 'sms',
        config: {
          provider: 'greensms',
          username: smsConfig.username,
          api_key: smsConfig.api_key,
          sender_id: smsConfig.sender_id,
          dlt_entity_id: smsConfig.dlt_entity_id,
          dlt_template_ids: smsConfig.dlt_template_ids,
        },
        is_active: true,
      });
    }

    // WhatsApp integration
    if (wabaConfig.meta_phone_id) {
      integrations.push({
        company_id: companyId,
        service_type: 'whatsapp',
        config: {
          type: 'waba',
          meta_phone_id: wabaConfig.meta_phone_id,
          meta_access_token: wabaConfig.meta_access_token,
          meta_business_id: wabaConfig.meta_business_id,
          webhook_verify_token: wabaConfig.webhook_verify_token,
          waba_id: wabaConfig.waba_id,
        },
        is_active: true,
      });
    }

    // GA integration
    if (analyticsConfig.google_analytics_id) {
      integrations.push({
        company_id: companyId,
        service_type: 'google_analytics',
        config: { measurement_id: analyticsConfig.google_analytics_id },
        is_active: true,
      });
    }

    // Meta Ads
    if (analyticsConfig.meta_ads_account_id) {
      integrations.push({
        company_id: companyId,
        service_type: 'meta_ads',
        config: { ad_account_id: analyticsConfig.meta_ads_account_id },
        is_active: true,
      });
    }

    if (integrations.length > 0) {
      const { error } = await supabase.from('company_integrations').upsert(
        integrations,
        { onConflict: 'company_id,service_type' }
      );
      if (error) throw error;
    }
  };

  const createOwnerAccount = async (companyId: string) => {
    if (!ownerAccount.create_account || !ownerAccount.email || !ownerAccount.password) return;

    const fullName = (ownerAccount.full_name || '').trim() || ownerAccount.email.split('@')[0];

    const { data, error } = await supabase.functions.invoke('create-staff', {
      body: {
        email: ownerAccount.email,
        password: ownerAccount.password,
        full_name: fullName,
        fullName: fullName,
        role: 'franchise_owner',
        company_id: companyId,
      },
    });
    if (error) throw error;

    // Link to franchise_owner_companies
    if (data?.user_id) {
      const { error: linkErr } = await supabase
        .from('franchise_owner_companies')
        .upsert({ user_id: data.user_id, company_id: companyId });
      if (linkErr) throw linkErr;
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const companyId = await createCompany();
      if (!companyId) throw new Error('Failed to create company');
      setCreatedCompanyId(companyId);
      await saveIntegrations(companyId);

      // No Cloudflare call needed — franchise partner manages DNS in their own provider (Hostinger, GoDaddy, etc.)
      if (domainInfo.custom_domain) {
        toast.info(`Remember: Add CNAME record in your DNS provider: ${domainInfo.custom_domain} → ${getCnameTarget()}`);
      }

      await createOwnerAccount(companyId);
      setIsComplete(true);
      toast.success('Franchise setup complete! 🎉');
    } catch (err: any) {
      toast.error(err.message || 'Setup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !companyInfo.name) { toast.error('Company name is required'); return; }
    if (step < 8) setStep(step + 1);
  };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-2 border-green-200 dark:border-green-800">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Franchise Setup Complete! 🎉</h2>
            <p className="text-muted-foreground">
              <strong>{companyInfo.name}</strong> has been successfully onboarded as a franchise partner.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm text-left mt-6">
              <div className="bg-muted rounded-lg p-3">
                <p className="font-medium">Company ID</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{createdCompanyId}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="font-medium">Slug</p>
                <p className="text-xs text-muted-foreground">/{companyInfo.slug}</p>
              </div>
              {domainInfo.custom_domain && (
                <div className="bg-muted rounded-lg p-3 col-span-2">
                  <p className="font-medium">Custom Domain</p>
                  <p className="text-xs text-muted-foreground">{domainInfo.custom_domain}</p>
                  <p className="text-xs text-orange-500 mt-1">⚠️ Remember to set CNAME DNS record</p>
                </div>
              )}
              {ownerAccount.email && (
                <div className="bg-muted rounded-lg p-3 col-span-2">
                  <p className="font-medium">Franchise Owner Login</p>
                  <p className="text-xs text-muted-foreground">{ownerAccount.email}</p>
                  <a
                    href={getFranchisePortalUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Franchise Admin Portal <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsComplete(false);
                  setStep(1);
                  setCreatedCompanyId(null);
                  setCompanyInfo({ name: '', slug: '', logo_url: '', primary_color: '#1e3a5f', secondary_color: '#f59e0b' });
                }}
              >
                Add Another Franchise
              </Button>
              <Button onClick={() => window.location.href = '/admin/dashboard/agency'}>
                View Agency Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Franchise Onboarding</h1>
        <p className="text-muted-foreground">Add a new franchise partner in 8 easy steps</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const isDone = step > s.id;
          const isCurrent = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => isDone && setStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isCurrent ? 'bg-primary text-primary-foreground' :
                  isDone ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 cursor-pointer hover:bg-green-200' :
                  'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{s.id}</span>
              </button>
              {s.id < 8 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const S = STEPS[step - 1]; const Icon = S.icon; return <Icon className="h-5 w-5 text-primary" />; })()}
            Step {step}: {STEPS[step - 1].title}
          </CardTitle>
          <CardDescription>{STEPS[step - 1].desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* STEP 1: Company Info */}
          {step === 1 && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    id="franchise-name"
                    placeholder="My Finance Company"
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo(p => ({ ...p, name: e.target.value, slug: p.slug || generateSlug(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug *</Label>
                  <Input
                    id="franchise-slug"
                    placeholder="my-finance-company"
                    value={companyInfo.slug}
                    onChange={(e) => setCompanyInfo(p => ({ ...p, slug: generateSlug(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Used in URLs — lowercase, hyphens only</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  id="franchise-logo"
                  placeholder="https://cdn.example.com/logo.png"
                  value={companyInfo.logo_url}
                  onChange={(e) => setCompanyInfo(p => ({ ...p, logo_url: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Brand Color</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={companyInfo.primary_color} onChange={(e) => setCompanyInfo(p => ({ ...p, primary_color: e.target.value }))} className="w-12 h-10 p-1" />
                    <Input value={companyInfo.primary_color} onChange={(e) => setCompanyInfo(p => ({ ...p, primary_color: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Brand Color</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={companyInfo.secondary_color} onChange={(e) => setCompanyInfo(p => ({ ...p, secondary_color: e.target.value }))} className="w-12 h-10 p-1" />
                    <Input value={companyInfo.secondary_color} onChange={(e) => setCompanyInfo(p => ({ ...p, secondary_color: e.target.value }))} />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: companyInfo.primary_color }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: companyInfo.secondary_color }}>
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white">{companyInfo.name || 'Company Name'}</p>
                  <p className="text-white/70 text-sm">Brand Preview</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Domain Setup */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Custom Domain <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="franchise-domain"
                    placeholder="finance.clientsite.com"
                    value={domainInfo.custom_domain}
                    onChange={(e) => { setDomainInfo({ custom_domain: e.target.value }); setDomainVerified(false); }}
                  />
                  <Button variant="outline" onClick={verifyDomain} disabled={isDomainVerifying}>
                    {isDomainVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
                {domainVerified && <p className="text-sm text-green-600">✓ Domain format verified</p>}
              </div>

              {domainInfo.custom_domain && (
                <>
                  {/* DNS Instructions Card */}
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">Hostinger DNS Setup Instructions</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-400 p-3 rounded-lg text-xs flex gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>IMPORTANT: Using Lovable for Custom Domains?</strong><br/>
                        If you already connected this domain directly in <strong>Lovable's Project Settings</strong>, Lovable requires you to keep their <strong>A</strong> and <strong>TXT</strong> records. In that case, <strong>DO NOT add this CNAME record</strong>. The A record already routes the traffic correctly!
                        <br/><br/>
                        <em>Only use the CNAME instructions below if you are pointing a domain without adding it to Lovable's Project Settings.</em>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs text-blue-700 dark:text-blue-300">

                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">1</span>
                        <span>Log in to <strong>Hostinger hPanel</strong> → <strong>Domains</strong> → Select your domain → <strong>DNS / Nameservers</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">2</span>
                        <span>Click <strong>"Add Record"</strong> and fill in:</span>
                      </div>
                    </div>

                    {/* CNAME Record Box */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-700 overflow-hidden">
                      <div className="grid grid-cols-3 gap-px bg-blue-100 dark:bg-blue-900 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        <div className="bg-white dark:bg-slate-900 px-3 py-2">Type</div>
                        <div className="bg-white dark:bg-slate-900 px-3 py-2">Name / Host</div>
                        <div className="bg-white dark:bg-slate-900 px-3 py-2">Value / Target</div>
                      </div>
                      <div className="grid grid-cols-3 gap-px bg-blue-100 dark:bg-blue-900 font-mono text-xs">
                        <div className="bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5 font-bold text-blue-700 dark:text-blue-300">CNAME</div>
                        <div className="bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5 flex items-center justify-between">
                          <span className="truncate mr-1 select-all">
                            {domainInfo.custom_domain
                              .replace(/^https?:\/\//, '')
                              .replace(/\/$/, '')
                              .split('.')[0]}
                          </span>
                          <Button variant="ghost" size="sm" className="h-5 p-1 flex-shrink-0"
                            onClick={() => {
                              const host = domainInfo.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('.')[0];
                              navigator.clipboard.writeText(host);
                              toast.success('Copied!');
                            }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5 flex items-center justify-between">
                          <span className="truncate mr-1 select-all">{getCnameTarget()}</span>
                          <Button variant="ghost" size="sm" className="h-5 p-1 flex-shrink-0"
                            onClick={() => { navigator.clipboard.writeText(getCnameTarget()); toast.success('Copied!'); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-blue-700 dark:text-blue-300">
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">3</span>
                        <span>Set TTL to <strong>Auto</strong> or <strong>3600</strong>. Click <strong>Save</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px]">⏱</span>
                        <span>DNS propagation takes <strong>10 minutes to 24 hours</strong>. Once done, the custom domain will load your franchise portal.</span>
                      </div>
                    </div>

                    {/* Quick copy full instruction */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-xs"
                      onClick={() => {
                        const host = domainInfo.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('.')[0];
                        navigator.clipboard.writeText(`Type: CNAME\nName/Host: ${host}\nValue/Target: ${getCnameTarget()}\nTTL: 3600`);
                        toast.success('DNS record details copied!');
                      }}
                    >
                      <Copy className="h-3 w-3 mr-2" /> Copy All DNS Details
                    </Button>
                  </div>

                  {/* SSL Note */}
                  <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3 flex gap-3 text-xs">
                    <Shield className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 text-green-700 dark:text-green-300">
                      <p className="font-semibold">SSL Certificate</p>
                      <p>HTTPS is automatically provisioned by Hostinger once the CNAME record is verified. No extra steps needed for SSL.</p>
                    </div>
                  </div>
                </>
              )}

              <p className="text-sm text-muted-foreground">
                Leave blank to use subdomain: <code className="text-primary">https://{companyInfo.slug || 'slug'}.{getMainDomain()}</code>
              </p>
            </div>
          )}

          {/* STEP 3: Contact */}
          {step === 3 && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input id="franchise-phone" placeholder="+91 9876543210" value={contactInfo.phone} onChange={(e) => setContactInfo(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input id="franchise-email-contact" type="email" placeholder="contact@company.com" value={contactInfo.email} onChange={(e) => setContactInfo(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input placeholder="https://company.com" value={contactInfo.website_url} onChange={(e) => setContactInfo(p => ({ ...p, website_url: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea placeholder="Full business address" value={contactInfo.address} onChange={(e) => setContactInfo(p => ({ ...p, address: e.target.value }))} />
              </div>
            </div>
          )}

          {/* STEP 4: SMS */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                <Zap className="h-4 w-4 inline mr-1" />Each franchise uses their own GreenSMS account with DLT-registered templates.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GreenSMS Username</Label>
                  <Input placeholder="FranchiseName" value={smsConfig.username} onChange={(e) => setSmsConfig(p => ({ ...p, username: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" placeholder="API key from GreenSMS" value={smsConfig.api_key} onChange={(e) => setSmsConfig(p => ({ ...p, api_key: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sender ID (DLT)</Label>
                  <Input placeholder="FRNCHZ" maxLength={6} value={smsConfig.sender_id} onChange={(e) => setSmsConfig(p => ({ ...p, sender_id: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>DLT Entity ID</Label>
                  <Input placeholder="170XXXXXXXXXXXXXXXX" value={smsConfig.dlt_entity_id} onChange={(e) => setSmsConfig(p => ({ ...p, dlt_entity_id: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">DLT Template IDs</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(smsConfig.dlt_template_ids).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
                      <Input
                        placeholder={`Template ID for ${key}`}
                        value={val}
                        onChange={(e) => setSmsConfig(p => ({ ...p, dlt_template_ids: { ...p.dlt_template_ids, [key]: e.target.value } }))}
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to use master Hariox SMS credentials as fallback.</p>
            </div>
          )}

          {/* STEP 5: WhatsApp WABA */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                Full Meta WABA — each franchise sends WhatsApp from their own registered business number.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Meta Phone Number ID</Label>
                  <Input placeholder="106XXXXXXXXXX" value={wabaConfig.meta_phone_id} onChange={(e) => setWabaConfig(p => ({ ...p, meta_phone_id: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>WABA ID</Label>
                  <Input placeholder="WABA Account ID" value={wabaConfig.waba_id} onChange={(e) => setWabaConfig(p => ({ ...p, waba_id: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meta Access Token</Label>
                <Input type="password" placeholder="EAAxxxxx..." value={wabaConfig.meta_access_token} onChange={(e) => setWabaConfig(p => ({ ...p, meta_access_token: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business ID</Label>
                  <Input placeholder="Meta Business Manager ID" value={wabaConfig.meta_business_id} onChange={(e) => setWabaConfig(p => ({ ...p, meta_business_id: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Webhook Verify Token</Label>
                  <Input placeholder="Random secret string" value={wabaConfig.webhook_verify_token} onChange={(e) => setWabaConfig(p => ({ ...p, webhook_verify_token: e.target.value }))} />
                </div>
              </div>
              <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                Open Meta Business Manager <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* STEP 6: Analytics */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Google Analytics Measurement ID</Label>
                <Input placeholder="G-XXXXXXXXXX" value={analyticsConfig.google_analytics_id} onChange={(e) => setAnalyticsConfig(p => ({ ...p, google_analytics_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Megaphone className="h-4 w-4" />Meta Pixel ID</Label>
                <Input placeholder="123456789012345" value={analyticsConfig.meta_pixel_id} onChange={(e) => setAnalyticsConfig(p => ({ ...p, meta_pixel_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Meta Ads Account ID</Label>
                <Input placeholder="act_XXXXXXXXXX" value={analyticsConfig.meta_ads_account_id} onChange={(e) => setAnalyticsConfig(p => ({ ...p, meta_ads_account_id: e.target.value }))} />
              </div>
            </div>
          )}

          {/* STEP 7: Franchise Terms */}
          {step === 7 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Setup Fee (₹)</Label>
                  <Input type="number" min="0" placeholder="50000" value={franchiseTerms.setup_fee} onChange={(e) => setFranchiseTerms(p => ({ ...p, setup_fee: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">One-time onboarding fee</p>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Fee (₹)</Label>
                  <Input type="number" min="0" placeholder="5000" value={franchiseTerms.monthly_fee} onChange={(e) => setFranchiseTerms(p => ({ ...p, monthly_fee: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Monthly platform fee</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-xl bg-card">
                <div className="space-y-2">
                  <Label>Royalty Model</Label>
                  <select 
                    className="w-full h-10 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={franchiseTerms.royalty_type}
                    onChange={(e) => setFranchiseTerms(p => ({ ...p, royalty_type: e.target.value }))}
                  >
                    <option value="per_lead">Flat Fee Per Lead</option>
                    <option value="percentage">Percentage of Revenue</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Royalty calculation type</p>
                </div>

                {franchiseTerms.royalty_type === 'percentage' ? (
                  <div className="space-y-2">
                    <Label>Royalty Percentage (%)</Label>
                    <Input type="number" step="0.1" min="0" max="100" placeholder="5.5" value={franchiseTerms.royalty_percentage} onChange={(e) => setFranchiseTerms(p => ({ ...p, royalty_percentage: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">% of monthly revenue</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Royalty Per Paid Lead (₹)</Label>
                    <Input type="number" min="0" placeholder="50" value={franchiseTerms.royalty_per_lead} onChange={(e) => setFranchiseTerms(p => ({ ...p, royalty_per_lead: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Flat fee per converted lead</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Royalty GST Rate (%)</Label>
                  <Input type="number" step="0.1" min="0" max="100" placeholder="18" value={franchiseTerms.gst_rate} onChange={(e) => setFranchiseTerms(p => ({ ...p, gst_rate: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">GST applied on royalties</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Switch checked={franchiseTerms.setup_fee_paid} onCheckedChange={(v) => setFranchiseTerms(p => ({ ...p, setup_fee_paid: v }))} />
                <div>
                  <Label>Setup Fee Already Paid</Label>
                  <p className="text-xs text-muted-foreground">Mark this if the setup fee has been collected</p>
                </div>
              </div>
              {/* Summary */}
              <div className="bg-muted rounded-xl p-4 space-y-2">
                <p className="font-semibold text-sm">Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Company:</span><span className="font-medium">{companyInfo.name}</span>
                  <span className="text-muted-foreground">Domain:</span><span>{domainInfo.custom_domain || `hariox.com/${companyInfo.slug}`}</span>
                  <span className="text-muted-foreground">Setup Fee:</span><span>₹{parseInt(franchiseTerms.setup_fee || '0').toLocaleString()}</span>
                  <span className="text-muted-foreground">Monthly Fee:</span><span>₹{parseInt(franchiseTerms.monthly_fee || '0').toLocaleString()}</span>
                  <span className="text-muted-foreground">Royalty Model:</span><span>{franchiseTerms.royalty_type === 'percentage' ? `${franchiseTerms.royalty_percentage}% of Revenue` : `₹${franchiseTerms.royalty_per_lead} per lead`}</span>
                  <span className="text-muted-foreground">Royalty GST Rate:</span><span>{franchiseTerms.gst_rate}%</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Owner Account */}
          {step === 8 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Switch
                  id="create-owner-toggle"
                  checked={ownerAccount.create_account}
                  onCheckedChange={(v) => setOwnerAccount(p => ({ ...p, create_account: v }))}
                />
                <div>
                  <Label>Create Franchise Owner Login</Label>
                  <p className="text-xs text-muted-foreground">The owner can log in to manage their own leads, payments and staff</p>
                </div>
              </div>
              {ownerAccount.create_account && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Owner Full Name</Label>
                    <Input id="owner-name" placeholder="John Doe" value={ownerAccount.full_name} onChange={(e) => setOwnerAccount(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Login Email</Label>
                    <Input id="owner-email" type="email" placeholder="owner@franchise.com" value={ownerAccount.email} onChange={(e) => setOwnerAccount(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Temporary Password</Label>
                    <Input id="owner-password" type="password" placeholder="Min 8 characters" value={ownerAccount.password} onChange={(e) => setOwnerAccount(p => ({ ...p, password: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Share this with the franchise owner. They should change it after first login.</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 text-sm">
                    <p className="font-medium">Franchise Admin Portal URL:</p>
                    <p className="text-primary font-mono text-xs mt-1">{getFranchisePortalUrl()}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={prevStep} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <span className="text-sm text-muted-foreground">Step {step} of 8</span>
        {step < 8 ? (
          <Button onClick={nextStep}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleFinish} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Complete Setup
          </Button>
        )}
      </div>
    </div>
  );
};

export default FranchiseOnboarding;
