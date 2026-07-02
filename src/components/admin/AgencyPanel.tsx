import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { 
  Building2, Globe, IndianRupee, Users, TrendingUp, 
  Settings2, Plus, ExternalLink, CheckCircle2, XCircle,
  MessageCircle, MessageSquare, BarChart3, Megaphone, Filter,
  RefreshCw, Copy, Loader2, FileText, Key, Receipt, Download, Pencil
} from "lucide-react";
// @ts-ignore
import html2pdf from 'html2pdf.js';


interface CompanyWithStats {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  setup_fee: number;
  setup_fee_paid: boolean;
  royalty_per_lead: number;
  monthly_fee?: number | null;
  is_active: boolean;
  created_at: string;
  lead_count?: number;
  paid_lead_count?: number;
  total_revenue?: number;
  pending_royalty?: number;
  collected_royalty?: number;
  royalty_type?: string;
  royalty_percentage?: number | null;
  gst_rate?: number | null;
  gst_number?: string | null;
  phone?: string | null;
  address?: string | null;
  primary_color?: string | null;
}

interface Integration {
  id: string;
  company_id: string;
  service_type: string;
  config: Record<string, any> | null;
  is_active: boolean;
}

interface RoyaltyTransaction {
  id: string;
  company_id: string;
  lead_id?: string | null;
  royalty_amount: number;
  status: string;
  created_at: string;
  collected_at: string | null;
  invoice_number?: string | null;
  due_date?: string | null;
  month_year?: string | null;
  monthly_fee?: number;
  gst_amount?: number;
  total_amount?: number;
  lead_count?: number;
  revenue_amount?: number;
}

