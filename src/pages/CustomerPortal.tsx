import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { 
  Phone, Loader2, Upload, FileCheck, CheckCircle2, AlertCircle, 
  Receipt, FileText, User, Building2, Clock, LogOut, Download,
  MessageCircle, Mail, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { Database } from "@/integrations/supabase/types";
import financeLogo from "@/assets/finance-logo.png";
import capitalLogo from "@/assets/hariox-logo-full.png";
import harioxLogo from "@/assets/hariox-icon.png";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

// Status labels with department info
const statusLabels: Record<LeadStatus, { label: string; color: string; department: string }> = {
  unpaid: { label: "Payment Pending", color: "bg-yellow-100 text-yellow-800", department: "Sales" },
  paid: { label: "Paid", color: "bg-green-100 text-green-800", department: "Verification Team" },
  verification: { label: "Under Verification", color: "bg-blue-100 text-blue-800", department: "Verification Team" },
  documents_pending: { label: "Documents Required", color: "bg-orange-100 text-orange-800", department: "Verification Team" },
  documents_uploaded: { label: "Documents Submitted", color: "bg-purple-100 text-purple-800", department: "Verification Team" },
  verified: { label: "Verified", color: "bg-teal-100 text-teal-800", department: "Login Team" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", department: "Verification Team" },
  processing: { label: "Processing", color: "bg-indigo-100 text-indigo-800", department: "Login Team" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800", department: "Login Team" },
  disbursed: { label: "Disbursed", color: "bg-green-200 text-green-900", department: "Login Team" },
  lost: { label: "Closed", color: "bg-gray-100 text-gray-800", department: "Admin" },
};

const requiredDocuments = [
  { type: "aadhaar", label: "Aadhaar Card" },
  { type: "pan", label: "PAN Card" },
  { type: "salary_slip", label: "Salary Slip (3 months)" },
  { type: "form16", label: "Form-16" },
  { type: "itr", label: "ITR (2 years)" },
  { type: "bank_statement", label: "Bank Statement (6 months)" },
];

interface LeadInfo {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  application_id: string | null;
  loan_type: string;
  loan_amount: number;
  created_at: string;
  company?: { name: string; logo_url: string | null; phone: string | null; whatsapp_number: string | null } | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  invoice_date: string;
  status: string;
}

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  status: string;
  created_at: string;
}

const CustomerPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"phone" | "otp" | "dashboard">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Detect brand
  const brand = (() => {
    const companyParam = searchParams.get('company');
    if (companyParam === 'capital') return 'capital';
    if (companyParam === 'finance') return 'finance';
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('capital')) return 'capital';
    if (hostname.includes('finance')) return 'finance';
    return 'credit';
  })();

  const brandConfig = {
    capital: { logo: capitalLogo, name: "Capital Hariox", homeUrl: "/", gradient: "from-emerald-50 to-teal-50", accent: "emerald" },
    finance: { logo: financeLogo, name: "Finance Hariox", homeUrl: "/", gradient: "from-blue-50 to-indigo-50", accent: "blue" },
    credit: { logo: harioxLogo, name: "Credit Hariox", homeUrl: "/", gradient: "from-blue-50 to-indigo-50", accent: "blue" },
  }[brand];

  // Check for existing session with expiry
  useEffect(() => {
    const savedPhone = sessionStorage.getItem("customerPhone");
    const savedLeadId = sessionStorage.getItem("customerLeadId");
    const savedAt = sessionStorage.getItem("customerSessionAt");
    const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
    
    if (savedPhone && savedLeadId && savedAt) {
      const elapsed = Date.now() - parseInt(savedAt, 10);
      if (elapsed < SESSION_MAX_AGE_MS) {
        setPhone(savedPhone);
        fetchLeadData(savedLeadId);
      } else {
        // Expired session
        sessionStorage.removeItem("customerPhone");
        sessionStorage.removeItem("customerLeadId");
        sessionStorage.removeItem("customerSessionAt");
      }
    }
  }, []);

  const handleSendOTP = async () => {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if lead exists with this phone
      const { data: leads } = await supabase
        .rpc("lookup_leads_by_phone", { _phone: cleanPhone });

      const allLeads = leads || [];
      const realLeads = allLeads.filter((l: any) => {
        const isPlaceholder = l.full_name === "Phone Lead" || 
          l.email?.includes("@placeholder") ||
          !l.full_name || !l.email;
        return !isPlaceholder;
      });

      if (realLeads.length > 0) {
        // returning customer who has completed the form once - completely bypass OTP!
        sessionStorage.setItem("customerPhone", cleanPhone);
        sessionStorage.setItem("customerLeadId", realLeads[0].id);
        sessionStorage.setItem("customerSessionAt", String(Date.now()));
        await fetchLeadData(realLeads[0].id);
        return;
      }

      if (allLeads.length === 0) {
        setError("No application found with this mobile number.");
        return;
      }

      // If it exists but only as a placeholder lead (no completed form/OTP verify yet), send OTP
      const response = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanPhone },
      });

      if (response.error) throw new Error("Failed to send OTP");

      setPhone(cleanPhone);
      setStep("otp");
    } catch (err) {
      console.error("OTP error:", err);
      setError("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("verify-otp", {
        body: { phone, code: otp },
      });

      if (response.error || !response.data?.success) {
        setError(response.data?.error || "Invalid OTP. Please try again.");
        return;
      }

      // Get lead data
      const { data: leads } = await supabase
        .rpc("lookup_leads_by_phone", { _phone: phone });

      const allLeads = leads || [];
      if (allLeads.length > 0) {
        sessionStorage.setItem("customerPhone", phone);
        sessionStorage.setItem("customerLeadId", allLeads[0].id);
        sessionStorage.setItem("customerSessionAt", String(Date.now()));
        await fetchLeadData(allLeads[0].id);
      }
    } catch (err) {
      console.error("Verify error:", err);
      setError("Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeadData = async (leadId: string) => {
    try {
      // Fetch lead info via secure RPC
      const { data: leadRows } = await supabase
        .rpc("lookup_lead_by_id", { _lead_id: leadId });

      const leadData = leadRows?.[0] || null;

      if (leadData) {
        setLead(leadData as unknown as LeadInfo);
        setStep("dashboard");

        // Fetch invoices
        const { data: invoiceData } = await supabase
          .from("gst_invoices")
          .select("id, invoice_number, amount, gst_amount, total_amount, invoice_date, status")
          .eq("lead_id", leadId)
          .order("invoice_date", { ascending: false });
        setInvoices(invoiceData || []);

        // Fetch documents
        const { data: docData } = await supabase
          .from("documents")
          .select("id, document_type, file_name, status, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false });
        
        if (docData) {
          setDocuments(docData);
          const uploaded: Record<string, boolean> = {};
          docData.forEach((doc) => {
            uploaded[doc.document_type] = true;
          });
          setUploadedDocs(uploaded);
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleUpload = async (docType: string, file: File) => {
    if (!lead) return;

    setUploading(docType);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${lead.id}/${docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Store the file path (not public URL) since bucket is private
      const filePath = fileName;

      await supabase.from("documents").insert({
        lead_id: lead.id,
        document_type: docType,
        file_name: file.name,
        file_url: filePath,
        status: "uploaded",
      });

      // Update lead status if customer is uploading documents
      const docsUploadStatuses: LeadStatus[] = ["paid", "documents_pending", "verification"];
      if (docsUploadStatuses.includes(lead.status)) {
        await supabase
          .from("leads")
          .update({ status: "documents_uploaded" })
          .eq("id", lead.id);
        setLead({ ...lead, status: "documents_uploaded" });
      }

      setUploadedDocs((prev) => ({ ...prev, [docType]: true }));
      setDocuments((prev) => [...prev, { 
        id: crypto.randomUUID(), 
        document_type: docType, 
        file_name: file.name, 
        status: "uploaded", 
        created_at: new Date().toISOString() 
      }]);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("customerPhone");
    sessionStorage.removeItem("customerLeadId");
    sessionStorage.removeItem("customerSessionAt");
    setStep("phone");
    setPhone("");
    setOtp("");
    setLead(null);
    setInvoices([]);
    setDocuments([]);
    setUploadedDocs({});
  };

  const downloadInvoice = (invoice: Invoice) => {
    if (!lead) return;
    
    const cgst = Number(invoice.gst_amount) / 2;
    const sgst = Number(invoice.gst_amount) / 2;
    const companyName = lead.company?.name || 'HARIOX CORPORATE SERVICES PRIVATE LIMITED';
    const companyAddress = 'Surat, Gujarat, India - 395006';
    const companyGST = '24AAGCF2801F1Z6';
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
            .header-content h1 { font-size: 20px; color: #1e3a5f; margin-bottom: 5px; }
            .header-content .company-info { font-size: 11px; color: #555; margin-top: 10px; }
            .invoice-title { text-align: center; font-size: 18px; font-weight: bold; color: #1e3a5f; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; margin-bottom: 25px; }
            .detail-box { width: 48%; }
            .detail-box h4 { font-size: 11px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
            .detail-box p { margin: 4px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #1e3a5f; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; }
            td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
            .summary-table { margin-top: 20px; margin-left: auto; width: 300px; }
            .summary-table td { padding: 8px 12px; border: none; }
            .summary-table tr:last-child { font-weight: bold; background: #f5f5f5; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <img src="${logoUrl}" alt="Logo" class="header-logo" onerror="this.style.display='none'" />
              <div class="header-content">
                <h1>${companyName}</h1>
                <p class="company-info">${companyAddress}</p>
                <p style="font-size: 11px; margin-top: 5px;">GST No.: ${companyGST}</p>
              </div>
            </div>
            <div class="invoice-title">Invoice</div>
            <div class="details-row">
              <div class="detail-box">
                <h4>Bill To</h4>
                <p><strong>${lead.full_name}</strong></p>
                <p>Email: ${lead.email}</p>
                <p>Mobile: ${lead.phone}</p>
              </div>
              <div class="detail-box" style="text-align: right;">
                <h4>Invoice Details</h4>
                <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
                <p><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</p>
                <p><strong>Application ID:</strong> ${lead.application_id || 'N/A'}</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>HSN/SAC</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Membership Subscription</td>
                  <td>997156</td>
                  <td>₹ ${Number(invoice.amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <table class="summary-table">
              <tr><td>Subtotal</td><td>₹ ${Number(invoice.amount).toFixed(2)}</td></tr>
              <tr><td>CGST (9%)</td><td>₹ ${cgst.toFixed(2)}</td></tr>
              <tr><td>SGST (9%)</td><td>₹ ${sgst.toFixed(2)}</td></tr>
              <tr><td><strong>Total</strong></td><td><strong>₹ ${Number(invoice.total_amount).toFixed(2)}</strong></td></tr>
            </table>
            <div class="footer">
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

  // Shared Header Component for login screens
  const PortalHeader = () => (
    <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={brandConfig.homeUrl} className="flex items-center gap-3">
            <img src={brandConfig.logo} alt={brandConfig.name} className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <a href="tel:+919422799318" className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Phone className="w-4 h-4" />
              +91 9422799318
            </a>
            <Link to={brandConfig.homeUrl}>
              <Button variant="outline" size="sm">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );

  // Shared Footer Component for login screens
  const PortalFooter = () => (
    <footer className="bg-[hsl(220,25%,12%)] text-white py-8 mt-auto">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={brandConfig.logo} alt={brandConfig.name} className="h-8 w-auto rounded bg-white p-1" />
            <span className="text-sm text-white/70">Hariox Corporate Services Pvt. Ltd.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+919422799318" className="text-white/70 hover:text-white transition-colors">
              <Phone className="w-5 h-5" />
            </a>
            <a href="https://wa.me/918469391818" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
              <MessageCircle className="w-5 h-5" />
            </a>
            <a href="mailto:hariox@gmail.com" className="text-white/70 hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <p className="text-white/50 text-xs">© 2025 {brandConfig.name}. All rights reserved. | Surat, Gujarat, India</p>
        </div>
      </div>
    </footer>
  );

  // Phone entry screen
  if (step === "phone") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col">
        <PortalHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
              <p className="text-gray-600 mt-2">
                Login to view your application status, invoices, and upload documents
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                  className="pl-10 h-12 text-lg"
                  maxLength={10}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleSendOTP}
                disabled={isLoading || phone.length < 10}
                className="w-full h-12 text-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  "Get OTP"
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-6">
              Use the same mobile number you used during application
            </p>
          </div>
        </div>
        <PortalFooter />
      </div>
    );
  }

  // OTP verification screen
  if (step === "otp") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col">
        <PortalHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Verify OTP</h1>
              <p className="text-gray-600 mt-2">
                Enter the 6-digit code sent to <strong>+91 {phone}</strong>
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    setError(null);
                  }}
                >
                  <InputOTPGroup>
                    {[...Array(6)].map((_, i) => (
                      <InputOTPSlot key={i} index={i} className="w-10 h-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
                className="w-full h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Login"
                )}
              </Button>

              <button
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError(null);
                }}
                className="text-sm text-primary hover:underline block mx-auto"
              >
                Use different number
              </button>
            </div>
          </div>
        </div>
        <PortalFooter />
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {lead?.company?.logo_url && (
              <img src={lead.company.logo_url} alt="Logo" className="h-8 w-auto" />
            )}
            <div>
              <h1 className="font-semibold text-gray-900">
                {lead?.company?.name || "Hariox"}
              </h1>
              <p className="text-xs text-gray-500">Customer Portal</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {lead?.status === "unpaid" && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-left">
              <h3 className="text-lg font-bold text-yellow-900">Payment Pending</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Your application profile is complete. Please complete the one-time registration fee payment of $129 USD to start verification.
              </p>
            </div>
            <Button 
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-6 py-5 rounded-lg shrink-0 shadow-md"
              onClick={() => {
                navigate("/payment", {
                  state: {
                    leadId: lead.id,
                    loanAmount: lead.loan_amount,
                    leadDetails: {
                      fullName: lead.full_name,
                      email: lead.email,
                      phone: lead.phone,
                    }
                  }
                });
              }}
            >
              Pay Now
            </Button>
          </div>
        )}
        {/* Application Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{lead?.full_name}</h2>
                <p className="text-sm text-gray-500">{lead?.phone} • {lead?.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Application ID</p>
              <p className="text-lg font-bold text-primary">{lead?.application_id || "N/A"}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Loan Type</p>
              <p className="font-medium capitalize">{lead?.loan_type?.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Loan Amount</p>
              <p className="font-medium">₹{lead?.loan_amount?.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Applied On</p>
              <p className="font-medium">
                {lead?.created_at ? new Date(lead.created_at).toLocaleDateString("en-IN") : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              {lead?.status && (
                <Badge className={`${statusLabels[lead.status]?.color} border-0`}>
                  {statusLabels[lead.status]?.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Current Department/Stage Info */}
          {lead?.status && (
            <div className="mt-4 pt-4 border-t bg-blue-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Your application is with: <span className="text-blue-600">{statusLabels[lead.status]?.department}</span>
                  </p>
                  <p className="text-xs text-gray-600">
                    {lead.status === 'unpaid' && "Your payment is pending. Please complete your payment to start document verification."}
                    {lead.status === 'paid' && "Our team will verify your details and contact you soon."}
                    {lead.status === 'verification' && "Your documents are being verified by our team."}
                    {lead.status === 'documents_pending' && "Please upload the required documents."}
                    {lead.status === 'documents_uploaded' && "We have received your documents and are reviewing them."}
                    {lead.status === 'verified' && "Your documents have been verified. Application is being processed."}
                    {lead.status === 'processing' && "Your loan application is being processed with banks."}
                    {lead.status === 'approved' && "Congratulations! Your loan has been approved."}
                    {lead.status === 'disbursed' && "Your loan amount has been disbursed."}
                    {lead.status === 'rejected' && "Unfortunately, your application could not be processed."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Invoices
            </TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Required Documents</h3>
              <div className="space-y-3">
                {requiredDocuments.map((doc) => (
                  <div
                    key={doc.type}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      uploadedDocs[doc.type]
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileCheck
                          className={`w-5 h-5 ${
                            uploadedDocs[doc.type] ? "text-green-600" : "text-gray-400"
                          }`}
                        />
                        <span className="font-medium text-gray-900">{doc.label}</span>
                      </div>

                      {uploadedDocs[doc.type] ? (
                        <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Uploaded
                        </span>
                      ) : (
                        <>
                          <input
                            type="file"
                            ref={(el) => (fileRefs.current[doc.type] = el)}
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleUpload(doc.type, e.target.files[0]);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={uploading === doc.type}
                            onClick={() => fileRefs.current[doc.type]?.click()}
                          >
                            {uploading === doc.type ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-1" />
                                Upload
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center mt-4">
                Accepted formats: PDF, JPG, PNG. Max file size: 10MB each.
              </p>
            </div>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Your Invoices</h3>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No invoices found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 border rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Receipt className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(invoice.invoice_date).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">₹{Number(invoice.total_amount).toFixed(2)}</p>
                          <Badge variant="outline" className="text-xs">
                            {invoice.status}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadInvoice(invoice)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Help Section */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-gray-900">Need Help?</p>
              <p className="text-xs text-gray-600">Contact our support team</p>
            </div>
          </div>
          <a
            href={`tel:${lead?.company?.phone || "+919422799318"}`}
            className="text-primary font-medium text-sm hover:underline"
          >
            {lead?.company?.phone || "+91 94227 99318"}
          </a>
        </div>
      </main>
    </div>
  );
};

export default CustomerPortal;
