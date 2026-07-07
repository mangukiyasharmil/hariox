import { useState, useEffect } from "react";
import { IndianRupee, DollarSign, Plus, TrendingUp, TrendingDown, Calendar, FileText, Edit2, Trash2, Download, Receipt, FileSpreadsheet } from "lucide-react";
import GSTReturnsSection from "./GSTReturnsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import PasswordConfirmDialog from "./PasswordConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountingEntry {
  id: string;
  entry_type: "income" | "expense";
  category: string;
  amount: number;
  description: string | null;
  entry_date: string;
  created_at: string;
  lead_id: string | null;
  gst_included?: boolean;
  gst_rate?: number;
  lead?: { full_name: string; phone: string } | null;
  customer_name?: string;
  customer_phone?: string;
}

interface GSTInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  invoice_date: string;
  status: string;
  lead_id: string | null;
  lead?: { application_id: string | null } | null;
}

const categories = {
  income: ["Consulting Fee", "Commission", "Referral Bonus", "Other Income"],
  expense: ["Salary", "Office Rent", "Marketing Meta", "Ads", "Outside", "WhatsApp Meta", "SMS Charges", "PG Charges", "Software", "Utilities", "Travel", "Commission Payout", "Other Expense"],
};

const gstRates = [0, 5, 12, 18, 28];