const AgencyPanel = () => {
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [royalties, setRoyalties] = useState<RoyaltyTransaction[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Cloudflare dynamic domain states
  const [checkingDomains, setCheckingDomains] = useState<Record<string, boolean>>({});
  const [domainStatuses, setDomainStatuses] = useState<Record<string, string>>({});
  const [domainValidationRecords, setDomainValidationRecords] = useState<Record<string, Array<{txt_name: string, txt_value: string}>>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  
  // Modal Edit States
  const [modalCustomDomain, setModalCustomDomain] = useState<string>('');
  const [modalSetupFee, setModalSetupFee] = useState<string>('0');
  const [modalSetupFeePaid, setModalSetupFeePaid] = useState<boolean>(false);
  const [modalMonthlyFee, setModalMonthlyFee] = useState<string>('0');
  const [modalRoyaltyType, setModalRoyaltyType] = useState<string>('per_lead');
  const [modalRoyaltyPercentage, setModalRoyaltyPercentage] = useState<string>('0');
  const [modalRoyaltyPerLead, setModalRoyaltyPerLead] = useState<string>('0');
  const [modalGstRate, setModalGstRate] = useState<string>('18.0');
  const [modalGstNumber, setModalGstNumber] = useState<string>('');
  const [isSavingModal, setIsSavingModal] = useState<boolean>(false);

  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [editInvoiceStatus, setEditInvoiceStatus] = useState<string>('pending');
  const [editInvoiceNote, setEditInvoiceNote] = useState<string>('');
  const [editSmsCharges, setEditSmsCharges] = useState<string>('0');
  const [editWhatsappCharges, setEditWhatsappCharges] = useState<string>('0');
  const [editOtherCharges, setEditOtherCharges] = useState<string>('0');
  const [editOtherChargesDescription, setEditOtherChargesDescription] = useState<string>('');
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  useEffect(() => {
    if (selectedCompany) {
      const company = companies.find(c => c.id === selectedCompany);
      if (company) {
        setModalCustomDomain(company.custom_domain || '');
        setModalSetupFee(String(company.setup_fee || 0));
        setModalSetupFeePaid(!!company.setup_fee_paid);
        setModalMonthlyFee(String(company.monthly_fee || 0));
        setModalRoyaltyType(company.royalty_type || 'per_lead');
        setModalRoyaltyPercentage(String(company.royalty_percentage || 0));
        setModalRoyaltyPerLead(String(company.royalty_per_lead || 0));
        setModalGstRate(String(company.gst_rate || 18.0));
        setModalGstNumber(company.gst_number || '');
      }
    }
  }, [selectedCompany, companies]);

  const [editingIntegration, setEditingIntegration] = useState<{ companyId: string; serviceType: string } | null>(null);
  const [integrationConfig, setIntegrationConfig] = useState<Record<string, string>>({});

  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [analyticsMonthFilter, setAnalyticsMonthFilter] = useState<string>("all");

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    monthlySummary.forEach(row => {
      if (row.month_year) months.add(row.month_year);
    });
    royalties.forEach(r => {
      const my = (r as any).month_year;
      if (my) months.add(my);
    });
    return Array.from(months).sort().reverse();
  }, [monthlySummary, royalties]);

  const filteredMonthlySummary = useMemo(() => {
    return monthlySummary
      .filter(row => {
        const matchCompany = companyFilter === "all" || row.company_id === companyFilter;
        const matchMonth = monthFilter === "all" || row.month_year === monthFilter;
        return matchCompany && matchMonth;
      })
      .map(row => {
        const company       = companies.find(c => c.id === row.company_id);
        const platformFee   = Number(row.monthly_fee ?? company?.monthly_fee ?? 0);
        const smsCharges    = Number(row.sms_charges ?? 0);
        const waCharges     = Number(row.whatsapp_charges ?? 0);
        const otherCharges  = Number(row.other_charges ?? 0);
        const gstRate       = Number(row._gstRate ?? company?.gst_rate ?? 18);

        // Always recalculate royalty from live company settings so admin edits apply immediately
        const isPercentage  = (company?.royalty_type === 'percentage');
        // For percentage mode the revenue_amount is already stored on the enriched row
        const revenueAmt    = Number(row.revenue_amount ?? 0);
        const royaltyAmt    = isPercentage
          ? revenueAmt * (Number(company?.royalty_percentage ?? 0) / 100)
          : Number(row.transaction_count ?? 0) * Number(company?.royalty_per_lead ?? 0);

        const subtotal      = platformFee + royaltyAmt + smsCharges + waCharges + otherCharges;
        const gstAmt        = Math.round(subtotal * (gstRate / 100) * 100) / 100;
        const totalInvoice  = subtotal + gstAmt;

        return {
          ...row,
          total_royalty:  royaltyAmt,
          total_amount:   totalInvoice,
          gst_amount:     gstAmt,
          _platformFee:   platformFee,
          _gstRate:       gstRate,
          _gstAmt:        gstAmt,
          _totalInvoice:  totalInvoice,
        };
      });
  }, [monthlySummary, companyFilter, monthFilter, companies]);


  const filteredRoyalties = useMemo(() => {
    return royalties.filter(r => {
      const matchCompany = companyFilter === "all" || r.company_id === companyFilter;
      const my = (r as any).month_year;
      const matchMonth = monthFilter === "all" || my === monthFilter;
      return matchCompany && matchMonth;
    });
  }, [royalties, companyFilter, monthFilter]);

  useEffect(() => {
    fetchData();
  }, [analyticsMonthFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch companies
      const { data: companiesData } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      // Use server-side RPC for stats (no 1000-row limit)
      let statsData = null;
      try {
        const { data, error } = await supabase.rpc("get_agency_company_stats_by_month" as any, {
          p_month_year: analyticsMonthFilter
        } as any);
        if (error) throw error;
        statsData = data;
      } catch (err) {
        console.warn("get_agency_company_stats_by_month failed, falling back to all-time:", err);
        const { data } = await supabase.rpc("get_agency_company_stats");
        statsData = data;
      }

      // Fetch integrations
      const { data: integrationsData } = await supabase
        .from("company_integrations")
        .select("*");

      // Fetch royalties (latest 500 monthly invoices)
      const { data: royaltiesData } = await supabase
        .from("royalty_monthly_summary")
        .select("*")
        .order("month_year", { ascending: false })
        .limit(500);

      // Fetch monthly summary
      const { data: summaryData } = await supabase
        .from('royalty_monthly_summary')
        .select('*')
        .order('month_year', { ascending: false })
        .limit(24);
      const summary = summaryData || [];

      // Fetch payments for client-side fallback calculations
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("company_id, amount, total_amount, created_at, status")
        .in("status", ["captured", "completed", "paid"]);
      const payments = paymentsData || [];

      // Helper to enrich monthly summaries with dynamic calculations
      const enrichInvoices = (invoiceRows: any[], companiesList: any[], paymentsList: any[]) => {
        return (invoiceRows || []).map((row: any) => {
          const company = companiesList.find(c => c.id === row.company_id);
          const platformFee    = Number(row.monthly_fee  ?? company?.monthly_fee  ?? 0);
          const smsCharges      = Number(row.sms_charges ?? 0);
          const whatsappCharges = Number(row.whatsapp_charges ?? 0);
          const otherCharges   = Number(row.other_charges ?? 0);
          const otherDesc      = row.other_charges_description || "";
          
          const isPercentage = (company?.royalty_type === 'percentage');
          let royaltyAmt = 0;
          let revenueAmt = 0;
          
          if (isPercentage) {
            revenueAmt = (paymentsList || [])
              .filter(p => p.company_id === row.company_id && p.created_at && p.created_at.startsWith(row.month_year))
              .reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
            royaltyAmt = revenueAmt * (Number(company?.royalty_percentage ?? 0) / 100);
          } else {
            royaltyAmt = Number(row.transaction_count ?? row.lead_count ?? 0) * Number(company?.royalty_per_lead ?? 0);
          }

          const gstRate      = Number(row.gst_rate      ?? company?.gst_rate     ?? 18);
          const subtotal     = platformFee + royaltyAmt + smsCharges + whatsappCharges + otherCharges;
          const gstAmt       = Math.round(subtotal * (gstRate / 100) * 100) / 100;
          const totalInvoice = subtotal + gstAmt;
          
          return {
            ...row,
            total_royalty: royaltyAmt,
            revenue_amount: revenueAmt || Number(row.revenue_amount ?? 0),
            sms_charges: smsCharges,
            whatsapp_charges: whatsappCharges,
            other_charges: otherCharges,
            other_charges_description: otherDesc,
            gst_amount: gstAmt,
            total_amount: totalInvoice,
            pending: row.status === 'pending' ? totalInvoice : 0,
            collected: row.status === 'collected' ? totalInvoice : 0,
            _platformFee:  platformFee,
            _gstRate:      gstRate,
            _gstAmt:       gstAmt,
            _totalInvoice: totalInvoice,
          };
        });
      };

      const enrichedSummary = enrichInvoices(summary, companiesData || [], payments);
      const enrichedRoyalties = enrichInvoices(royaltiesData || [], companiesData || [], payments);

      // Merge stats into companies — use monthly summary totals for accurate pending royalty
      const enrichedCompanies = (companiesData || []).map((c: any) => {
        const stats = (statsData || []).find((s: any) => s.company_id === c.id);
        
        // Sum pending and collected total_amount from enriched monthly summary
        const pendingFromSummary = enrichedSummary
          .filter((r: any) => r.company_id === c.id && r.status === 'pending' && (analyticsMonthFilter === 'all' || r.month_year === analyticsMonthFilter))
          .reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
          
        const collectedFromSummary = enrichedSummary
          .filter((r: any) => r.company_id === c.id && r.status === 'collected' && (analyticsMonthFilter === 'all' || r.month_year === analyticsMonthFilter))
          .reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);

        return {
          ...c,
          lead_count: Number(stats?.total_leads || 0),
          paid_lead_count: Number(stats?.paid_leads || 0),
          total_revenue: Number(stats?.total_revenue || 0),
          pending_royalty: pendingFromSummary,
          collected_royalty: collectedFromSummary,
        };
      });

      setMonthlySummary(enrichedSummary);
      setCompanies(enrichedCompanies);
      setIntegrations((integrationsData || []).map((i: any) => ({ ...i, config: i.config as Record<string, any> || {} })));
      setRoyalties(enrichedRoyalties);
    } catch (err) {
      console.error("Agency panel fetch error:", err);
      toast.error("Failed to load agency data");
    } finally {
      setLoading(false);
    }
  };

  const checkCloudflareStatus = async (companyId: string, domain: string) => {
    if (!domain) return;
    setCheckingDomains(prev => ({ ...prev, [companyId]: true }));
    try {
      // Create custom hostname on Cloudflare first
      await supabase.functions.invoke('manage-cloudflare-domain', {
        body: { action: 'create', domain, company_id: companyId }
      });

      // Fetch status
      const { data, error } = await supabase.functions.invoke('manage-cloudflare-domain', {
        body: { action: 'status', domain, company_id: companyId }
      });
      if (error) throw error;
      if (data) {
        setDomainStatuses(prev => ({ ...prev, [companyId]: data.ssl_status || 'pending_validation' }));
        if (data.validation_records) {
          setDomainValidationRecords(prev => ({ ...prev, [companyId]: data.validation_records }));
        }
      }
    } catch (err: any) {
      console.error('Cloudflare verify error:', err);
      toast.error("Failed to fetch Cloudflare status");
    } finally {
      setCheckingDomains(prev => ({ ...prev, [companyId]: false }));
    }
  };

  const handleSaveModalConfig = async () => {
    if (!selectedCompany) return;
    const company = companies.find(c => c.id === selectedCompany);
    if (!company) return;

    setIsSavingModal(true);
    try {
      // Full payload with new columns (requires DB migration applied)
      const fullPayload = {
        custom_domain: modalCustomDomain || null,
        setup_fee: parseFloat(modalSetupFee) || 0,
        setup_fee_paid: modalSetupFeePaid,
        monthly_fee: parseFloat(modalMonthlyFee) || 0,
        royalty_type: modalRoyaltyType,
        royalty_percentage: parseFloat(modalRoyaltyPercentage) || 0,
        royalty_per_lead: parseFloat(modalRoyaltyPerLead) || 0,
        gst_rate: parseFloat(modalGstRate) || 18.0,
        gst_number: modalGstNumber || null,
      };

      // Fallback: only existing columns (pre-migration)
      const corePayload = {
        custom_domain: modalCustomDomain || null,
        setup_fee: parseFloat(modalSetupFee) || 0,
        setup_fee_paid: modalSetupFeePaid,
        monthly_fee: parseFloat(modalMonthlyFee) || 0,
        royalty_per_lead: parseFloat(modalRoyaltyPerLead) || 0,
      };

      let { error } = await supabase
        .from("companies")
        .update(fullPayload)
        .eq("id", selectedCompany);

      // If DB migration not yet applied, fall back to core columns only
      if (error && (
        error.message.includes("gst_rate") ||
        error.message.includes("royalty_type") ||
        error.message.includes("royalty_percentage") ||
        error.message.includes("gst_number") ||
        error.message.includes("schema cache")
      )) {
        const fallback = await supabase
          .from("companies")
          .update(corePayload)
          .eq("id", selectedCompany);
        error = fallback.error;
        if (!fallback.error) {
          toast.warning(
            "Basic settings saved ✓ — To also save GST Rate & Royalty Model, run the DB migration SQL in Supabase dashboard.",
            { duration: 8000 }
          );
        }
      }

      if (error) {
        toast.error("Failed to update: " + error.message);
        return;
      }

      if (!error) toast.success("Configuration saved successfully");

      // Synchronize custom domain with Cloudflare if changed
      const oldDomain = company.custom_domain;
      const newDomain = modalCustomDomain || null;
      if (newDomain !== oldDomain) {
        if (oldDomain) {
          try {
            await supabase.functions.invoke('manage-cloudflare-domain', {
              body: { action: 'delete', domain: oldDomain, company_id: selectedCompany }
            });
          } catch (cfErr) {
            console.error("Failed to delete old domain from Cloudflare:", cfErr);
          }
        }
        if (newDomain) {
          try {
            await supabase.functions.invoke('manage-cloudflare-domain', {
              body: { action: 'create', domain: newDomain, company_id: selectedCompany }
            });
            checkCloudflareStatus(selectedCompany, newDomain);
          } catch (cfErr) {
            console.error("Failed to register new domain in Cloudflare:", cfErr);
            toast.warning("Domain updated in DB, but failed to register in Cloudflare.");
          }
        } else {
          setDomainStatuses(prev => { const copy = { ...prev }; delete copy[selectedCompany]; return copy; });
          setDomainValidationRecords(prev => { const copy = { ...prev }; delete copy[selectedCompany]; return copy; });
        }
      }

      setSelectedCompany(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSavingModal(false);
    }
  };

  // Franchise Detail States
  const [detailCompany, setDetailCompany] = useState<CompanyWithStats | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [franchiseStaff, setFranchiseStaff] = useState<any[]>([]);
  const [franchiseLeadFunnel, setFranchiseLeadFunnel] = useState<Record<string, number>>({});
  const [activeDetailTab, setActiveDetailTab] = useState<string>("overview");
  
  // Pricing Terms Form State
  const [editSetupFee, setEditSetupFee] = useState<string>('0');
  const [editMonthlyFee, setEditMonthlyFee] = useState<string>('0');
  const [editRoyaltyPerLead, setEditRoyaltyPerLead] = useState<string>('0');
  const [editRoyaltyType, setEditRoyaltyType] = useState<string>('per_lead');
  const [editRoyaltyPercentage, setEditRoyaltyPercentage] = useState<string>('0');
  const [editGstRate, setEditGstRate] = useState<string>('18.0');
  const [editSetupFeePaid, setEditSetupFeePaid] = useState<boolean>(false);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editGstNumber, setEditGstNumber] = useState<string>('');
  const [isSavingTerms, setIsSavingTerms] = useState(false);

  // Branding Identity Form State
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editCompanySlug, setEditCompanySlug] = useState<string>('');
  const [editCustomDomain, setEditCustomDomain] = useState<string>('');
  const [editPrimaryColor, setEditPrimaryColor] = useState<string>('#1e3a5f');
  const [editSecondaryColor, setEditSecondaryColor] = useState<string>('#f59e0b');
  const [editLogoUrl, setEditLogoUrl] = useState<string>('');
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const fetchFranchiseStaff = async (companyId: string) => {
    try {
      const { data: companyUsers, error: cuError } = await supabase
        .from('company_users')
        .select('user_id')
        .eq('company_id', companyId);
      
      if (cuError) throw cuError;
      
      if (!companyUsers || companyUsers.length === 0) {
        setFranchiseStaff([]);
        return;
      }
      
      const userIds = companyUsers.map(cu => cu.user_id);
      
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);
         
      if (pError) throw pError;
      
      const { data: roles, error: rError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
         
      if (rError) throw rError;
      
      const mergedStaff = (profiles || []).map(p => {
        const userRoles = (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role);
        return {
          ...p,
          roles: userRoles
        };
      });
      
      setFranchiseStaff(mergedStaff);
    } catch (err) {
      console.error("Error fetching franchise staff:", err);
    }
  };

  const fetchFranchiseLeadFunnel = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('status')
        .eq('company_id', companyId);
         
      if (error) throw error;
      
      const statusCounts: Record<string, number> = {};
      (data || []).forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });
      
      setFranchiseLeadFunnel(statusCounts);
    } catch (err) {
      console.error("Error fetching franchise lead funnel:", err);
    }
  };

  const handleOpenFranchiseDetails = (company: CompanyWithStats) => {
    setDetailCompany(company);
    setEditCompanyName(company.name || '');
    setEditCompanySlug(company.slug || '');
    setEditCustomDomain(company.custom_domain || '');
    setEditPrimaryColor((company as any).primary_color || '#1e3a5f');
    setEditSecondaryColor((company as any).secondary_color || '#f59e0b');
    setEditLogoUrl((company as any).logo_url || '');

    setEditSetupFee(String(company.setup_fee || 0));
    setEditMonthlyFee(String(company.monthly_fee || 0));
    setEditRoyaltyPerLead(String(company.royalty_per_lead || 0));
    setEditRoyaltyType(company.royalty_type || 'per_lead');
    setEditRoyaltyPercentage(String(company.royalty_percentage || 0));
    setEditGstRate(String(company.gst_rate || 18.0));
    setEditSetupFeePaid(!!company.setup_fee_paid);
    setEditIsActive(!!company.is_active);
    setEditGstNumber(company.gst_number || '');
    
    // Reset staff and funnel
    setFranchiseStaff([]);
    setFranchiseLeadFunnel({});
    setActiveDetailTab("overview");
    setIsDetailOpen(true);
    
    // Fetch detailed sub-data
    fetchFranchiseStaff(company.id);
    fetchFranchiseLeadFunnel(company.id);
  };

  const handleSaveBranding = async () => {
    if (!detailCompany) return;
    setIsSavingBranding(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: editCompanyName,
          slug: editCompanySlug,
          custom_domain: editCustomDomain || null,
          primary_color: editPrimaryColor,
          secondary_color: editSecondaryColor,
          logo_url: editLogoUrl || null
        })
        .eq('id', detailCompany.id);
        
      if (error) throw error;
      
      toast.success("Branding & Identity updated");
      
      setCompanies(prev => prev.map(c => c.id === detailCompany.id ? {
        ...c,
        name: editCompanyName,
        slug: editCompanySlug,
        custom_domain: editCustomDomain || null,
        primary_color: editPrimaryColor,
        secondary_color: editSecondaryColor,
        logo_url: editLogoUrl || null
      } : c));
      
      setDetailCompany(prev => prev ? {
        ...prev,
        name: editCompanyName,
        slug: editCompanySlug,
        custom_domain: editCustomDomain || null,
        primary_color: editPrimaryColor,
        secondary_color: editSecondaryColor,
        logo_url: editLogoUrl || null
      } : null);
      
    } catch (err: any) {
      console.error("Error updating branding:", err);
      toast.error(err.message || "Failed to update branding");
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleSavePricingTerms = async () => {
    if (!detailCompany) return;
    setIsSavingTerms(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          setup_fee: parseFloat(editSetupFee) || 0,
          monthly_fee: parseFloat(editMonthlyFee) || 0,
          royalty_per_lead: parseFloat(editRoyaltyPerLead) || 0,
          royalty_type: editRoyaltyType,
          royalty_percentage: parseFloat(editRoyaltyPercentage) || 0,
          gst_rate: parseFloat(editGstRate) || 0,
          setup_fee_paid: editSetupFeePaid,
          is_active: editIsActive,
          gst_number: editGstNumber || null
        })
        .eq('id', detailCompany.id);
        
      if (error) throw error;
      
      toast.success("Pricing terms updated — recalculating all invoices…");
      
      // Update local state immediately so UI reflects new settings right away
      // (filteredMonthlySummary recalculates royalty from live company settings)
      setCompanies(prev => prev.map(c => c.id === detailCompany.id ? {
        ...c,
        setup_fee: parseFloat(editSetupFee) || 0,
        monthly_fee: parseFloat(editMonthlyFee) || 0,
        royalty_per_lead: parseFloat(editRoyaltyPerLead) || 0,
        royalty_type: editRoyaltyType,
        royalty_percentage: parseFloat(editRoyaltyPercentage) || 0,
        gst_rate: parseFloat(editGstRate) || 0,
        setup_fee_paid: editSetupFeePaid,
        is_active: editIsActive,
        gst_number: editGstNumber || null
      } : c));
      
      setDetailCompany(prev => prev ? {
        ...prev,
        setup_fee: parseFloat(editSetupFee) || 0,
        monthly_fee: parseFloat(editMonthlyFee) || 0,
        royalty_per_lead: parseFloat(editRoyaltyPerLead) || 0,
        royalty_type: editRoyaltyType,
        royalty_percentage: parseFloat(editRoyaltyPercentage) || 0,
        gst_rate: parseFloat(editGstRate) || 0,
        setup_fee_paid: editSetupFeePaid,
        is_active: editIsActive,
        gst_number: editGstNumber || null
      } : null);

      // Also reload from DB — the DB trigger has recalculated all invoices for this company
      // Small delay to allow the DB trigger to complete
      setTimeout(() => fetchData(), 1200);
      
    } catch (err: any) {
      console.error("Error updating pricing terms:", err);
      toast.error(err.message || "Failed to update terms");
    } finally {
      setIsSavingTerms(false);
    }
  };

  const saveIntegration = async () => {
    if (!editingIntegration) return;
    
    const { error } = await supabase
      .from("company_integrations")
      .upsert({
        company_id: editingIntegration.companyId,
        service_type: editingIntegration.serviceType,
        config: integrationConfig,
        is_active: true,
      }, { onConflict: "company_id,service_type" });

    if (error) {
      toast.error("Failed to save integration");
    } else {
      toast.success("Integration saved");
      setEditingIntegration(null);
      setIntegrationConfig({});
      fetchData();
    }
  };

  const markRoyaltyCollected = async (royaltyId: string) => {
    const { error } = await supabase
      .from("royalty_transactions")
      .update({ status: "collected", collected_at: new Date().toISOString() })
      .eq("id", royaltyId);

    if (error) {
      toast.error("Failed to update royalty");
    } else {
      toast.success("Royalty marked as collected");
      fetchData();
    }
  };

  const bulkCollectRoyalties = async (companyId: string, monthYear: string) => {
    const { data, error } = await supabase.rpc('collect_royalties_bulk', {
      p_company_id: companyId,
      p_month_year: monthYear,
    });
    if (error) {
      toast.error('Failed to collect royalties');
    } else {
      toast.success(`Collected ${data} royalty transactions for ${monthYear}`);
      fetchData();
    }
  };

  const saveInvoiceEdit = async () => {
    if (!editingInvoice) return;
    setIsSavingInvoice(true);
    try {
      const company   = companies.find(c => c.id === editingInvoice.company_id);
      const smsVal    = parseFloat(editSmsCharges) || 0;
      const waVal     = parseFloat(editWhatsappCharges) || 0;
      const otherVal  = parseFloat(editOtherCharges) || 0;

      // Recalculate royalty using live company settings
      const isPercentage  = (company?.royalty_type === 'percentage');
      const revenueAmt    = Number(editingInvoice.revenue_amount ?? 0);
      const royaltyAmt    = isPercentage
        ? revenueAmt * (Number(company?.royalty_percentage ?? 0) / 100)
        : Number(editingInvoice.transaction_count ?? 0) * Number(company?.royalty_per_lead ?? 0);

      const platformFee   = Number(editingInvoice.monthly_fee ?? company?.monthly_fee ?? 0);
      const gstRate       = Number(company?.gst_rate ?? 18);
      const subtotal      = platformFee + royaltyAmt + smsVal + waVal + otherVal;
      const gstAmt        = Math.round(subtotal * (gstRate / 100) * 100) / 100;
      const totalAmt      = subtotal + gstAmt;

      const payload = {
        status:                      editInvoiceStatus,
        collected_at:                editInvoiceStatus === 'collected' ? new Date().toISOString() : null,
        sms_charges:                 smsVal,
        whatsapp_charges:            waVal,
        other_charges:               otherVal,
        other_charges_description:   editOtherChargesDescription || null,
        royalty_amount:              royaltyAmt,
        gst_amount:                  gstAmt,
        total_amount:                totalAmt,
      };

      let { error } = await supabase
        .from('royalty_transactions')
        .update(payload)
        .eq('company_id', editingInvoice.company_id)
        .eq('month_year', editingInvoice.month_year);

      // Fallback if extra charge columns don't exist yet in the DB (pre-migration)
      if (error && (
        error.message.includes("sms_charges") ||
        error.message.includes("whatsapp_charges") ||
        error.message.includes("other_charges")
      )) {
        const fallback = await supabase
          .from('royalty_transactions')
          .update({
            status:         editInvoiceStatus,
            collected_at:   editInvoiceStatus === 'collected' ? new Date().toISOString() : null,
            royalty_amount: royaltyAmt,
            gst_amount:     gstAmt,
            total_amount:   totalAmt,
          })
          .eq('company_id', editingInvoice.company_id)
          .eq('month_year', editingInvoice.month_year);
        error = fallback.error;
        if (!error) {
          toast.warning("Status & amounts saved! Run the SQL migration in Supabase dashboard to also save SMS/WhatsApp/Other charges.");
        }
      }

      if (error) throw error;
      toast.success('Invoice updated successfully');
      setEditingInvoice(null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update invoice: ' + err.message);
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const downloadRoyaltyInvoice = (row: any) => {
    const company = companies.find(c => c.id === row.company_id);
    const revenueAmt  = Number(row.revenue_amount ?? 0);
    const platformFee = Number(row.monthly_fee ?? company?.monthly_fee ?? 0);
    const smsCharges  = Number(row.sms_charges ?? 0);
    const waCharges   = Number(row.whatsapp_charges ?? 0);
    const otherCharges = Number(row.other_charges ?? 0);
    const otherDesc   = row.other_charges_description || 'Other Charges';
    const isPercentage = (company?.royalty_type === 'percentage');
    const royaltyAmt  = isPercentage
      ? revenueAmt * (Number(company?.royalty_percentage ?? 0) / 100)
      : Number(row.transaction_count ?? 0) * Number(company?.royalty_per_lead ?? 0);
    const gstRate     = Number(company?.gst_rate ?? 18);
    const subtotal    = platformFee + royaltyAmt + smsCharges + waCharges + otherCharges;
    const gstAmt      = Math.round(subtotal * (gstRate / 100) * 100) / 100;
    const totalInv    = subtotal + gstAmt;

    const monthLabel  = row.month_year ? new Date(row.month_year + '-02').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : row.month_year;
    const invoiceNo   = row.invoice_number || `INV-${row.month_year?.replace('-', '')}`;
    const dueDate     = row.earliest_due_date ? new Date(row.earliest_due_date).toLocaleDateString('en-IN') : 'N/A';
    const today       = new Date().toLocaleDateString('en-IN');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Royalty Invoice ${invoiceNo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; font-size: 13px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .brand { font-size: 22px; font-weight: 800; color: #4F46E5; }
        .brand-sub { font-size: 11px; color: #666; margin-top: 2px; }
        h2 { text-align: center; font-size: 18px; letter-spacing: 2px; margin: 20px 0; border-top: 2px solid #4F46E5; border-bottom: 2px solid #4F46E5; padding: 8px 0; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 24px; }
        .meta-box { background: #f7f7f7; border-radius: 8px; padding: 12px 16px; width: 48%; }
        .meta-box p { margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #4F46E5; color: white; padding: 8px 12px; text-align: left; font-size: 11px; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        .totals { margin-left: auto; width: 280px; margin-top: 8px; }
        .totals tr td { padding: 5px 12px; }
        .totals .grand { font-size: 15px; font-weight: 800; background: #f0f0ff; }
        .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-collected { background: #d1fae5; color: #065f46; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-overdue { background: #fee2e2; color: #991b1b; }
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="brand">Hariox</div>
          <div class="brand-sub" style="font-weight: 600; color: #4F46E5;">Your Trust. Our Expertise.</div>
          <div style="font-size:11px; color:#555; margin-top:6px; line-height:1.4;">
            <div><strong>GSTIN:</strong> 24AAGCF2801F1Z6</div>
            <div><strong>Address:</strong> M-1304, River View Height, Pedar Road, Mota Varachha, Surat, Gujarat, India - 394101</div>
            <div><strong>Contact:</strong> Sharmil Mangukiya (+91 9422799318)</div>
            <div><strong>Email:</strong> hariox@gmail.com</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:#666">Invoice Date: ${today}</div>
          <div style="font-size:11px;color:#666">Due Date: ${dueDate}</div>
          <div style="font-size:13px;font-weight:700;color:#4F46E5;margin-top:4px">${invoiceNo}</div>
          <span class="badge ${row.status === 'collected' ? 'badge-collected' : row.status === 'overdue' ? 'badge-overdue' : 'badge-pending'}">${row.status === 'collected' ? 'COLLECTED' : 'PENDING'}</span>
        </div>
      </div>
      <h2>ROYALTY INVOICE</h2>
      <div class="meta">
        <div class="meta-box">
          <p style="font-weight:700;font-size:13px">BILL TO</p>
          <p style="font-weight:600;margin:2px 0;">${row.company_name}</p>
          ${company?.gst_number ? `<p style="margin:2px 0;"><strong>GSTIN:</strong> ${company.gst_number}</p>` : ''}
          ${company?.phone ? `<p style="margin:2px 0;"><strong>Phone:</strong> ${company.phone}</p>` : ''}
          ${company?.address ? `<p style="margin:2px 0;font-size:11px;color:#555;"><strong>Address:</strong> ${company.address}</p>` : ''}
          <p style="color:#666;margin:4px 0 2px 0;">Month: ${monthLabel}</p>
        </div>
        <div class="meta-box">
          <p style="font-weight:700;font-size:13px">INVOICE DETAILS</p>
          <p>Invoice #: <strong>${invoiceNo}</strong></p>
          <p>Period: <strong>${monthLabel}</strong></p>
          <p>Paid Leads: <strong>${row.transaction_count}</strong></p>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Description</th><th style="text-align:right">Amount (₹)</th>
        </tr></thead>
        <tbody>
          <tr><td>Platform Subscription Fee (Monthly)</td><td style="text-align:right">₹${platformFee.toLocaleString('en-IN')}</td></tr>
          <tr>
            <td>
              Royalty Charges 
              ${company?.royalty_type === 'percentage' 
                ? `<span style="font-weight: 600;">(${company?.royalty_percentage}% of Revenue)</span><br/><span style="font-size: 11px; color: #555;">Calculation: ₹${revenueAmt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (Revenue) × ${company?.royalty_percentage}% = ₹${royaltyAmt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>` 
                : `<span style="font-weight: 600;">(Flat Fee Per Lead)</span><br/><span style="font-size: 11px; color: #555;">Calculation: ${row.transaction_count} (Leads) × ₹${(company?.royalty_per_lead || 0).toLocaleString('en-IN')} = ₹${royaltyAmt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`}
            </td>
            <td style="text-align:right;vertical-align:bottom;">₹${royaltyAmt.toLocaleString('en-IN')}</td>
          </tr>
          ${smsCharges > 0 ? `<tr><td>SMS Provider Charges</td><td style="text-align:right">₹${smsCharges.toLocaleString('en-IN')}</td></tr>` : ''}
          ${waCharges > 0 ? `<tr><td>WhatsApp API/WABA Charges</td><td style="text-align:right">₹${waCharges.toLocaleString('en-IN')}</td></tr>` : ''}
          ${otherCharges > 0 ? `<tr><td>${otherDesc}</td><td style="text-align:right">₹${otherCharges.toLocaleString('en-IN')}</td></tr>` : ''}
          <tr><td>GST @ ${gstRate}% on Subtotal</td><td style="text-align:right">₹${gstAmt.toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>
      <table class="totals">
        <tr><td>Subtotal</td><td style="text-align:right">₹${subtotal.toLocaleString('en-IN')}</td></tr>
        <tr><td>GST (${gstRate}%)</td><td style="text-align:right">₹${gstAmt.toLocaleString('en-IN')}</td></tr>
        <tr class="grand"><td><strong>TOTAL DUE</strong></td><td style="text-align:right"><strong>₹${totalInv.toLocaleString('en-IN')}</strong></td></tr>
      </table>
      <div style="margin-top:24px;padding:12px;background:#f0f0ff;border-radius:8px;font-size:11px;">
        <strong>Payment Note:</strong> Please transfer the total amount to Hariox's designated bank account before the due date.
        Late payments may attract interest @2% per month.
      </div>
      <div class="footer">
        Hariox &bull; hariox@gmail.com &bull; This is a computer-generated royalty invoice.
      </div>
    </body></html>`;

    toast.info("Generating PDF, please wait...");
    
    const opt: any = {
      margin:       10,
      filename:     `${invoiceNo}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(html).save().then(() => {
      toast.success("PDF Downloaded successfully!");
    }).catch((err: any) => {
      console.error(err);
      toast.error("Failed to generate PDF");
    });
  };


  const totalLeads = companies.reduce((s, c) => s + (c.lead_count || 0), 0);
  const totalPaidLeads = companies.reduce((s, c) => s + (c.paid_lead_count || 0), 0);
  const totalRevenue = companies.reduce((s, c) => s + (c.total_revenue || 0), 0);
  const totalPendingRoyalty = companies.reduce((s, c) => s + (c.pending_royalty || 0), 0);

  const serviceTypeLabels: Record<string, { label: string; icon: React.ElementType; fields: string[] }> = {
    whatsapp: { label: "WhatsApp WABA", icon: MessageCircle, fields: ["meta_phone_id", "meta_access_token", "meta_business_id", "webhook_verify_token"] },
    sms: { label: "SMS Provider", icon: MessageSquare, fields: ["provider", "api_key", "sender_id", "dlt_entity_id"] },
    google_analytics: { label: "Google Analytics", icon: BarChart3, fields: ["measurement_id"] },
    meta_pixel: { label: "Meta Pixel", icon: Megaphone, fields: ["pixel_id"] },
    meta_ads: { label: "Meta Ads", icon: Megaphone, fields: ["access_token", "ad_account_id"] },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Agency Dashboard</h2>
        <p className="text-muted-foreground">Manage all client companies, integrations & royalties</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{companies.length}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <IndianRupee className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">₹{(totalRevenue / 1000).toFixed(1)}K</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">₹{totalPendingRoyalty.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Pending Royalty</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="royalties">Royalties</TabsTrigger>
          <TabsTrigger value="analytics">Franchise Analytics</TabsTrigger>
        </TabsList>

        {/* CLIENTS TAB */}
        <TabsContent value="clients">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Client Companies</CardTitle>
                <CardDescription>Manage domains, fees, and royalty per client</CardDescription>
              </div>
              <Button onClick={() => window.location.href = '/admin/dashboard/franchise-onboarding'} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Onboard New Franchise
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Monthly Fee</TableHead>
                    <TableHead>Royalty Model</TableHead>
                    <TableHead>Pending Royalty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        {company.custom_domain ? (
                          <a href={`https://${company.custom_domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                            <Globe className="h-3 w-3" />
                            {company.custom_domain}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>{company.lead_count || 0}</TableCell>
                      <TableCell>{company.paid_lead_count || 0}</TableCell>
                      <TableCell>₹{(company.total_revenue || 0).toLocaleString()}</TableCell>
                      <TableCell>₹{(company.monthly_fee || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        {company.royalty_type === 'percentage' 
                          ? `${company.royalty_percentage || 0}% of Rev` 
                          : `₹${company.royalty_per_lead || 0}/lead`
                        }
                      </TableCell>
                      <TableCell className="font-semibold text-orange-600">₹{(company.pending_royalty || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={company.is_active ? "default" : "secondary"}>
                          {company.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleOpenFranchiseDetails(company as any)}>
                          <Settings2 className="h-3 w-3 mr-1" /> Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Company Config Dialog */}
          <Dialog open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Configure Company</DialogTitle>
              </DialogHeader>
              {selectedCompany && (() => {
                const company = companies.find(c => c.id === selectedCompany);
                if (!company) return null;
                return (
                  <div className="space-y-4">
                    <div>
                      <Label>Custom Domain</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={modalCustomDomain} 
                          onChange={(e) => setModalCustomDomain(e.target.value)}
                          placeholder="loans.clientsite.com"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Client's domain that points to this app</p>

                      {company.custom_domain && (
                        <div className="mt-3 bg-muted/50 border border-muted/80 rounded-lg p-3 space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-muted-foreground">Cloudflare SSL & DNS Status</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              disabled={checkingDomains[company.id]} 
                              onClick={() => checkCloudflareStatus(company.id, company.custom_domain || "")}
                              className="h-7 w-7 p-0"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${checkingDomains[company.id] ? 'animate-spin' : ''}`} />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>SSL Certificate:</span>
                            <Badge 
                              variant="secondary"
                              className={
                                domainStatuses[company.id] === 'active' 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none font-medium" 
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-none font-medium"
                              }
                            >
                              {domainStatuses[company.id] || 'Not checked / Pending'}
                            </Badge>
                          </div>

                          {domainValidationRecords[company.id] && domainValidationRecords[company.id].length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-muted-foreground/10">
                              <p className="text-[10px] text-muted-foreground">SSL validation records (add to client DNS as TXT if CNAME isn't ready):</p>
                              {domainValidationRecords[company.id].map((rec, idx) => (
                                <div key={idx} className="bg-background rounded p-2 text-xs space-y-2 border border-muted/60">
                                  <div>
                                    <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">TXT Record Name</p>
                                    <div className="flex items-center justify-between font-mono text-[9px] bg-muted/30 p-1 rounded mt-0.5">
                                      <span className="truncate mr-2 select-all">{rec.txt_name}</span>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { navigator.clipboard.writeText(rec.txt_name); toast.success('Copied name!'); }} 
                                        className="h-4 p-0.5"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">TXT Record Value</p>
                                    <div className="flex items-center justify-between font-mono text-[9px] bg-muted/30 p-1 rounded mt-0.5">
                                      <span className="truncate mr-2 select-all">{rec.txt_value}</span>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { navigator.clipboard.writeText(rec.txt_value); toast.success('Copied value!'); }} 
                                        className="h-4 p-0.5"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Setup Fee (₹)</Label>
                      <Input 
                        type="number"
                        value={modalSetupFee}
                        onChange={(e) => setModalSetupFee(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>Setup Fee Paid</Label>
                      <Button 
                        size="sm"
                        variant={modalSetupFeePaid ? "default" : "outline"}
                        onClick={() => setModalSetupFeePaid(!modalSetupFeePaid)}
                      >
                        {modalSetupFeePaid ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</> : <><XCircle className="h-3 w-3 mr-1" /> Not Paid</>}
                      </Button>
                    </div>
                    <div>
                      <Label>Monthly Fee (₹)</Label>
                      <Input 
                        type="number"
                        value={modalMonthlyFee}
                        onChange={(e) => setModalMonthlyFee(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Royalty Model</Label>
                      <select 
                        value={modalRoyaltyType}
                        onChange={(e) => setModalRoyaltyType(e.target.value)}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary animate-none"
                      >
                        <option value="per_lead">Flat Fee Per Lead</option>
                        <option value="percentage">Percentage of Revenue</option>
                      </select>
                    </div>
                    {modalRoyaltyType === "percentage" ? (
                      <div>
                        <Label>Royalty Percentage (%)</Label>
                        <Input 
                          type="number"
                          step="0.1"
                          value={modalRoyaltyPercentage}
                          onChange={(e) => setModalRoyaltyPercentage(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div>
                        <Label>Royalty Per Lead (₹)</Label>
                        <Input 
                          type="number"
                          value={modalRoyaltyPerLead}
                          onChange={(e) => setModalRoyaltyPerLead(e.target.value)}
                        />
                      </div>
                    )}
                    <div>
                      <Label>Royalty GST Rate (%)</Label>
                      <Input 
                        type="number"
                        step="0.1"
                        value={modalGstRate}
                        onChange={(e) => setModalGstRate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>GST Number</Label>
                      <Input 
                        type="text"
                        placeholder="e.g. 24ABCDE1234F1Z5"
                        value={modalGstNumber}
                        onChange={(e) => setModalGstNumber(e.target.value.toUpperCase())}
                      />
                    </div>
                    <Button 
                      onClick={handleSaveModalConfig} 
                      disabled={isSavingModal}
                      className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isSavingModal ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                      Save Configuration
                    </Button>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* INTEGRATIONS TAB */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> API Integrations & Stored Keys</h3>
              <p className="text-xs text-muted-foreground mt-0.5">WhatsApp WABA, SMS, Google Analytics, Meta Pixel & Ads — per franchise company</p>
            </div>
          </div>

          {companies.map((company) => {
            const companyIntegrations = integrations.filter(i => i.company_id === company.id);
            const activeCount = companyIntegrations.filter(i => i.is_active).length;
            return (
              <Card key={company.id} className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{company.name}</CardTitle>
                        <p className="text-[10px] text-muted-foreground">{activeCount} of {Object.keys(serviceTypeLabels).length} integrations active</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {Object.entries(serviceTypeLabels).map(([serviceType, { label, icon: Icon }]) => {
                        const integration = companyIntegrations.find(i => i.service_type === serviceType);
                        return (
                          <div key={serviceType} title={label} className={`p-1.5 rounded-lg border text-[10px] flex items-center gap-1 ${integration?.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-muted/40 border-border/50 text-muted-foreground'}`}>
                            <Icon className="h-3 w-3" />
                            {integration?.is_active ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {Object.entries(serviceTypeLabels).map(([serviceType, { label, icon: Icon, fields }]) => {
                      const integration = companyIntegrations.find(i => i.service_type === serviceType);
                      const config = (integration?.config as Record<string, string>) || {};
                      const hasData = Object.values(config).some(v => v && String(v).trim());
                      return (
                        <div key={serviceType} className={`rounded-lg border p-3 transition-colors ${integration?.is_active ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-800/40 dark:bg-emerald-900/10' : 'border-border/40 bg-muted/20'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${integration?.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                              <span className="text-xs font-semibold">{label}</span>
                              {integration?.is_active 
                                ? <Badge className="text-[9px] py-0 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Active</Badge>
                                : <Badge variant="secondary" className="text-[9px] py-0 px-1.5">Not Configured</Badge>
                              }
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-2"
                              onClick={() => {
                                setEditingIntegration({ companyId: company.id, serviceType });
                                setIntegrationConfig(config);
                              }}
                            >
                              <Settings2 className="h-3 w-3 mr-1" />{hasData ? 'Edit' : 'Configure'}
                            </Button>
                          </div>
                          {hasData ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {fields.map(field => {
                                const val = config[field] || '';
                                if (!val) return null;
                                const isSecret = field.includes('token') || field.includes('key') || field.includes('secret');
                                const displayVal = isSecret && val.length > 8 
                                  ? val.substring(0, 6) + '••••••' + val.substring(val.length - 4)
                                  : val;
                                return (
                                  <div key={field} className="flex items-center gap-2 bg-background/60 rounded-md px-2 py-1.5 border border-border/40">
                                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider min-w-[80px] shrink-0">{field.replace(/_/g, ' ')}</span>
                                    <span className="text-[10px] font-mono text-foreground truncate">{displayVal}</span>
                                    {isSecret && (
                                      <button 
                                        className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                                        onClick={() => { navigator.clipboard.writeText(val); toast.success('Copied!'); }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground italic">No API keys stored. Click Configure to add credentials.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

        </TabsContent>

        {/* ROYALTIES TAB */}
        <TabsContent value="royalties" className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-end gap-4 bg-card p-4 rounded-xl border border-border">
            <div className="flex items-center gap-2 pb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter Royalties:</span>
            </div>
            
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Company</Label>
              <select 
                className="w-48 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary block"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="all">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Month</Label>
              <select 
                className="w-36 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary block"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <option value="all">All Months</option>
                {uniqueMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {(companyFilter !== "all" || monthFilter !== "all") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setCompanyFilter("all"); setMonthFilter("all"); }} 
                className="text-xs text-red-600 hover:text-red-700 h-9"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Monthly Summary Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                Monthly Royalty Summary
              </CardTitle>
              <CardDescription>Per-company monthly royalty overview — auto-generated on paid leads</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Royalty</TableHead>
                    <TableHead>Extra Fees</TableHead>
                    <TableHead>GST (rate%)</TableHead>
                    <TableHead className="font-bold">Total Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredMonthlySummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        No matching royalty invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMonthlySummary.map((row, idx) => {
                      const isPastDue = row.earliest_due_date && new Date(row.earliest_due_date) < new Date() && Number(row.pending) > 0;
                      const isCollected = Number(row.pending) === 0 && Number(row.collected) > 0;
                      const monthLabel = row.month_year ? new Date(row.month_year + '-02').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : row.month_year;
                      const platformFee  = row._platformFee  ?? 0;
                      const gstRate      = row._gstRate      ?? 18;
                      const gstAmt       = row._gstAmt       ?? 0;
                      const totalInvoice = row._totalInvoice ?? 0;
                      const extraCharges = Number(row.sms_charges ?? 0) + Number(row.whatsapp_charges ?? 0) + Number(row.other_charges ?? 0);
                      return (
                        <TableRow key={idx} className={`transition-colors hover:bg-muted/30 ${isPastDue ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}>
                          <TableCell className="font-mono text-[10px] font-semibold text-primary">
                            {row.invoice_number || `INV-${row.month_year?.replace('-', '')}`}
                          </TableCell>
                          <TableCell className="font-medium">{row.company_name}</TableCell>
                          <TableCell className="font-semibold">{monthLabel}</TableCell>
                          <TableCell className="text-center">{row.transaction_count}</TableCell>
                          <TableCell>₹{Number(platformFee).toLocaleString()}</TableCell>
                          <TableCell>₹{Number(row.total_royalty || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {extraCharges > 0 ? `₹${extraCharges.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-blue-600 dark:text-blue-400">
                            ₹{Number(gstAmt).toLocaleString()}
                            <span className="text-[9px] text-muted-foreground ml-1">({gstRate}%)</span>
                          </TableCell>
                          <TableCell className="font-bold text-foreground">
                            ₹{Number(totalInvoice).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {isCollected ? (
                              <Badge className="text-[9px] py-0 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Collected</Badge>
                            ) : isPastDue ? (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1.5">Overdue</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[9px] py-0 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.earliest_due_date ? new Date(row.earliest_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {Number(row.pending) > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => bulkCollectRoyalties(row.company_id, row.month_year)}
                                  className="h-6 text-[10px] px-2"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                  Collect
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  setEditingInvoice(row);
                                  setEditInvoiceStatus(row.status || 'pending');
                                  setEditSmsCharges(String(row.sms_charges ?? 0));
                                  setEditWhatsappCharges(String(row.whatsapp_charges ?? 0));
                                  setEditOtherCharges(String(row.other_charges ?? 0));
                                  setEditOtherChargesDescription(row.other_charges_description || "");
                                }}
                              >
                                <Pencil className="h-3 w-3 mr-0.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => downloadRoyaltyInvoice(row)}
                              >
                                <Download className="h-3 w-3 mr-0.5" />
                                PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Invoice Dialog */}
        <Dialog open={!!editingInvoice} onOpenChange={() => setEditingInvoice(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Invoice — {editingInvoice?.invoice_number || editingInvoice?.month_year}
              </DialogTitle>
            </DialogHeader>
            {editingInvoice && (() => {
              const dialogPlatformFee = Number(editingInvoice?._platformFee ?? 0);
              const dialogRoyaltyFee  = Number(editingInvoice?.total_royalty ?? 0);
              const dialogSmsCharges  = parseFloat(editSmsCharges) || 0;
              const dialogWaCharges   = parseFloat(editWhatsappCharges) || 0;
              const dialogOtherCharges = parseFloat(editOtherCharges) || 0;
              const dialogGstRate     = Number(editingInvoice?._gstRate ?? 18);
              
              const dialogSubtotal = dialogPlatformFee + dialogRoyaltyFee + dialogSmsCharges + dialogWaCharges + dialogOtherCharges;
              const dialogGstAmt   = Math.round(dialogSubtotal * (dialogGstRate / 100) * 100) / 100;
              const dialogTotal    = dialogSubtotal + dialogGstAmt;

              return (
                <div className="space-y-4">
                  <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1.5 border border-border/40">
                    <p><span className="text-muted-foreground font-medium">Company:</span> <strong>{editingInvoice.company_name}</strong></p>
                    <p><span className="text-muted-foreground font-medium">Month:</span> <strong>{editingInvoice.month_year ? new Date(editingInvoice.month_year + '-02').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : editingInvoice.month_year}</strong></p>
                    <p><span className="text-muted-foreground font-medium">Current Saved Total:</span> <strong>₹{Number(editingInvoice._totalInvoice || 0).toLocaleString()}</strong></p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold">SMS Charges (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        className="mt-1 h-8 text-xs"
                        value={editSmsCharges}
                        onChange={(e) => setEditSmsCharges(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold">WhatsApp Charges (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        className="mt-1 h-8 text-xs"
                        value={editWhatsappCharges}
                        onChange={(e) => setEditWhatsappCharges(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold">Other Charges (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        className="mt-1 h-8 text-xs"
                        value={editOtherCharges}
                        onChange={(e) => setEditOtherCharges(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold">Other Charges Desc</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Server Cost"
                        className="mt-1 h-8 text-xs"
                        value={editOtherChargesDescription}
                        onChange={(e) => setEditOtherChargesDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1.5 border border-border/40">
                    <Label className="font-semibold uppercase tracking-wider text-[9px] text-muted-foreground">Recalculation Preview</Label>
                    <div className="flex justify-between mt-1">
                      <span>Platform Subscription Fee:</span>
                      <span>₹{dialogPlatformFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Royalty Charges:</span>
                      <span>₹{dialogRoyaltyFee.toLocaleString()}</span>
                    </div>
                    {dialogSmsCharges > 0 && (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>SMS Charges:</span>
                        <span>+ ₹{dialogSmsCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {dialogWaCharges > 0 && (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>WhatsApp Charges:</span>
                        <span>+ ₹{dialogWaCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {dialogOtherCharges > 0 && (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>{editOtherChargesDescription || "Other Charges"}:</span>
                        <span>+ ₹{dialogOtherCharges.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border/40 pt-1.5 font-medium">
                      <span>Subtotal:</span>
                      <span>₹{dialogSubtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST ({dialogGstRate}%):</span>
                      <span>₹{dialogGstAmt.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-1.5 font-bold text-sm text-foreground">
                      <span>Recalculated Total:</span>
                      <span>₹{dialogTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Status</Label>
                    <div className="flex gap-2 mt-1.5">
                      {['pending', 'collected'].map(s => (
                        <button
                          key={s}
                          onClick={() => setEditInvoiceStatus(s)}
                          className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                            editInvoiceStatus === s
                              ? s === 'collected'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-amber-500 text-white border-amber-500'
                              : 'bg-background border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {s === 'collected' ? '✓ Collected' : '⏳ Pending'}
                        </button>
                      ))}
                    </div>
                  </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={saveInvoiceEdit}
                    disabled={isSavingInvoice}
                  >
                    {isSavingInvoice ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => downloadRoyaltyInvoice(editingInvoice)}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download PDF
                  </Button>
                </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>



        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Filters Bar */}
          <div className="flex flex-wrap items-end gap-4 bg-card p-4 rounded-xl border border-border animate-none">
            <div className="flex items-center gap-2 pb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter Analytics:</span>
            </div>
            
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Month</Label>
              <select 
                className="w-36 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary block animate-none"
                value={analyticsMonthFilter}
                onChange={(e) => setAnalyticsMonthFilter(e.target.value)}
              >
                <option value="all">All Months</option>
                {uniqueMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {analyticsMonthFilter !== "all" && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setAnalyticsMonthFilter("all")} 
                className="text-xs text-red-600 hover:text-red-700 h-9"
              >
                Clear Filter
              </Button>
            )}
          </div>

          {/* Analytics Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border border-slate-200/80 dark:border-slate-800/80 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Franchises</CardTitle>
                <Building2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companies.filter(c => c.is_active).length}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Total registered partners in database</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/80 dark:border-slate-800/80 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {analyticsMonthFilter === "all" ? "Monthly Recurring Revenue (MRR)" : "Platform Fees (This Month)"}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{(() => {
                    if (analyticsMonthFilter === "all") {
                      return companies.reduce((sum, c) => sum + (c.monthly_fee || 0), 0).toLocaleString('en-IN');
                    } else {
                      const totalBilled = monthlySummary
                        .filter((r: any) => r.month_year === analyticsMonthFilter)
                        .reduce((sum, r) => sum + Number(r.monthly_fee || r._platformFee || 0), 0);
                      return totalBilled.toLocaleString('en-IN');
                    }
                  })()}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {analyticsMonthFilter === "all" ? "Expected platform subscription income" : `Billed subscription fee for ${analyticsMonthFilter}`}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/80 dark:border-slate-800/80 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Royalties Accrued</CardTitle>
                <IndianRupee className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{companies.reduce((sum, c) => sum + (c.collected_royalty || 0) + (c.pending_royalty || 0), 0).toLocaleString('en-IN')}
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
                  <span>Paid: ₹{companies.reduce((sum, c) => sum + (c.collected_royalty || 0), 0).toLocaleString('en-IN')}</span>
                  <span>•</span>
                  <span className="font-medium text-amber-600">Due: ₹{companies.reduce((sum, c) => sum + (c.pending_royalty || 0), 0).toLocaleString('en-IN')}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/80 dark:border-slate-800/80 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Network Lead Traffic</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {companies.reduce((sum, c) => sum + (c.lead_count || 0), 0).toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Conversions: {companies.reduce((sum, c) => sum + (c.paid_lead_count || 0), 0).toLocaleString('en-IN')} (
                  {companies.reduce((sum, c) => sum + (c.lead_count || 0), 0) > 0 
                    ? (companies.reduce((sum, c) => sum + (c.paid_lead_count || 0), 0) / companies.reduce((sum, c) => sum + (c.lead_count || 0), 0) * 100).toFixed(1)
                    : "0.0"}%)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Franchise Performance Table */}
          <Card className="border border-slate-200/80 dark:border-slate-800/80">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Franchise Leaderboard</CardTitle>
              <CardDescription>Detailed conversion rates, MRR contributions, and royalty status per franchise partner</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Franchise Partner</TableHead>
                    <TableHead className="text-center">Total Leads</TableHead>
                    <TableHead className="text-center">Conversions</TableHead>
                    <TableHead>Conversion Rate</TableHead>
                    <TableHead className="text-right">Monthly Fee</TableHead>
                    <TableHead className="text-right">Royalties Accrued</TableHead>
                    <TableHead className="text-right">Royalties Due</TableHead>
                    <TableHead className="text-center">Setup Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No franchise partner companies found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    companies.map((c) => {
                      const conversionRate = c.lead_count && c.lead_count > 0 
                        ? (c.paid_lead_count || 0) / c.lead_count * 100 
                        : 0;
                      
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleOpenFranchiseDetails(c)}>
                          <TableCell className="font-semibold">
                            <div>
                              <p className="text-sm">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">/{c.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">{c.lead_count || 0}</TableCell>
                          <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">{c.paid_lead_count || 0}</TableCell>
                          <TableCell className="w-[180px]">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium">{conversionRate.toFixed(1)}%</span>
                              </div>
                              <Progress value={conversionRate} className="h-1.5 bg-slate-100 dark:bg-slate-800 animate-pulse-slow" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">₹{(c.monthly_fee || 0).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-800 dark:text-slate-200">
                            ₹{((c.collected_royalty || 0) + (c.pending_royalty || 0)).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-amber-600 dark:text-amber-500">
                            ₹{(c.pending_royalty || 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={c.setup_fee_paid ? "default" : "secondary"}
                              className={
                                c.setup_fee_paid 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none font-medium" 
                                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-none font-medium"
                              }
                            >
                              {c.setup_fee_paid ? 'Paid' : `Unpaid (₹${(c.setup_fee || 0).toLocaleString('en-IN')})`}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Share Breakdown Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lead Share */}
            <Card className="border border-slate-200/80 dark:border-slate-800/80">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Lead Share Distribution</CardTitle>
                <CardDescription>Traffic share percentage contributed by each franchise partner</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const totalLeads = companies.reduce((sum, c) => sum + (c.lead_count || 0), 0);
                  if (totalLeads === 0) {
                    return <p className="text-sm text-center text-muted-foreground py-8">No leads in the network yet.</p>;
                  }
                  return companies.map((c) => {
                    const pct = totalLeads > 0 ? ((c.lead_count || 0) / totalLeads * 100) : 0;
                    return (
                      <div key={c.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-350">{c.name}</span>
                          <span className="text-muted-foreground font-medium">{pct.toFixed(1)}% ({c.lead_count} leads)</span>
                        </div>
                        <Progress value={pct} className="h-2 bg-slate-100 dark:bg-slate-800" />
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>

            {/* Royalty Contribution Share */}
            <Card className="border border-slate-200/80 dark:border-slate-800/80">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Royalty Contribution Share</CardTitle>
                <CardDescription>Accrued royalty revenue share contribution per franchise</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const totalRoyalties = companies.reduce((sum, c) => sum + (c.collected_royalty || 0) + (c.pending_royalty || 0), 0);
                  if (totalRoyalties === 0) {
                    return <p className="text-sm text-center text-muted-foreground py-8">No royalty transactions recorded yet.</p>;
                  }
                  return companies.map((c) => {
                    const cRoyalty = (c.collected_royalty || 0) + (c.pending_royalty || 0);
                    const pct = totalRoyalties > 0 ? (cRoyalty / totalRoyalties * 100) : 0;
                    return (
                      <div key={c.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-350">{c.name}</span>
                          <span className="text-muted-foreground font-medium">{pct.toFixed(1)}% (₹{cRoyalty.toLocaleString()})</span>
                        </div>
                        <Progress value={pct} className="h-2 bg-slate-100 dark:bg-slate-800" />
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Franchise Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-3xl w-full overflow-y-auto h-full">
          {detailCompany && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white" 
                    style={{ backgroundColor: detailCompany.primary_color || '#1e3a5f' }}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <SheetTitle className="text-xl font-bold">{detailCompany.name}</SheetTitle>
                    <SheetDescription className="text-xs font-mono">ID: {detailCompany.id}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="mt-6">
                <TabsList className="grid grid-cols-6 w-full bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl overflow-x-auto">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="financials" className="text-xs">Financials</TabsTrigger>
                  <TabsTrigger value="leads" className="text-xs">Leads Funnel</TabsTrigger>
                  <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
                  <TabsTrigger value="api" className="text-xs">API Connect</TabsTrigger>
                  <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border border-slate-100 dark:border-slate-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Branding & Identity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-xs">
                        <div className="space-y-1">
                          <Label className="text-xs">Company Name</Label>
                          <Input 
                            type="text" 
                            value={editCompanyName} 
                            onChange={(e) => setEditCompanyName(e.target.value)} 
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">URL Slug</Label>
                          <Input 
                            type="text" 
                            value={editCompanySlug} 
                            onChange={(e) => setEditCompanySlug(e.target.value)} 
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Custom Domain</Label>
                          <Input 
                            type="text" 
                            value={editCustomDomain} 
                            onChange={(e) => setEditCustomDomain(e.target.value)} 
                            className="h-8 text-xs"
                            placeholder="finance.domain.com"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Primary Color</Label>
                            <div className="flex gap-2">
                              <Input 
                                type="color" 
                                value={editPrimaryColor} 
                                onChange={(e) => setEditPrimaryColor(e.target.value)} 
                                className="w-8 h-8 p-0 border-none rounded"
                              />
                              <Input 
                                type="text" 
                                value={editPrimaryColor} 
                                onChange={(e) => setEditPrimaryColor(e.target.value)} 
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Secondary Color</Label>
                            <div className="flex gap-2">
                              <Input 
                                type="color" 
                                value={editSecondaryColor} 
                                onChange={(e) => setEditSecondaryColor(e.target.value)} 
                                className="w-8 h-8 p-0 border-none rounded"
                              />
                              <Input 
                                type="text" 
                                value={editSecondaryColor} 
                                onChange={(e) => setEditSecondaryColor(e.target.value)} 
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Logo URL</Label>
                          <Input 
                            type="text" 
                            value={editLogoUrl} 
                            onChange={(e) => setEditLogoUrl(e.target.value)} 
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="flex justify-between py-1">
                          <span className="text-muted-foreground pt-1">Cloudflare SSL:</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {domainStatuses[detailCompany.id] || "Pending Setup / Not checked"}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <Button 
                            size="sm" 
                            onClick={handleSaveBranding} 
                            disabled={isSavingBranding}
                            className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            {isSavingBranding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Save Branding
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-100 dark:border-slate-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Pricing & Billing Terms</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Setup Fee (₹)</Label>
                            <Input 
                              type="number" 
                              value={editSetupFee} 
                              onChange={(e) => setEditSetupFee(e.target.value)} 
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Monthly Fee (₹)</Label>
                            <Input 
                              type="number" 
                              value={editMonthlyFee} 
                              onChange={(e) => setEditMonthlyFee(e.target.value)} 
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Royalty Model</Label>
                            <select 
                              value={editRoyaltyType} 
                              onChange={(e) => setEditRoyaltyType(e.target.value)} 
                              className="w-full h-8 px-2 py-1 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="per_lead">Flat Fee Per Lead</option>
                              <option value="percentage">Percentage of Revenue</option>
                            </select>
                          </div>
                          
                          {editRoyaltyType === 'percentage' ? (
                            <div className="space-y-1">
                              <Label className="text-xs">Royalty Percentage (%)</Label>
                              <Input 
                                type="number" 
                                step="0.1"
                                value={editRoyaltyPercentage} 
                                onChange={(e) => setEditRoyaltyPercentage(e.target.value)} 
                                className="h-8 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Label className="text-xs">Royalty / Paid Lead (₹)</Label>
                              <Input 
                                type="number" 
                                value={editRoyaltyPerLead} 
                                onChange={(e) => setEditRoyaltyPerLead(e.target.value)} 
                                className="h-8 text-xs"
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">GST Rate (%)</Label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={editGstRate} 
                              onChange={(e) => setEditGstRate(e.target.value)} 
                              className="h-8 text-xs animate-none"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2 pt-5">
                            <input 
                              type="checkbox" 
                              id="setup-fee-checkbox"
                              checked={editSetupFeePaid}
                              onChange={(e) => setEditSetupFeePaid(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-700 h-4 w-4 text-primary animate-none"
                            />
                            <Label htmlFor="setup-fee-checkbox" className="text-xs cursor-pointer">Setup Paid</Label>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">GST Number</Label>
                          <Input 
                            type="text"
                            placeholder="Enter Franchise GSTIN"
                            value={editGstNumber}
                            onChange={(e) => setEditGstNumber(e.target.value.toUpperCase())}
                            className="h-8 text-xs animate-none"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              id="active-checkbox"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-700 h-4 w-4 text-primary"
                            />
                            <Label htmlFor="active-checkbox" className="text-xs cursor-pointer font-semibold">Active Franchise</Label>
                          </div>
                          
                          <Button 
                            size="sm" 
                            onClick={handleSavePricingTerms} 
                            disabled={isSavingTerms}
                            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isSavingTerms ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Terms"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* FINANCIALS TAB */}
                <TabsContent value="financials" className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setup Fee Status</p>
                      <p className="text-lg font-bold mt-2 text-slate-800 dark:text-slate-200">
                        {detailCompany.setup_fee_paid ? "Paid" : `Due: ₹${(detailCompany.setup_fee || 0).toLocaleString()}`}
                      </p>
                    </Card>
                    <Card className="p-4 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Fee (MRR)</p>
                      <p className="text-lg font-bold mt-2 text-slate-800 dark:text-slate-200">
                        ₹{(detailCompany.monthly_fee || 0).toLocaleString()}/mo
                      </p>
                    </Card>
                    <Card className="p-4 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accrued Royalties</p>
                      <p className="text-lg font-bold mt-2 text-amber-600 dark:text-amber-500">
                        ₹{((detailCompany.collected_royalty || 0) + (detailCompany.pending_royalty || 0)).toLocaleString()}
                      </p>
                    </Card>
                  </div>

                  <Card className="border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Royalty Transactions & Invoices</CardTitle>
                      <CardDescription className="text-xs">Collected and pending royalties generated by converted leads</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Month</TableHead>
                            <TableHead>Platform Fee</TableHead>
                            <TableHead>Royalty Fee</TableHead>
                            <TableHead>GST</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {royalties.filter(r => r.company_id === detailCompany.id).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                                No monthly invoices recorded for this franchise.
                              </TableCell>
                            </TableRow>
                          ) : (
                            royalties.filter(r => r.company_id === detailCompany.id).slice(0, 10).map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-mono text-[10px]">{r.invoice_number || "INV-GEN"}</TableCell>
                                <TableCell>{r.month_year ? new Date(r.month_year + "-02").toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : "N/A"}</TableCell>
                                <TableCell>₹{(r.monthly_fee || 0).toLocaleString()}</TableCell>
                                <TableCell>₹{(r.royalty_amount || 0).toLocaleString()}</TableCell>
                                <TableCell>₹{(r.gst_amount || 0).toLocaleString()}</TableCell>
                                <TableCell className="font-semibold">₹{(r.total_amount || 0).toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={r.status === 'collected' ? 'default' : 'secondary'} 
                                    className="text-[9px] py-0 px-1.5"
                                  >
                                    {r.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {r.status === 'pending' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="h-6 text-[10px] px-2"
                                      onClick={() => markRoyaltyCollected(r.id)}
                                    >
                                      Collect
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* LEADS TAB */}
                <TabsContent value="leads" className="space-y-6 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Leads</p>
                      <p className="text-xl font-bold mt-1">{detailCompany.lead_count || 0}</p>
                    </Card>
                    <Card className="p-4 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conversions</p>
                      <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-500">{detailCompany.paid_lead_count || 0}</p>
                    </Card>
                    <Card className="p-4 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conversion Rate</p>
                      <p className="text-xl font-bold mt-1">
                        {detailCompany.lead_count && detailCompany.lead_count > 0 
                          ? ((detailCompany.paid_lead_count || 0) / detailCompany.lead_count * 100).toFixed(1)
                          : "0.0"}%
                      </p>
                    </Card>
                    <Card className="p-4 border border-slate-100 dark:border-slate-800 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Value</p>
                      <p className="text-xl font-bold mt-1 text-primary">₹{(detailCompany.total_revenue || 0).toLocaleString()}</p>
                    </Card>
                  </div>

                  <Card className="border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Funnel Status Breakdown</CardTitle>
                      <CardDescription className="text-xs">Active leads count distributed by pipeline stages</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.keys(franchiseLeadFunnel).length === 0 ? (
                        <p className="text-xs text-center text-muted-foreground py-6">No leads records in funnel.</p>
                      ) : (
                        Object.entries(franchiseLeadFunnel).map(([status, count]) => {
                          const maxCount = Math.max(...Object.values(franchiseLeadFunnel), 1);
                          const percentage = (count / maxCount) * 100;
                          return (
                            <div key={status} className="space-y-1">
                              <div className="flex items-center justify-between text-xs capitalize">
                                <span className="font-semibold text-slate-700 dark:text-slate-350">{status.replace(/_/g, " ")}</span>
                                <span className="text-muted-foreground font-medium">{count} leads</span>
                              </div>
                              <Progress value={percentage} className="h-1.5 bg-slate-100 dark:bg-slate-800" />
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* INTEGRATIONS TAB */}
                <TabsContent value="integrations" className="space-y-6 pt-4">
                  <div className="space-y-4">
                    {Object.entries(serviceTypeLabels).map(([service, { label }]) => {
                      const integration = integrations.find(i => i.company_id === detailCompany.id && i.service_type === service);
                      return (
                        <Card key={service} className="border border-slate-100 dark:border-slate-800">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-semibold uppercase tracking-wider">{label}</CardTitle>
                              <CardDescription className="text-xs">Integration API key and settings</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={integration?.is_active ? "default" : "secondary"} className="text-[9px]">
                                {integration?.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2"
                                onClick={() => {
                                  setEditingIntegration({ companyId: detailCompany.id, serviceType: service });
                                  setIntegrationConfig(integration?.config as Record<string, string> || {});
                                }}
                              >
                                <Settings2 className="h-3 w-3 mr-1" />
                                Configure
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="text-xs space-y-1 font-mono bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg mx-6 mb-4">
                            {integration?.config && Object.keys(integration.config).length > 0 ? (
                              Object.entries(integration.config).map(([k, v]) => (
                                <div key={k} className="flex justify-between py-0.5">
                                  <span className="text-muted-foreground">{k.replace(/_/g, ' ')}:</span>
                                  <span className="truncate max-w-sm text-right font-medium">
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v).replace(/.(?=.{4})/g, "*")}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-muted-foreground italic text-center py-2">No configurations active. Using system defaults.</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* API INTEGRATION TAB */}
                <TabsContent value="api" className="space-y-6 pt-4">
                  <Card className="border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">Lead Collection API</CardTitle>
                        <CardDescription className="text-xs">Connect external landing pages (e.g., external Lovable projects, WordPress) directly to this franchise.</CardDescription>
                      </div>
                      <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-none text-[10px]">
                        Active
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs">
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-lg text-amber-800 dark:text-amber-400">
                        <p className="font-semibold mb-1">How it works:</p>
                        <p>Any POST request sent to the endpoint below with <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">"company_slug": "{detailCompany.slug}"</code> in the JSON body will automatically create a lead for this specific franchise.</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold text-slate-700 dark:text-slate-300">API Endpoint</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800">POST</Badge>
                          <code className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-2 rounded text-[11px] select-all">
                            https://uzfccftfizleiyqzqoki.supabase.co/functions/v1/collect-lead
                          </code>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold text-slate-700 dark:text-slate-300">Example Javascript / Fetch Code</Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-[10px]"
                            onClick={() => {
                              const code = `fetch("https://uzfccftfizleiyqzqoki.supabase.co/functions/v1/collect-lead", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    company_slug: "${detailCompany.slug}",\n    full_name: "John Doe",\n    email: "john@example.com",\n    phone: "9876543210",\n    city: "Mumbai",\n    state: "Maharashtra",\n    loan_type: "personal", // home, business, personal, education, vehicle, gold, marriage\n    loan_amount: "500000",\n    employment_type: "salaried", // salaried, self_employed, business_owner\n    monthly_income: "50000",\n    cibil_score: "750-plus", // below-550, 550-600, 600-650, 650-700, 700-750, 750-plus, no-cibil\n    current_monthly_emi: "12000" // Optional, default is 0\n  })\n});`;
                              navigator.clipboard.writeText(code);
                              toast.success("API snippet copied!");
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy Snippet
                          </Button>
                        </div>
                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed">
{`fetch("https://uzfccftfizleiyqzqoki.supabase.co/functions/v1/collect-lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    // IMPORTANT: This routes the lead to this exact franchise
    company_slug: "${detailCompany.slug}", 
    
    full_name: "John Doe",
    email: "john@example.com",
    phone: "9876543210",
    city: "Mumbai",
    state: "Maharashtra",
    
    // Dropdowns
    loan_type: "personal", // home, business, personal, education, vehicle, gold, marriage
    loan_amount: "500000",
    employment_type: "salaried", // salaried, self_employed, business_owner
    monthly_income: "50000",
    
    // Additional Profile details
    cibil_score: "750-plus", // below-550, 550-600, 600-650, 650-700, 700-750, 750-plus, no-cibil
    current_monthly_emi: "12000" // Optional, defaults to 0
  })
});`}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TEAM TAB */}
                <TabsContent value="team" className="space-y-6 pt-4">
                  <Card className="border border-slate-100 dark:border-slate-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Franchise Staff & Team Members</CardTitle>
                      <CardDescription className="text-xs">Active operators, managers, telecallers, and verification staff assigned to this franchise</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead>Operator Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Roles</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {franchiseStaff.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                                No staff members assigned to this franchise.
                              </TableCell>
                            </TableRow>
                          ) : (
                            franchiseStaff.map((staff) => (
                              <TableRow key={staff.user_id}>
                                <TableCell className="font-semibold">{staff.full_name}</TableCell>
                                <TableCell>{staff.email}</TableCell>
                                <TableCell>{staff.phone || "-"}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {staff.roles?.map((r: string) => (
                                      <Badge key={r} variant="secondary" className="text-[9px] py-0 px-1.5 capitalize bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350">
                                        {r.replace(/_/g, " ")}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Integration Config Dialog (Moved to Root wrapper so it works inside Sheets) */}
      <Dialog open={!!editingIntegration} onOpenChange={() => { setEditingIntegration(null); setIntegrationConfig({}); }}>
        <DialogContent className="z-[100] max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Configure {editingIntegration ? serviceTypeLabels[editingIntegration.serviceType]?.label : ""}
            </DialogTitle>
          </DialogHeader>
          {editingIntegration && (
            <div className="space-y-4 pt-2">
              {(serviceTypeLabels[editingIntegration.serviceType]?.fields || []).map((field) => (
                <div key={field}>
                  <Label className="capitalize text-xs">{field.replace(/_/g, " ")}</Label>
                  <Input
                    value={integrationConfig[field] || ""}
                    onChange={(e) => setIntegrationConfig(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={`Enter ${field.replace(/_/g, " ")}`}
                    type={field.includes('token') || field.includes('key') ? 'password' : 'text'}
                    className="font-mono text-sm mt-1"
                  />
                </div>
              ))}
              
              {editingIntegration.serviceType === 'sms' && (
                <div className="space-y-3 pt-3 border-t">
                  <Label className="text-xs font-semibold text-primary">DLT Template IDs</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["payment_success", "welcome", "telecaller", "remarketing", "payment_failed", "rejected"].map((tplKey) => {
                      const dltTemplates = (integrationConfig.dlt_template_ids as any) || {};
                      return (
                        <div key={tplKey} className="space-y-1">
                          <Label className="capitalize text-[10px]">{tplKey.replace(/_/g, " ")}</Label>
                          <Input
                            value={dltTemplates[tplKey] || ""}
                            onChange={(e) => {
                              const updatedTemplates = { ...dltTemplates, [tplKey]: e.target.value };
                              setIntegrationConfig(prev => ({ ...prev, dlt_template_ids: updatedTemplates }));
                            }}
                            placeholder="Template ID"
                            className="text-xs font-mono"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button onClick={saveIntegration} className="w-full">Save Integration</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyPanel;