// IST is UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Format a Date into an IST calendar date string: YYYY-MM-DD
const formatISTDate = (d: Date): string => {
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getISTDateNDaysAgo = (base: Date, daysAgo: number): string => {
  const pastDate = new Date(base.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return formatISTDate(pastDate);
};

const AccountingModule = () => {
  const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [invoices, setInvoices] = useState<GSTInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "month" | "all">("month");
  // Currency display toggle: INR (₹) or USD ($)
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  // Transaction type and category filters
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  // P&L Report specific date filter
  const [plDateFilter, setPlDateFilter] = useState<"today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom">("month");
  const [plCustomStart, setPlCustomStart] = useState("");
  const [plCustomEnd, setPlCustomEnd] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const [formData, setFormData] = useState({
    entry_type: "expense" as "income" | "expense",
    category: "",
    amount: "",
    entry_date: formatISTDate(new Date()),
    gst_included: true, // Default to GST inclusive
    gst_rate: "18",
  });
  
  // Multi-amount entries for Marketing Meta
  const [metaAmounts, setMetaAmounts] = useState<string[]>([""]);
  
  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<AccountingEntry | null>(null);

  useEffect(() => {
    fetchData();
  }, [dateFilter, currentCompany?.id, showAllCompanies]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch accounting entries with company filter and lead info
      let entryQuery = supabase.from("accounting_entries").select("*, lead:leads(full_name, phone)").order("entry_date", { ascending: false });
      
      // Apply company filter for entries — include NULL company entries (shared expenses like Marketing Meta)
      const companyId = getCompanyFilter();
      if (companyId) {
        entryQuery = entryQuery.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const now = new Date();
      const todayStr = formatISTDate(now);
      
      if (dateFilter === "today") {
        entryQuery = entryQuery.eq("entry_date", todayStr);
      } else if (dateFilter === "yesterday") {
        const yesterdayStr = getISTDateNDaysAgo(now, 1);
        entryQuery = entryQuery.eq("entry_date", yesterdayStr);
      } else if (dateFilter === "week") {
        entryQuery = entryQuery.gte("entry_date", getISTDateNDaysAgo(now, 7));
      } else if (dateFilter === "month") {
        entryQuery = entryQuery.gte("entry_date", getISTDateNDaysAgo(now, 30));
      }

      const { data: entryData } = await entryQuery;
      
      // Auto-fetch paid payments as income with company filter
      // Use lead's company_id as fallback when payment's company_id is null
      let paymentQuery = supabase
        .from("payments")
        .select(`
          id, 
          lead_id, 
          total_amount, 
          payment_date, 
          created_at,
          collected_by, 
          company_id,
          leads!inner(company_id, full_name, phone)
        `)
        .in("status", ["completed", "captured"])
        .order("created_at", { ascending: false });

      const { data: allPayments } = await paymentQuery;
      
      // Apply company filter manually to handle both payment.company_id and lead.company_id
      let filteredPayments = allPayments || [];
      
      if (companyId) {
        filteredPayments = filteredPayments.filter(p => {
          const paymentCompanyId = p.company_id;
          const leadCompanyId = (p.leads as any)?.company_id;
          // Match if either payment or lead belongs to the company
          return paymentCompanyId === companyId || leadCompanyId === companyId;
        });
      }

      // Apply date filter using IST date comparison to prevent timezone issues
      if (dateFilter !== "all") {
        const nowForFilter = new Date();

        const todayStr = formatISTDate(nowForFilter);
        const yesterdayStr = getISTDateNDaysAgo(nowForFilter, 1);
        const weekAgoStr = getISTDateNDaysAgo(nowForFilter, 7);
        const monthAgoStr = getISTDateNDaysAgo(nowForFilter, 30);
        
        filteredPayments = filteredPayments.filter(p => {
          // payment_date is often null for online payments; created_at is always present.
          const paymentTs: string | null = (p.payment_date as any) || (p.created_at as any) || null;
          if (!paymentTs) return false;

          const paymentDateStr = formatISTDate(new Date(paymentTs));
          
          if (dateFilter === "today") {
            return paymentDateStr === todayStr;
          } else if (dateFilter === "yesterday") {
            return paymentDateStr === yesterdayStr;
          } else if (dateFilter === "week") {
            return paymentDateStr >= weekAgoStr;
          } else {
            return paymentDateStr >= monthAgoStr;
          }
        });
      }

      const payments = filteredPayments;

      // Convert payments to income entries (for display) with customer info
      const paymentEntries: AccountingEntry[] = (payments || []).map(p => {
        const leadInfo = p.leads as any;

        const paymentTs: string = (p.payment_date as any) || (p.created_at as any) || new Date().toISOString();
        const entryDate = formatISTDate(new Date(paymentTs));
        return {
          id: `payment_${p.id}`,
          entry_type: "income" as const,
          category: "Consulting Fee",
          amount: p.total_amount,
          description: `Payment received${p.collected_by ? ' (Telecaller)' : ' (Direct)'}`,
          // Keep entry_date consistent with accounting_entries.entry_date (YYYY-MM-DD in IST)
          entry_date: entryDate,
          // Keep created_at as the actual payment timestamp for debugging/auditing
          created_at: (p.created_at as any) || paymentTs,
          lead_id: p.lead_id,
          gst_included: true,
          gst_rate: 18,
          customer_name: leadInfo?.full_name || null,
          customer_phone: leadInfo?.phone || null,
        };
      });

      // Merge manual entries with auto-fetched payment income
      const allEntries = [...(entryData as AccountingEntry[] || []), ...paymentEntries];
      allEntries.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
      setEntries(allEntries);

      // Fetch GST invoices with lead application_id and company filter
      let invoiceQuery = supabase
        .from("gst_invoices")
        .select("*, lead:leads(application_id, company_id)")
        .order("invoice_date", { ascending: false });
      
      // Apply company filter for invoices
      if (companyId) {
        invoiceQuery = invoiceQuery.eq("company_id", companyId);
      }
      
      const { data: invoiceData } = await invoiceQuery;
      setInvoices((invoiceData as GSTInvoice[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    // For Marketing Meta, use total of metaAmounts
    const isMarketingMeta = formData.category === "Marketing Meta";
    const totalAmount = isMarketingMeta 
      ? metaAmounts.reduce((sum, a) => sum + (Number(a) || 0), 0)
      : Number(formData.amount);
    
    if (!formData.category || totalAmount <= 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    
    // Get current company for the entry
    const companyId = getCompanyFilter();

    // Build description for Marketing Meta with multiple amounts
    const description = isMarketingMeta && metaAmounts.length > 1
      ? `FB Meta Ad Cost (${metaAmounts.filter(a => Number(a) > 0).map(a => `₹${a}`).join(' + ')})`
      : isMarketingMeta ? "FB Meta Ad Cost" : null;

    const entryData = {
      entry_type: formData.entry_type,
      category: formData.category,
      amount: totalAmount,
      description,
      entry_date: formData.entry_date,
      created_by: session?.user.id,
      gst_included: formData.gst_included,
      gst_rate: formData.gst_included ? Number(formData.gst_rate) : 0,
      company_id: companyId, // Save company context
    };

    let error;
    if (editingEntry) {
      // If it was a payment entry being edited, we create a new manual entry
      if (editingEntry.id.startsWith("payment_")) {
        ({ error } = await supabase.from("accounting_entries").insert(entryData));
      } else {
        ({ error } = await supabase.from("accounting_entries").update(entryData).eq("id", editingEntry.id));
      }
    } else {
      ({ error } = await supabase.from("accounting_entries").insert(entryData));
    }

    if (!error) {
      setIsModalOpen(false);
      setEditingEntry(null);
      setFormData({
        entry_type: "expense",
        category: "",
        amount: "",
        entry_date: formatISTDate(new Date()),
        gst_included: true, // Default to GST inclusive
        gst_rate: "18",
      });
      setMetaAmounts([""]);
      fetchData();
    }
  };

  const handleEdit = (entry: AccountingEntry) => {
    setEditingEntry(entry);
    setFormData({
      entry_type: entry.entry_type,
      category: entry.category,
      amount: String(entry.amount),
      entry_date: entry.entry_date.split("T")[0],
      gst_included: entry.gst_included || false,
      gst_rate: String(entry.gst_rate || 18),
    });
    // Reset meta amounts when editing
    setMetaAmounts([String(entry.amount)]);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (entry: AccountingEntry) => {
    if (entry.id.startsWith("payment_")) {
      toast.error("To delete this entry, delete the original payment record from the Payments section.");
      return;
    }
    setEntryToDelete(entry);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    
    const { error } = await supabase.from("accounting_entries").delete().eq("id", entryToDelete.id);
    if (error) {
      toast.error("Failed to delete entry");
    } else {
      toast.success("Entry deleted successfully");
      fetchData();
    }
    setEntryToDelete(null);
  };

  // Format a monetary amount with the active currency symbol
  // GST is always shown in INR (₹) regardless of this setting
  const formatAmt = (n: number, decimals = 0) => {
    if (currency === "USD") {
      return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}` ;
    }
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  // Calculate GST values
  const calculateGST = () => {
    const income = entries.filter(e => e.entry_type === "income");
    const expenses = entries.filter(e => e.entry_type === "expense");
    
    const outputGST = income
      .filter(e => e.gst_included)
      .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
    
    const inputGST = expenses
      .filter(e => e.gst_included)
      .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
    
    return { outputGST, inputGST, netGST: outputGST - inputGST };
  };

  const exportBalanceSheet = () => {
    const income = entries.filter(e => e.entry_type === "income");
    const expenses = entries.filter(e => e.entry_type === "expense");
    const totalIncome = income.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const gst = calculateGST();

    // Net Profit after GST Payable
    const netProfitAfterGST = totalIncome - totalExpense - gst.netGST;

    let csv = "Balance Sheet & P&L Summary Report\n\n";
    csv += "PROFIT & LOSS SUMMARY\n";
    csv += "Description,Amount\n";
    csv += `Total Revenue,${totalIncome.toLocaleString("en-IN")}\n`;
    csv += `Total Expenses,${totalExpense.toLocaleString("en-IN")}\n`;
    csv += `Gross Profit,${(totalIncome - totalExpense).toLocaleString("en-IN")}\n`;
    csv += `Output GST (Collected),${gst.outputGST.toFixed(2)}\n`;
    csv += `Input GST (Paid),${gst.inputGST.toFixed(2)}\n`;
    csv += `Net GST Payable,${gst.netGST.toFixed(2)}\n`;
    csv += `Net Profit (After GST),${netProfitAfterGST.toLocaleString("en-IN")}\n\n`;
    
    csv += "BALANCE SHEET SUMMARY\n";
    csv += "Description,Amount\n";
    csv += `Total Assets (Cash & Bank),${totalIncome.toLocaleString("en-IN")}\n`;
    csv += `GST Payable,${(gst.netGST >= 0 ? gst.netGST : 0).toFixed(2)}\n`;
    csv += `Net Worth,${(totalIncome - (gst.netGST >= 0 ? gst.netGST : 0)).toLocaleString("en-IN")}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance_sheet_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Export Balance Sheet & P&L as PDF
  const exportBalanceSheetPDF = () => {
    const income = entries.filter(e => e.entry_type === "income");
    const expenses = entries.filter(e => e.entry_type === "expense");
    const totalIncome = income.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const gst = calculateGST();
    const netProfitAfterGST = totalIncome - totalExpense - gst.netGST;
    
    const companyName = currentCompany?.name || 'HARIOX CORPORATE SERVICES PRIVATE LIMITED';
    const logoUrl = 'https://uzfccftfizleiyqzqoki.supabase.co/storage/v1/object/public/assets/hariox-logo.png';
    const reportDate = formatISTDate(new Date());
    
    // Category-wise breakdown
    const incomeByCategory = income.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    
    const expenseByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    
    const pdfHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Balance Sheet & P&L - ${reportDate}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; max-width: 900px; margin: auto; font-size: 12px; color: #333; }
            .header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #1e3a5f; }
            .header-logo { width: 60px; height: 60px; object-fit: contain; }
            .header-content h1 { font-size: 18px; color: #1e3a5f; }
            .header-content p { font-size: 11px; color: #666; }
            .report-title { text-align: center; font-size: 20px; font-weight: bold; color: #1e3a5f; margin: 20px 0; }
            .report-date { text-align: center; font-size: 12px; color: #666; margin-bottom: 30px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
            .section { background: #f9f9f9; border-radius: 8px; padding: 20px; }
            .section-title { font-size: 14px; font-weight: bold; color: #1e3a5f; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #1e3a5f; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .row:last-child { border-bottom: none; }
            .row.total { border-top: 2px solid #1e3a5f; border-bottom: none; margin-top: 10px; padding-top: 12px; font-weight: bold; }
            .row.highlight { background: #e8f5e9; margin: 0 -10px; padding: 10px; border-radius: 4px; }
            .label { color: #666; }
            .value { font-weight: 500; font-family: 'Courier New', monospace; }
            .value.green { color: #2e7d32; }
            .value.red { color: #c62828; }
            .value.orange { color: #ef6c00; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 30px; }
            .summary-card { background: linear-gradient(135deg, #1e3a5f 0%, #2e5a8f 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
            .summary-card .label { color: rgba(255,255,255,0.8); font-size: 11px; }
            .summary-card .value { font-size: 20px; font-weight: bold; margin-top: 5px; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; }
            @media print { body { padding: 15px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" alt="Logo" class="header-logo" onerror="this.style.display='none'" />
            <div class="header-content">
              <h1>${companyName}</h1>
              <p>Financial Statement</p>
            </div>
          </div>
          
          <div class="report-title">Balance Sheet & Profit & Loss Statement</div>
          <div class="report-date">Report Date: ${new Date(reportDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
          
          <div class="grid">
            <!-- P&L Section -->
            <div class="section">
              <div class="section-title">Profit & Loss Statement</div>
              
              <div style="margin-bottom: 15px;">
                <div style="font-weight: 500; color: #2e7d32; margin-bottom: 8px;">Revenue</div>
                ${Object.entries(incomeByCategory).map(([cat, amt]) => `
                  <div class="row">
                    <span class="label">${cat}</span>
                    <span class="value">₹${amt.toLocaleString("en-IN")}</span>
                  </div>
                `).join('')}
                <div class="row total">
                  <span>Total Revenue</span>
                  <span class="value green">₹${totalIncome.toLocaleString("en-IN")}</span>
                </div>
              </div>
              
              <div style="margin-bottom: 15px;">
                <div style="font-weight: 500; color: #c62828; margin-bottom: 8px;">Expenses</div>
                ${Object.entries(expenseByCategory).map(([cat, amt]) => `
                  <div class="row">
                    <span class="label">${cat}</span>
                    <span class="value">₹${amt.toLocaleString("en-IN")}</span>
                  </div>
                `).join('')}
                <div class="row total">
                  <span>Total Expenses</span>
                  <span class="value red">₹${totalExpense.toLocaleString("en-IN")}</span>
                </div>
              </div>
              
              <div class="row">
                <span class="label">Gross Profit</span>
                <span class="value ${(totalIncome - totalExpense) >= 0 ? 'green' : 'red'}">₹${(totalIncome - totalExpense).toLocaleString("en-IN")}</span>
              </div>
              <div class="row">
                <span class="label">Less: GST Payable</span>
                <span class="value orange">₹${(gst.netGST >= 0 ? gst.netGST : 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="row total highlight">
                <span>Net Profit (After GST)</span>
                <span class="value ${netProfitAfterGST >= 0 ? 'green' : 'red'}">₹${netProfitAfterGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <!-- Balance Sheet Section -->
            <div class="section">
              <div class="section-title">Balance Sheet</div>
              
              <div style="margin-bottom: 15px;">
                <div style="font-weight: 500; color: #1565c0; margin-bottom: 8px;">Assets</div>
                <div class="row">
                  <span class="label">Cash & Bank Balance</span>
                  <span class="value">₹${totalIncome.toLocaleString("en-IN")}</span>
                </div>
                <div class="row">
                  <span class="label">Accounts Receivable</span>
                  <span class="value">₹0</span>
                </div>
                <div class="row total">
                  <span>Total Assets</span>
                  <span class="value" style="color: #1565c0;">₹${totalIncome.toLocaleString("en-IN")}</span>
                </div>
              </div>
              
              <div style="margin-bottom: 15px;">
                <div style="font-weight: 500; color: #ef6c00; margin-bottom: 8px;">Liabilities</div>
                <div class="row">
                  <span class="label">GST Payable</span>
                  <span class="value">₹${(gst.netGST >= 0 ? gst.netGST : 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="row">
                  <span class="label">Other Liabilities</span>
                  <span class="value">₹0</span>
                </div>
                <div class="row total">
                  <span>Total Liabilities</span>
                  <span class="value orange">₹${(gst.netGST >= 0 ? gst.netGST : 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              
              <div class="row total highlight">
                <span>Net Worth</span>
                <span class="value green">₹${(totalIncome - (gst.netGST >= 0 ? gst.netGST : 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          
          <!-- Summary Cards -->
          <div class="summary-grid">
            <div class="summary-card">
              <div class="label">Total Revenue</div>
              <div class="value">₹${totalIncome.toLocaleString("en-IN")}</div>
            </div>
            <div class="summary-card">
              <div class="label">Total Expenses</div>
              <div class="value">₹${totalExpense.toLocaleString("en-IN")}</div>
            </div>
            <div class="summary-card" style="background: linear-gradient(135deg, #2e7d32 0%, #43a047 100%);">
              <div class="label">Net Profit</div>
              <div class="value">₹${netProfitAfterGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          
          <div class="footer">
            <p>Generated on ${new Date().toLocaleString("en-IN")} | This is a computer-generated document</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfHTML);
      printWindow.document.close();
      // Auto-trigger print dialog for PDF save
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  // Export filtered transactions with full details
  const exportTransactions = () => {
    // Apply current filters to entries
    const filtered = entries.filter(e => {
      if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      return true;
    });
    
    const income = filtered.filter(e => e.entry_type === "income");
    const expenses = filtered.filter(e => e.entry_type === "expense");
    const filteredTotalIncome = income.reduce((sum, e) => sum + Number(e.amount), 0);
    const filteredTotalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    const filteredOutputGST = income
      .filter(e => e.gst_included)
      .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
    const filteredInputGST = expenses
      .filter(e => e.gst_included)
      .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);

    let csv = "Transactions Report\n\n";
    csv += "INCOME TRANSACTIONS\n";
    csv += "Date,Category,Description,Customer,Phone,Amount,GST Included,GST Rate\n";
    income.forEach(e => {
      const customerName = e.customer_name || e.lead?.full_name || '-';
      const customerPhone = e.customer_phone || e.lead?.phone || '-';
      csv += `${new Date(e.entry_date + "T00:00:00").toLocaleDateString("en-IN")},${e.category},"${e.description || ''}",${customerName},${customerPhone},${e.amount},${e.gst_included ? 'Yes' : 'No'},${e.gst_rate || 0}%\n`;
    });
    csv += `\nTotal Income,,,,,,${filteredTotalIncome}\n`;
    csv += `Output GST,,,,,,${filteredOutputGST.toFixed(2)}\n\n`;
    
    csv += "EXPENSE TRANSACTIONS\n";
    csv += "Date,Category,Description,Customer,Phone,Amount,GST Included,GST Rate\n";
    expenses.forEach(e => {
      const customerName = e.customer_name || e.lead?.full_name || '-';
      const customerPhone = e.customer_phone || e.lead?.phone || '-';
      csv += `${new Date(e.entry_date + "T00:00:00").toLocaleDateString("en-IN")},${e.category},"${e.description || ''}",${customerName},${customerPhone},${e.amount},${e.gst_included ? 'Yes' : 'No'},${e.gst_rate || 0}%\n`;
    });
    csv += `\nTotal Expenses,,,,,,${filteredTotalExpense}\n`;
    csv += `Input GST,,,,,,${filteredInputGST.toFixed(2)}\n\n`;
    
    csv += `Net Profit/Loss,,,,,,${filteredTotalIncome - filteredTotalExpense}\n`;
    csv += `Net GST Payable,,,,,,${(filteredOutputGST - filteredInputGST).toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${formatISTDate(new Date())}.csv`;
    a.click();
  };

  // Helper to extract sequence number from invoice_number for proper sorting
  const getInvoiceSequence = (invoiceNumber: string): number => {
    const match = invoiceNumber.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const exportGSTR1 = () => {
    // GSTR-1: Outward supplies (sales) - sorted by invoice number sequence
    const salesInvoices = invoices
      .filter(i => i.status !== 'cancelled')
      .sort((a, b) => getInvoiceSequence(a.invoice_number) - getInvoiceSequence(b.invoice_number));
    let csv = "GSTR-1 Report - Outward Supplies\n\n";
    csv += "Invoice No.,Invoice Date,Customer Name,Customer Mobile,GSTIN,Taxable Value,CGST (9%),SGST (9%),Total GST,Total Value\n";
    
    salesInvoices.forEach(inv => {
      const cgst = Number(inv.gst_amount) / 2;
      const sgst = Number(inv.gst_amount) / 2;
      csv += `${inv.invoice_number},${new Date(inv.invoice_date).toLocaleDateString("en-IN")},${inv.customer_name},${inv.customer_phone},-,${Number(inv.amount).toFixed(2)},${cgst.toFixed(2)},${sgst.toFixed(2)},${Number(inv.gst_amount).toFixed(2)},${Number(inv.total_amount).toFixed(2)}\n`;
    });
    
    const totalTaxable = salesInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalGST = salesInvoices.reduce((sum, i) => sum + Number(i.gst_amount), 0);
    const totalCGST = totalGST / 2;
    const totalSGST = totalGST / 2;
    const totalValue = salesInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
    
    // Fixed: TOTAL row now has correct column alignment (10 columns)
    csv += `\nTOTAL,-,-,-,-,${totalTaxable.toFixed(2)},${totalCGST.toFixed(2)},${totalSGST.toFixed(2)},${totalGST.toFixed(2)},${totalValue.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const exportGSTR2 = () => {
    // GSTR-2: Inward supplies (purchases with GST)
    const purchases = entries.filter(e => e.entry_type === "expense" && e.gst_included);
    let csv = "GSTR-2 Report - Inward Supplies\n\n";
    csv += "Date,Category,Description,Taxable Value,GST Rate,CGST,SGST,Total GST,Total Value\n";
    
    purchases.forEach(e => {
      const rate = e.gst_rate || 18;
      const taxable = Number(e.amount) * 100 / (100 + rate);
      const gstAmt = Number(e.amount) - taxable;
      const cgst = gstAmt / 2;
      const sgst = gstAmt / 2;
      csv += `${new Date(e.entry_date).toLocaleDateString("en-IN")},${e.category},"${e.description || ''}",${taxable.toFixed(2)},${rate}%,${cgst.toFixed(2)},${sgst.toFixed(2)},${gstAmt.toFixed(2)},${Number(e.amount).toFixed(2)}\n`;
    });
    
    const totalAmount = purchases.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalGST = purchases.reduce((sum, e) => {
      const rate = e.gst_rate || 18;
      return sum + (Number(e.amount) * rate / (100 + rate));
    }, 0);
    const totalCGST = totalGST / 2;
    const totalSGST = totalGST / 2;
    const totalTaxable = totalAmount - totalGST;
    
    csv += `\nTOTAL,,,${totalTaxable.toFixed(2)},,${totalCGST.toFixed(2)},${totalSGST.toFixed(2)},${totalGST.toFixed(2)},${totalAmount.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR2_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const exportGSTR3B = () => {
    // GSTR-3B: Monthly summary
    const gst = calculateGST();
    const totalIncome = entries.filter(e => e.entry_type === "income").reduce((sum, e) => sum + Number(e.amount), 0);
    const totalExpense = entries.filter(e => e.entry_type === "expense").reduce((sum, e) => sum + Number(e.amount), 0);
    const outputCGST = gst.outputGST / 2;
    const outputSGST = gst.outputGST / 2;
    const inputCGST = gst.inputGST / 2;
    const inputSGST = gst.inputGST / 2;
    const netCGST = outputCGST - inputCGST;
    const netSGST = outputSGST - inputSGST;
    
    let csv = "GSTR-3B Summary Report\n\n";
    csv += "Section,Description,CGST,SGST,Total\n";
    csv += `3.1,Output Tax (Collected),${outputCGST.toFixed(2)},${outputSGST.toFixed(2)},${gst.outputGST.toFixed(2)}\n`;
    csv += `4,Input Tax Credit (Paid),${inputCGST.toFixed(2)},${inputSGST.toFixed(2)},${gst.inputGST.toFixed(2)}\n`;
    csv += `6.1,Net Tax Payable,${netCGST.toFixed(2)},${netSGST.toFixed(2)},${gst.netGST.toFixed(2)}\n\n`;
    csv += `Financial Summary\n`;
    csv += `Total Revenue,${totalIncome.toFixed(2)}\n`;
    csv += `Total Expenses,${totalExpense.toFixed(2)}\n`;
    csv += `Net Profit/Loss,${(totalIncome - totalExpense).toFixed(2)}\n`;
    csv += `GST Liability (CGST),${netCGST.toFixed(2)}\n`;
    csv += `GST Liability (SGST),${netSGST.toFixed(2)}\n`;
    csv += `Total GST Liability,${gst.netGST.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR3B_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const exportInvoicesCSV = () => {
    // Sort invoices by sequence number for proper order
    const sortedInvoices = [...invoices].sort((a, b) => getInvoiceSequence(a.invoice_number) - getInvoiceSequence(b.invoice_number));
    
    let csv = "GST Invoices Report\n\n";
    csv += "Invoice No.,Date,Customer Name,Email,Mobile,Base Amount,CGST (9%),SGST (9%),Total GST,Total Amount\n";
    
    sortedInvoices.forEach(inv => {
      const cgst = Number(inv.gst_amount) / 2;
      const sgst = Number(inv.gst_amount) / 2;
      csv += `${inv.invoice_number},${new Date(inv.invoice_date).toLocaleDateString("en-IN")},${inv.customer_name},${inv.customer_email},${inv.customer_phone},${Number(inv.amount).toFixed(2)},${cgst.toFixed(2)},${sgst.toFixed(2)},${Number(inv.gst_amount).toFixed(2)},${Number(inv.total_amount).toFixed(2)}\n`;
    });

    const totalBase = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalGST = invoices.reduce((sum, i) => sum + Number(i.gst_amount), 0);
    const totalCGST = totalGST / 2;
    const totalSGST = totalGST / 2;
    const totalAmount = invoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
    
    csv += `\nTOTAL,,,,,${totalBase.toFixed(2)},${totalCGST.toFixed(2)},${totalSGST.toFixed(2)},${totalGST.toFixed(2)},${totalAmount.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst_invoices_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const viewInvoice = (invoice: GSTInvoice) => {
    const cgst = Number(invoice.gst_amount) / 2;
    const sgst = Number(invoice.gst_amount) / 2;
    
    // Company details for invoice
    const companyName = currentCompany?.name || 'HARIOX CORPORATE SERVICES PRIVATE LIMITED';
    const companyAddress = currentCompany?.address || 'M-1304, River View Height, Pedar Road, Mota Varachha, Surat, Gujarat, India - 394101';
    const companyGST = '24AAGCF2801F1Z6';
    const companyPhone = currentCompany?.phone || '+91 9422799318';
    const companyEmail = currentCompany?.email || 'hariox@gmail.com';
    const companyWebsite = 'https://credit.hariox.com';
    const logoUrl = 'https://uzfccftfizleiyqzqoki.supabase.co/storage/v1/object/public/assets/hariox-logo.png';
    
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 800px; margin: auto; font-size: 12px; color: #333; }
            .invoice-container { border: 1px solid #ddd; padding: 30px; background: #fff; }
            .header { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #1e3a5f; }
            .header-logo { width: 80px; height: 80px; object-fit: contain; }
            .header-content { flex: 1; }
            .header-content h1 { font-size: 20px; color: #1e3a5f; margin-bottom: 5px; font-weight: bold; }
            .header-content .tagline { font-size: 11px; color: #666; font-style: italic; margin-bottom: 10px; }
            .header-content .company-info { font-size: 11px; color: #555; margin-top: 10px; }
            .header-content .gst-info { font-size: 11px; color: #333; font-weight: 500; margin-top: 5px; }
            .invoice-title { text-align: center; font-size: 18px; font-weight: bold; color: #1e3a5f; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; margin-bottom: 25px; }
            .detail-box { width: 48%; }
            .detail-box h4 { font-size: 11px; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
            .detail-box p { margin: 4px 0; font-size: 12px; }
            .detail-box strong { color: #1e3a5f; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #1e3a5f; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 500; }
            th:last-child { text-align: right; }
            td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
            td:last-child { text-align: right; font-family: 'Courier New', monospace; }
            .hsn-col { width: 80px; text-align: center; }
            .qty-col { width: 80px; text-align: center; }
            .summary-table { margin-top: 20px; margin-left: auto; width: 300px; }
            .summary-table td { padding: 8px 12px; border: none; }
            .summary-table tr:last-child { font-weight: bold; background: #f5f5f5; }
            .summary-table tr:last-child td { border-top: 2px solid #1e3a5f; }
            .amount-words { margin: 20px 0; padding: 10px 15px; background: #f9f9f9; border-left: 3px solid #1e3a5f; font-size: 11px; }
            .signature { margin-top: 40px; text-align: right; }
            .signature p { font-size: 11px; color: #666; margin-bottom: 30px; }
            .signature .sign-line { border-top: 1px solid #333; width: 150px; margin-left: auto; padding-top: 5px; font-size: 10px; }
            .hsn-summary { margin-top: 25px; }
            .hsn-summary h4 { font-size: 12px; color: #1e3a5f; margin-bottom: 10px; }
            .hsn-summary table th { background: #f5f5f5; color: #333; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
            .footer p { margin: 3px 0; }
            @media print { 
              body { padding: 0; } 
              .invoice-container { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <img src="${logoUrl}" alt="Company Logo" class="header-logo" onerror="this.style.display='none'" />
              <div class="header-content">
                <h1>${companyName}</h1>
                <p class="tagline">Your Trust, Our Expertise</p>
                <p class="company-info">${companyAddress}</p>
                <p class="gst-info">GST No.: ${companyGST} | Place of supply: Gujarat</p>
              </div>
            </div>
            
            <div class="invoice-title">Invoice</div>
            
            <div class="details-row">
              <div class="detail-box">
                <h4>Bill To</h4>
                <p><strong>${invoice.customer_name}</strong></p>
                <p>Email: ${invoice.customer_email}</p>
                <p>Mobile: ${invoice.customer_phone}</p>
              </div>
              <div class="detail-box" style="text-align: right;">
                <h4>Invoice Details</h4>
                <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
                <p><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</p>
                <p><strong>Reference:</strong> ${invoice.id.substring(0, 36)}</p>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="hsn-col">HSN/SAC</th>
                  <th class="qty-col">Quantity</th>
                  <th>Unit Price</th>
                  <th>Taxes</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Membership Subscription</td>
                  <td class="hsn-col">997156</td>
                  <td class="qty-col">1.00 Units</td>
                  <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
                  <td>CGST 9% + SGST 9%</td>
                  <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            
            <table class="summary-table">
              <tr>
                <td>Untaxed Amount</td>
                <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td>CGST (9%)</td>
                <td>₹ ${cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>SGST (9%)</td>
                <td>₹ ${sgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>₹ ${Number(invoice.total_amount).toFixed(2)}</strong></td>
              </tr>
            </table>
            
            <div class="amount-words">
              <strong>Total amount in words:</strong> ${numberToWords(Number(invoice.total_amount))}
            </div>
            
            <div class="signature">
              <p style="font-style: italic; font-family: 'Brush Script MT', cursive; font-size: 18px; margin-bottom: 5px;">Sharmil</p>
              <div class="sign-line">Authorized Signatory</div>
            </div>
            
            <div class="hsn-summary">
              <h4>HSN Summary</h4>
              <table>
                <thead>
                  <tr>
                    <th>HSN/SAC</th>
                    <th>Quantity</th>
                    <th>Rate %</th>
                    <th>Taxable Value</th>
                    <th>CGST</th>
                    <th>SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>997156</td>
                    <td>1.0 (Units)</td>
                    <td>18.0</td>
                    <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
                    <td>₹ ${cgst.toFixed(2)}</td>
                    <td>₹ ${sgst.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="footer">
              <p>Mo.: ${companyPhone} | Email: ${companyEmail} | Web: ${companyWebsite}</p>
              <p>This is a computer-generated invoice.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(invoiceHTML);
      newWindow.document.close();
    }
  };

  // Helper function to convert number to words
  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero Rupees';
    
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    
    const convertHundreds = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertHundreds(n % 100) : '');
    };
    
    const convertToWords = (n: number): string => {
      if (n < 1000) return convertHundreds(n);
      if (n < 100000) return convertHundreds(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertHundreds(n % 1000) : '');
      if (n < 10000000) return convertHundreds(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertToWords(n % 100000) : '');
      return convertHundreds(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertToWords(n % 10000000) : '');
    };
    
    let result = convertToWords(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + convertHundreds(paise) + ' Paise';
    return result;
  };

  const downloadInvoicePDF = (invoice: GSTInvoice) => {
    const cgst = Number(invoice.gst_amount) / 2;
    const sgst = Number(invoice.gst_amount) / 2;
    
    // Company details for invoice - simplified address
    const companyName = currentCompany?.name || 'HARIOX CORPORATE SERVICES PRIVATE LIMITED';
    const companyAddress = 'Surat, Gujarat, India - 395006';
    const companyGST = '24AAGCF2801F1Z6';
    const companyPhone = currentCompany?.phone || '+91 9422799318';
    const companyEmail = currentCompany?.email || 'hariox@gmail.com';
    const companyWebsite = 'https://credit.hariox.com';
    const logoUrl = 'https://uzfccftfizleiyqzqoki.supabase.co/storage/v1/object/public/assets/hariox-logo.png';
    
    // Get application ID from lead
    const applicationId = invoice.lead?.application_id || 'N/A';

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 800px; margin: auto; font-size: 12px; color: #333; }
            .invoice-container { border: 1px solid #ddd; padding: 30px; background: #fff; }
            .header { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #1e3a5f; }
            .header-logo { width: 80px; height: 80px; object-fit: contain; }
            .header-content { flex: 1; }
            .header-content h1 { font-size: 20px; color: #1e3a5f; margin-bottom: 5px; font-weight: bold; }
            .header-content .tagline { font-size: 11px; color: #666; font-style: italic; margin-bottom: 10px; }
            .header-content .company-info { font-size: 11px; color: #555; margin-top: 10px; }
            .header-content .gst-info { font-size: 11px; color: #333; font-weight: 500; margin-top: 5px; }
            .invoice-title { text-align: center; font-size: 18px; font-weight: bold; color: #1e3a5f; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; margin-bottom: 25px; }
            .detail-box { width: 48%; }
            .detail-box h4 { font-size: 11px; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
            .detail-box p { margin: 4px 0; font-size: 12px; }
            .detail-box strong { color: #1e3a5f; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #1e3a5f; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 500; }
            th:last-child { text-align: right; }
            td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
            td:last-child { text-align: right; font-family: 'Courier New', monospace; }
            .summary-table { margin-top: 20px; margin-left: auto; width: 300px; }
            .summary-table td { padding: 8px 12px; border: none; }
            .summary-table tr:last-child { font-weight: bold; background: #f5f5f5; }
            .summary-table tr:last-child td { border-top: 2px solid #1e3a5f; }
            .amount-words { margin: 20px 0; padding: 10px 15px; background: #f9f9f9; border-left: 3px solid #1e3a5f; font-size: 11px; }
            .signature { margin-top: 40px; text-align: right; }
            .signature p { font-size: 11px; color: #666; margin-bottom: 30px; }
            .signature .sign-line { border-top: 1px solid #333; width: 150px; margin-left: auto; padding-top: 5px; font-size: 10px; }
            .hsn-summary { margin-top: 25px; }
            .hsn-summary h4 { font-size: 12px; color: #1e3a5f; margin-bottom: 10px; }
            .hsn-summary table th { background: #f5f5f5; color: #333; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
            .footer p { margin: 3px 0; }
            @media print { 
              body { padding: 0; } 
              .invoice-container { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <img src="${logoUrl}" alt="Company Logo" class="header-logo" onerror="this.style.display='none'" />
              <div class="header-content">
                <h1>${companyName}</h1>
                <p class="tagline">Your Trust, Our Expertise</p>
                <p class="company-info">${companyAddress}</p>
                <p class="gst-info">GST No.: ${companyGST} | Place of supply: Gujarat</p>
              </div>
            </div>
            
            <div class="invoice-title">Invoice</div>
            
            <div class="details-row">
              <div class="detail-box">
                <h4>Bill To</h4>
                <p><strong>${invoice.customer_name}</strong></p>
                <p>Email: ${invoice.customer_email}</p>
                <p>Mobile: ${invoice.customer_phone}</p>
              </div>
              <div class="detail-box" style="text-align: right;">
                <h4>Invoice Details</h4>
                <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
                <p><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</p>
                <p><strong>Application ID:</strong> ${applicationId}</p>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="width:80px;text-align:center;">HSN/SAC</th>
                  <th style="width:80px;text-align:center;">Quantity</th>
                  <th>Unit Price</th>
                  <th>Taxes</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Membership Subscription</td>
                  <td style="text-align:center;">997156</td>
                  <td style="text-align:center;">1.00 Units</td>
                  <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
                  <td>CGST 9% + SGST 9%</td>
                  <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            
            <table class="summary-table">
              <tr>
                <td>Untaxed Amount</td>
                <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td>CGST (9%)</td>
                <td>₹ ${cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>SGST (9%)</td>
                <td>₹ ${sgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>₹ ${Number(invoice.total_amount).toFixed(2)}</strong></td>
              </tr>
            </table>
            
            <div class="amount-words">
              <strong>Total amount in words:</strong> ${numberToWords(Number(invoice.total_amount))}
            </div>
            
            <div class="signature">
              <p style="font-style: italic; font-family: 'Brush Script MT', cursive; font-size: 18px; margin-bottom: 5px;">Sharmil</p>
              <div class="sign-line">Authorized Signatory</div>
            </div>
            
            <div class="hsn-summary">
              <h4>HSN Summary</h4>
              <table>
                <thead>
                  <tr>
                    <th>HSN/SAC</th>
                    <th>Quantity</th>
                    <th>Rate %</th>
                    <th>Taxable Value</th>
                    <th>CGST</th>
                    <th>SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>997156</td>
                    <td>1.0 (Units)</td>
                    <td>18.0</td>
                    <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
                    <td>₹ ${cgst.toFixed(2)}</td>
                    <td>₹ ${sgst.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="footer">
              <p>Mo.: ${companyPhone} | Email: ${companyEmail} | Web: ${companyWebsite}</p>
              <p>This is a computer-generated invoice.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
    }
  };

  // Get unique categories for the filter dropdown
  const availableCategories = [...new Set(entries.map(e => e.category))].sort();

  // Apply type and category filters
  const filteredEntries = entries.filter(e => {
    if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    return true;
  });

  // Calculate totals based on FILTERED entries (not all entries)
  const totalIncome = filteredEntries.filter(e => e.entry_type === "income").reduce((sum, e) => sum + Number(e.amount), 0);
  const totalExpense = filteredEntries.filter(e => e.entry_type === "expense").reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = totalIncome - totalExpense;
  
  // Calculate GST based on filtered entries
  const calculateFilteredGST = () => {
    const income = filteredEntries.filter(e => e.entry_type === "income");
    const expenses = filteredEntries.filter(e => e.entry_type === "expense");
    
    const outputGST = income
      .filter(e => e.gst_included)
      .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
    
    const inputGST = expenses
      .filter(e => e.gst_included)
      .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
    
    return { outputGST, inputGST, netGST: outputGST - inputGST };
  };
  
  const gstData = calculateFilteredGST();

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-4 text-xs sm:text-sm">
          <TabsTrigger value="transactions" className="text-[10px] sm:text-sm">Transactions</TabsTrigger>
          <TabsTrigger value="invoices" className="text-[10px] sm:text-sm">Invoices</TabsTrigger>
          <TabsTrigger value="gst-returns" className="text-[10px] sm:text-sm">GST</TabsTrigger>
          <TabsTrigger value="reports" className="text-[10px] sm:text-sm">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-6">
          {/* Header with Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select
                className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
              
              {/* Currency Toggle */}
              <div className="flex items-center rounded-lg border border-input bg-background overflow-hidden">
                <button
                  onClick={() => setCurrency("INR")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    currency === "INR"
                      ? "bg-orange-500 text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <IndianRupee className="w-3 h-3" /> INR
                </button>
                <button
                  onClick={() => setCurrency("USD")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    currency === "USD"
                      ? "bg-blue-500 text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <DollarSign className="w-3 h-3" /> USD
                </button>
              </div>

              {/* Type Filter */}
              <select className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs sm:text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setCategoryFilter("all"); }}>
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              {/* Category Filter */}
              <select className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs sm:text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {availableCategories
                  .filter(cat => typeFilter === "all" || entries.some(e => e.category === cat && e.entry_type === typeFilter))
                  .map(cat => (<option key={cat} value={cat}>{cat}</option>))
                }
              </select>
              {(typeFilter !== "all" || categoryFilter !== "all") && (
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {filteredEntries.length}/{entries.length}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportTransactions}>
                <Download className="w-4 h-4 mr-1" />
                Export Filtered
              </Button>
              <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditingEntry(null); }}>
                <DialogTrigger asChild>
                  <Button variant="hero">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingEntry ? "Edit Entry" : "Add Accounting Entry"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="flex gap-2">
                      <button
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${formData.entry_type === "income" ? "bg-green-100 text-green-800 border-2 border-green-300" : "bg-muted hover:bg-muted/80"}`}
                        onClick={() => setFormData(prev => ({ ...prev, entry_type: "income", category: "" }))}
                      >
                        <TrendingUp className="w-4 h-4 inline mr-1" />
                        Income
                      </button>
                      <button
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${formData.entry_type === "expense" ? "bg-red-100 text-red-800 border-2 border-red-300" : "bg-muted hover:bg-muted/80"}`}
                        onClick={() => setFormData(prev => ({ ...prev, entry_type: "expense", category: "" }))}
                      >
                        <TrendingDown className="w-4 h-4 inline mr-1" />
                        Expense
                      </button>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <select
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background"
                        value={formData.category}
                        onChange={(e) => {
                          const category = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            category,
                          }));
                          // Reset meta amounts when changing category
                          if (category === "Marketing Meta") {
                            setMetaAmounts([""]);
                          }
                        }}
                      >
                        <option value="">Select category</option>
                        {categories[formData.entry_type].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Multi-amount input for Marketing Meta */}
                    {formData.category === "Marketing Meta" ? (
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Ad Account Amounts ({currency === "INR" ? "₹" : "$"})</label>
                        {metaAmounts.map((amt, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input
                              type="number"
                              placeholder={`Account ${idx + 1} amount`}
                              value={amt}
                              onChange={(e) => {
                                const newAmounts = [...metaAmounts];
                                newAmounts[idx] = e.target.value;
                                setMetaAmounts(newAmounts);
                              }}
                            />
                            {metaAmounts.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setMetaAmounts(metaAmounts.filter((_, i) => i !== idx))}
                              >
                                ✕
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMetaAmounts([...metaAmounts, ""])}
                          className="w-full"
                        >
                          + Add Another Account
                        </Button>
                        {metaAmounts.filter(a => Number(a) > 0).length > 0 && (
                          <div className="text-right font-semibold text-primary">
                            Total: {formatAmt(metaAmounts.reduce((sum, a) => sum + (Number(a) || 0), 0))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="text-sm font-medium">Amount ({currency === "INR" ? "₹" : "$"})</label>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          value={formData.amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <Input
                        type="date"
                        value={formData.entry_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
                      />
                    </div>

                    {/* GST Toggle */}
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="gst_included"
                          checked={formData.gst_included}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, gst_included: checked as boolean }))}
                        />
                        <Label htmlFor="gst_included" className="cursor-pointer">GST Included in Amount</Label>
                      </div>
                      
                      {formData.gst_included && (
                        <div>
                          <label className="text-sm font-medium">GST Rate</label>
                          <Select
                            value={formData.gst_rate}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, gst_rate: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select GST rate" />
                            </SelectTrigger>
                            <SelectContent>
                              {gstRates.map(rate => (
                                <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>


                    <Button onClick={handleSubmit} className="w-full">
                      {editingEntry ? "Update Entry" : "Save Entry"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
            <div className="bg-card rounded-xl p-3 sm:p-5 border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-[10px] sm:text-sm text-muted-foreground">Income</span>
              </div>
              <p className="text-base sm:text-2xl font-bold text-green-600">{formatAmt(totalIncome)}</p>
            </div>
            <div className="bg-card rounded-xl p-3 sm:p-5 border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-[10px] sm:text-sm text-muted-foreground">Expenses</span>
              </div>
              <p className="text-base sm:text-2xl font-bold text-red-600">{formatAmt(totalExpense)}</p>
            </div>
            <div className={`rounded-xl p-3 sm:p-5 border ${netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <IndianRupee className="w-4 h-4" />
                <span className="text-[10px] sm:text-sm text-muted-foreground">Gross Profit</span>
              </div>
              <p className={`text-base sm:text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {netProfit >= 0 ? "+" : "-"}{formatAmt(Math.abs(netProfit))}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/20 rounded-xl p-3 sm:p-5 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-1.5 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <span className="text-[10px] sm:text-sm text-muted-foreground">GST</span>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-amber-600">Output</span>
                  <span className="font-medium text-amber-700">₹{gstData.outputGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-green-600">Input</span>
                  <span className="font-medium text-green-700">₹{gstData.inputGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-amber-300 dark:border-amber-700 pt-0.5 flex justify-between text-xs font-bold">
                  <span className={gstData.netGST >= 0 ? "text-amber-800" : "text-green-700"}>
                    {gstData.netGST >= 0 ? "Payable" : "ITC Credit"}
                  </span>
                  <span className={gstData.netGST >= 0 ? "text-amber-800" : "text-green-700"}>
                    {gstData.netGST >= 0 ? "" : "-"}₹{Math.abs(gstData.netGST).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            <div className={`rounded-xl p-3 sm:p-5 border col-span-2 sm:col-span-1 ${(netProfit - gstData.netGST) >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] sm:text-sm text-muted-foreground">Net Profit</span>
              </div>
              <p className={`text-base sm:text-2xl font-bold ${(netProfit - gstData.netGST) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {(netProfit - gstData.netGST) < 0 ? "-" : ""}{formatAmt(Math.abs(netProfit - gstData.netGST), 2)}
              </p>
            </div>
          </div>

          {/* Entries - Mobile Cards + Desktop Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Transactions</h2>
            </div>
            {isLoading ? (
              <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No entries found</div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-border">
                  {filteredEntries.map((entry) => {
                    const customerName = entry.customer_name || entry.lead?.full_name || null;
                    const customerPhone = entry.customer_phone || entry.lead?.phone || null;
                    return (
                      <div key={entry.id} className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between">
                          <div>
                            {customerName ? (
                              <p className="font-medium text-sm">{customerName}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">{entry.category}</p>
                            )}
                            {customerPhone && <p className="text-[10px] text-muted-foreground">{customerPhone}</p>}
                          </div>
                          <p className={`font-bold text-sm ${entry.entry_type === "income" ? "text-green-600" : "text-red-600"}`}>
                            {entry.entry_type === "income" ? "+" : "-"}{formatAmt(Number(entry.amount))}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${entry.entry_type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {entry.entry_type}
                          </span>
                          {entry.id.startsWith("payment_") && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">Auto</span>
                          )}
                          {customerName && <span className="text-[10px] text-muted-foreground">{entry.category}</span>}
                          {entry.gst_included && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700">GST {entry.gst_rate || 18}%</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{new Date(entry.entry_date).toLocaleDateString("en-IN")} {entry.description ? `• ${entry.description}` : ""}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(entry)}>
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDeleteClick(entry)}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Category</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Description</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">GST</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => {
                        const customerName = entry.customer_name || entry.lead?.full_name || null;
                        const customerPhone = entry.customer_phone || entry.lead?.phone || null;
                        return (
                          <tr key={entry.id} className="border-t border-border hover:bg-muted/30">
                            <td className="p-4 whitespace-nowrap">{new Date(entry.entry_date).toLocaleDateString("en-IN")}</td>
                            <td className="p-4">
                              {customerName || customerPhone ? (
                                <div className="min-w-[120px]">
                                  {customerName && <p className="font-medium text-sm">{customerName}</p>}
                                  {customerPhone && <p className="text-xs text-muted-foreground">{customerPhone}</p>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${entry.entry_type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                {entry.entry_type}
                              </span>
                              {entry.id.startsWith("payment_") && (
                                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">Auto</span>
                              )}
                            </td>
                            <td className="p-4">{entry.category}</td>
                            <td className="p-4 text-muted-foreground max-w-[200px] truncate">{entry.description || "-"}</td>
                            <td className="p-4 text-center">
                              {entry.gst_included ? (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">{entry.gst_rate || 18}%</span>
                              ) : "-"}
                            </td>
                            <td className={`p-4 text-right font-semibold whitespace-nowrap ${entry.entry_type === "income" ? "text-green-600" : "text-red-600"}`}>
                              {entry.entry_type === "income" ? "+" : "-"}{formatAmt(Number(entry.amount))}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(entry)}><Edit2 className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(entry)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="font-semibold">GST Invoices</h2>
              <Button variant="outline" size="sm" onClick={() => exportInvoicesCSV()}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No invoices generated yet</div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-border">
                  {invoices.map((invoice) => {
                    const cgst = Number(invoice.gst_amount) / 2;
                    return (
                      <div key={invoice.id} className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{invoice.customer_name}</p>
                            <p className="text-[10px] text-muted-foreground">{invoice.customer_phone}</p>
                          </div>
                          <p className="font-bold text-sm">{formatAmt(Number(invoice.total_amount))}</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{invoice.invoice_number}</span>
                            <span>{new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => viewInvoice(invoice)}>
                              <Receipt className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => downloadInvoicePDF(invoice)}>
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-medium text-muted-foreground">Invoice No.</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Mobile</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Base Amount</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">CGST (9%)</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">SGST (9%)</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Total</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => {
                        const cgst = Number(invoice.gst_amount) / 2;
                        const sgst = Number(invoice.gst_amount) / 2;
                        return (
                          <tr key={invoice.id} className="border-t border-border hover:bg-muted/30">
                            <td className="p-4 font-mono text-sm">{invoice.invoice_number}</td>
                            <td className="p-4">{new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</td>
                            <td className="p-4">
                              <p className="font-medium">{invoice.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{invoice.customer_email}</p>
                            </td>
                            <td className="p-4 text-muted-foreground">{invoice.customer_phone}</td>
                            <td className="p-4 text-right">₹{Number(invoice.amount).toFixed(2)}</td>
                            <td className="p-4 text-right">₹{cgst.toFixed(2)}</td>
                            <td className="p-4 text-right">₹{sgst.toFixed(2)}</td>
                            <td className="p-4 text-right font-semibold">₹{Number(invoice.total_amount).toFixed(2)}</td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => viewInvoice(invoice)} title="View Invoice"><Receipt className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => downloadInvoicePDF(invoice)} title="Download PDF"><Download className="w-4 h-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gst-returns" className="space-y-6">
          <GSTReturnsSection
            entries={entries}
            invoices={invoices}
            exportGSTR1={exportGSTR1}
            exportGSTR2={exportGSTR2}
            exportGSTR3B={exportGSTR3B}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-semibold">Balance Sheet & P&L Statement</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <select
                    className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                    value={plDateFilter}
                    onChange={(e) => setPlDateFilter(e.target.value as any)}
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 3 Months</option>
                    <option value="year">Last 12 Months</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                {plDateFilter === "custom" && (
                  <>
                    <input 
                      type="date" 
                      className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm" 
                      value={plCustomStart} 
                      onChange={(e) => setPlCustomStart(e.target.value)} 
                    />
                    <span className="text-muted-foreground">to</span>
                    <input 
                      type="date" 
                      className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm" 
                      value={plCustomEnd} 
                      onChange={(e) => setPlCustomEnd(e.target.value)} 
                    />
                  </>
                )}
                <Button variant="outline" onClick={exportBalanceSheet}>
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
                <Button variant="outline" onClick={exportBalanceSheetPDF}>
                  <FileText className="w-4 h-4 mr-1" />
                  PDF
                </Button>
              </div>
            </div>
            
            {/* Compute filtered entries for P&L based on plDateFilter */}
            {(() => {
              const now = new Date();
              let filterStartStr: string | null = null;
              let filterEndStr: string | null = null;
              
              const todayStr = formatISTDate(now);
              const yesterdayStr = getISTDateNDaysAgo(now, 1);
              
              if (plDateFilter === "today") {
                filterStartStr = todayStr;
                filterEndStr = todayStr;
              } else if (plDateFilter === "yesterday") {
                filterStartStr = yesterdayStr;
                filterEndStr = yesterdayStr;
              } else if (plDateFilter === "week") {
                filterStartStr = getISTDateNDaysAgo(now, 7);
                filterEndStr = todayStr;
              } else if (plDateFilter === "month") {
                filterStartStr = getISTDateNDaysAgo(now, 30);
                filterEndStr = todayStr;
              } else if (plDateFilter === "quarter") {
                filterStartStr = getISTDateNDaysAgo(now, 90);
                filterEndStr = todayStr;
              } else if (plDateFilter === "year") {
                filterStartStr = getISTDateNDaysAgo(now, 365);
                filterEndStr = todayStr;
              } else if (plDateFilter === "custom") {
                if (plCustomStart) filterStartStr = plCustomStart;
                if (plCustomEnd) filterEndStr = plCustomEnd;
              }
              
              const filteredEntries = entries.filter(e => {
                const entryDateStr = e.entry_date.split("T")[0];
                if (filterStartStr && entryDateStr < filterStartStr) return false;
                if (filterEndStr && entryDateStr > filterEndStr) return false;
                return true;
              });
              
              const plTotalIncome = filteredEntries.filter(e => e.entry_type === "income").reduce((sum, e) => sum + Number(e.amount), 0);
              const plTotalExpense = filteredEntries.filter(e => e.entry_type === "expense").reduce((sum, e) => sum + Number(e.amount), 0);
              const plNetProfit = plTotalIncome - plTotalExpense;
              
              const plOutputGST = filteredEntries
                .filter(e => e.entry_type === "income" && e.gst_included)
                .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
              const plInputGST = filteredEntries
                .filter(e => e.entry_type === "expense" && e.gst_included)
                .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
              const plNetGST = plOutputGST - plInputGST;
              
              return (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Profit & Loss Statement */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-lg mb-4">Profit & Loss Statement</h3>
                
                {/* Revenue Section */}
                <div className="mb-6">
                  <h4 className="text-green-600 font-medium mb-3">Revenue</h4>
                  <div className="space-y-2 pl-4">
                    {Object.entries(
                      filteredEntries
                        .filter(e => e.entry_type === "income")
                        .reduce((acc, e) => {
                          acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
                          return acc;
                        }, {} as Record<string, number>)
                    ).map(([category, amount]) => (
                      <div key={category} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span>₹{amount.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    {Object.keys(filteredEntries.filter(e => e.entry_type === "income").reduce((acc, e) => {
                      acc[e.category] = 1; return acc;
                    }, {} as Record<string, number>)).length === 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">No Income</span>
                        <span>₹0</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between font-medium mt-3 pt-2 border-t border-border">
                    <span>Total Revenue</span>
                    <span className="text-green-600">₹{plTotalIncome.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Expenses Section */}
                <div className="mb-6">
                  <h4 className="text-red-600 font-medium mb-3">Expenses</h4>
                  <div className="space-y-2 pl-4">
                    {Object.entries(
                      filteredEntries
                        .filter(e => e.entry_type === "expense")
                        .reduce((acc, e) => {
                          acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
                          return acc;
                        }, {} as Record<string, number>)
                    ).map(([category, amount]) => {
                      const pct = plTotalIncome > 0 ? ((amount / plTotalIncome) * 100).toFixed(1) : "0.0";
                      return (
                        <div key={category} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{category}</span>
                          <span>₹{amount.toLocaleString("en-IN")} <span className="text-xs text-muted-foreground">({pct}%)</span></span>
                        </div>
                      );
                    })}
                    {Object.keys(filteredEntries.filter(e => e.entry_type === "expense").reduce((acc, e) => {
                      acc[e.category] = 1; return acc;
                    }, {} as Record<string, number>)).length === 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>No expenses</span>
                        <span>₹0</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between font-medium mt-3 pt-2 border-t border-border">
                    <span>Total Expenses</span>
                    <span className="text-red-600">₹{plTotalExpense.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Net Profit After GST */}
                <div className="border-t-2 border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Profit</span>
                    <span className={plNetProfit >= 0 ? "text-green-600" : "text-red-600"}>
                      ₹{plNetProfit.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Output GST (Collected)</span>
                    <span className="text-amber-600">₹{Math.round(plOutputGST).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Input GST (Paid)</span>
                    <span className="text-green-600">₹{Math.round(plInputGST).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={`text-muted-foreground ${plNetGST < 0 ? "font-medium" : ""}`}>
                      {plNetGST >= 0 ? "GST Payable" : "ITC Credit Available"}
                    </span>
                    <span className={plNetGST >= 0 ? "text-orange-600" : "text-green-600 font-medium"}>
                      {plNetGST < 0 ? "-" : ""}₹{Math.abs(Math.round(plNetGST)).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                    <span>Net Profit (After GST)</span>
                    <span className={(plNetProfit - plNetGST) >= 0 ? "text-green-600" : "text-red-600"}>
                      {(plNetProfit - plNetGST) < 0 ? "-" : ""}₹{Math.abs(plNetProfit - plNetGST).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Profit Margin</span>
                    <span>{plTotalIncome > 0 ? (((plNetProfit - plNetGST) / plTotalIncome) * 100).toFixed(1) : 0}%</span>
                  </div>
                </div>
              </div>

              {/* Balance Sheet */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-lg mb-4">Balance Sheet</h3>
                
                {/* Assets Section */}
                <div className="mb-6">
                  <h4 className="text-blue-600 font-medium mb-3">Assets</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cash & Bank Balance</span>
                      <span>₹{plTotalIncome.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Accounts Receivable</span>
                      <span>₹0</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-medium mt-3 pt-2 border-t border-border">
                    <span>Total Assets</span>
                    <span className="text-blue-600">₹{plTotalIncome.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Liabilities & GST */}
                <div className="mb-6">
                  <h4 className="text-orange-600 font-medium mb-3">Liabilities & GST</h4>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Output GST (Collected)</span>
                      <span>₹{Math.round(plOutputGST).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Input GST (Paid)</span>
                      <span className="text-green-600">-₹{Math.round(plInputGST).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className={plNetGST >= 0 ? "text-amber-700" : "text-green-700"}>
                        {plNetGST >= 0 ? "Net GST Payable" : "ITC Credit Available"}
                      </span>
                      <span className={plNetGST >= 0 ? "text-amber-700" : "text-green-700"}>
                        ₹{Math.abs(Math.round(plNetGST)).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Other Liabilities</span>
                      <span>₹0</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-medium mt-3 pt-2 border-t border-border">
                    <span>Total Liabilities</span>
                    <span className={plNetGST > 0 ? "text-red-600" : "text-green-600"}>
                      ₹{(plNetGST >= 0 ? plNetGST : 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Net Worth */}
                <div className="border-t-2 border-border pt-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Net Worth</span>
                    <span className="text-green-600">
                      ₹{(plTotalIncome - (plNetGST >= 0 ? plNetGST : 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog with Password */}
      <PasswordConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete Accounting Entry"
        description="Enter admin password to delete this entry. This action cannot be undone."
      />
    </div>
  );
};

export default AccountingModule;
