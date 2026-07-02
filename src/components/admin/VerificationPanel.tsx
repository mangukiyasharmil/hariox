import { useState, useEffect, useRef, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeLeads";
import { FileCheck, Upload, Download, CheckCircle, XCircle, Eye, Copy, Plus, Phone, User, MessageSquare, FileSpreadsheet, X, Search, Calendar, Filter } from "lucide-react";
import { toast } from "sonner";
import LeadDetailsModal from "./LeadDetailsModal";
import AdditionalLeadFields from "./AdditionalLeadFields";
import SendSMSDialog from "./SendSMSDialog";
import WhatsAppDirectChat from "./whatsapp/WhatsAppDirectChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, Document } from "@/types/database";
import { triggerStatusWorkflow } from "@/hooks/useWorkflowTrigger";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const requiredDocuments = [
  { type: "aadhaar", label: "Aadhaar Card" },
  { type: "pan", label: "PAN Card" },
  { type: "salary_slip", label: "Salary Slip (3 months)" },
  { type: "form16", label: "Form-16" },
  { type: "itr", label: "ITR (2 years)" },
  { type: "bank_statement", label: "Bank Statement (6 months)" },
  { type: "other", label: "Other Document" },
];

const VerificationPanel = () => {
  const isMobile = useIsMobile();
  useRealtimeSync([["verification-leads"]]);
  const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewDetailsLead, setViewDetailsLead] = useState<Lead | null>(null);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsLead, setSmsLead] = useState<Lead | null>(null);
  const [whatsappChatOpen, setWhatsappChatOpen] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let result = leads;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const qDigits = q.replace(/\D/g, "");
      result = result.filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.includes(qDigits) ||
        l.city?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(l => l.status === statusFilter);
    }

    // Date filter - by updated_at (when status last changed)
    if (dateFilter !== "all") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      if (dateFilter === "today") result = result.filter(l => l.updated_at >= todayStart);
      else if (dateFilter === "week") result = result.filter(l => l.updated_at >= weekAgo);
      else if (dateFilter === "month") result = result.filter(l => l.updated_at >= monthAgo);
    }

    // Sort: paid leads with recent updated_at first (paid today on top)
    result.sort((a, b) => {
      // Paid status leads on top
      const aPaid = a.status === "paid" ? 0 : 1;
      const bPaid = b.status === "paid" ? 0 : 1;
      if (aPaid !== bPaid) return aPaid - bPaid;
      // Then by updated_at descending
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return result;
  }, [leads, searchQuery, statusFilter, dateFilter]);

  const handleExport = () => {
    if (leads.length === 0) {
      toast.error("No leads to export");
      return;
    }

    const headers = [
      "Name",
      "Phone",
      "Email",
      "Loan Type",
      "Loan Amount",
      "Status",
      "City",
      "Employment Type",
      "Monthly Income",
      "Assigned To",
      "Received Date"
    ];

    const rows = leads.map((lead) => {
      const assignedName = staffList.find(s => s.id === lead.assigned_to)?.full_name || "-";
      
      return [
        lead.full_name,
        lead.phone,
        lead.email,
        lead.loan_type,
        lead.loan_amount.toString(),
        lead.status.replace(/_/g, " "),
        lead.city,
        lead.employment_type,
        lead.monthly_income.toString(),
        assignedName,
        new Date(lead.updated_at).toLocaleDateString("en-IN")
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `verification_queue_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${leads.length} leads`);
  };

  useEffect(() => {
    fetchUserAndLeads();
    fetchStaff();
  }, [currentCompany?.id, showAllCompanies]);

  const fetchStaff = async () => {
    // Fetch roles and profiles separately for reliability
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["telecaller", "verification", "login_team"]);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    if (roles && profiles) {
      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
      setStaffList(
        roles.map((r) => ({
          id: r.user_id,
          full_name: profileMap.get(r.user_id) || "Unknown",
          role: r.role,
        }))
      );
    }
  };

  const handleCall = (phone: string) => window.open(`tel:+91${phone}`, "_self");
  
  const handleWhatsApp = (phone: string, name: string, leadId?: string) => {
    if (leadId) {
      // Auto-send document upload link
      const uploadUrl = generateDocUploadLink(leadId);
      const message = `Dear ${name},

Thank you for your payment! 🎉

📄 *Please upload your documents using this secure link:*
${uploadUrl}

📋 *Required Documents:*
• Aadhaar Card
• PAN Card
• Salary Slips (3 months)
• Form-16
• ITR (2 years)
• Bank Statement (6 months)

⏰ Please upload within 24 hours for faster processing.

Thank you for choosing Credit Hariox!`;
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
    } else {
      const message = `Hello ${name}, we need to verify your documents for your loan application.`;
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
    }
  };

  const handleWhatsAppAPI = (lead: Lead) => {
    setWhatsappLead(lead);
    setWhatsappChatOpen(true);
  };

  const fetchUserAndLeads = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const isAdmin = roles?.some(r => r.role === "admin");

      let query = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10000);

      // Apply company filter - null means show all companies
      const companyId = getCompanyFilter();
      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      if (!isAdmin) {
        query = query.eq("assigned_to", session.user.id);
      }

      const { data } = await query.in("status", ["paid", "verification", "documents_pending", "documents_uploaded"]);
      setLeads((data || []) as Lead[]);
    }
    setIsLoading(false);
  };

  const fetchDocuments = async (leadId: string) => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("lead_id", leadId);
    setDocuments(data || []);
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    fetchDocuments(lead.id);
    setRemarks("");
    if (isMobile) setShowMobileDetail(true);
  };

  const generateDocUploadLink = (leadId: string) => {
    // Generate a simple token for the link (in production, use a proper secure token)
    const token = btoa(`${leadId}:${Date.now()}`);
    // Use production URL for document upload
    const baseUrl = "https://credit.hariox.com";
    return `${baseUrl}/upload-documents?t=${token}`;
  };

  const handleSendDocLink = async (lead: Lead) => {
    const uploadUrl = generateDocUploadLink(lead.id);
    const message = `Dear ${lead.full_name},\n\nThank you for your payment! Please upload your documents using this secure link:\n\n${uploadUrl}\n\nRequired Documents:\n- Aadhaar Card\n- PAN Card\n- Salary Slips (3 months)\n- Form-16\n- ITR (2 years)\n- Bank Statement (6 months)\n\nThank you for choosing us!`;
    window.open(`https://wa.me/91${lead.phone}?text=${encodeURIComponent(message)}`, "_blank");
    
    // Update status to documents_pending
    await supabase
      .from("leads")
      .update({ status: "documents_pending" })
      .eq("id", lead.id);
    
    fetchUserAndLeads();
  };

  const handleCopyLink = (lead: Lead) => {
    const link = generateDocUploadLink(lead.id);
    navigator.clipboard.writeText(link);
    alert("Document upload link copied to clipboard!");
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedLead || !uploadDocType) return;
    
    setUploading(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${selectedLead.id}/${uploadDocType}_${Date.now()}.${fileExt}`;

    try {
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Create document record
      await supabase.from("documents").insert({
        lead_id: selectedLead.id,
        document_type: uploadDocType,
        file_name: file.name,
        file_url: urlData.publicUrl,
        status: "uploaded",
      });

      // Update lead status
      await supabase
        .from("leads")
        .update({ status: "documents_uploaded" })
        .eq("id", selectedLead.id);

      fetchDocuments(selectedLead.id);
      fetchUserAndLeads();
      setUploadModal(false);
      setUploadDocType("");
      alert("Document uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleVerifyDocument = async (docId: string, status: "verified" | "rejected") => {
    if (!userId) return;

    await supabase
      .from("documents")
      .update({
        status,
        verified_by: userId,
        verified_at: new Date().toISOString(),
        remarks: status === "rejected" ? remarks : null,
      })
      .eq("id", docId);

    fetchDocuments(selectedLead!.id);
    setRemarks("");
  };

  const handleVerifyLead = async (verified: boolean) => {
    if (!selectedLead || !userId) return;

    const oldStatus = selectedLead.status;
    const newStatus = verified ? "verified" : "rejected";
    
    await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", selectedLead.id);

    // Trigger workflow for status change
    triggerStatusWorkflow(selectedLead.id, oldStatus, newStatus);

    await supabase.from("activity_logs").insert({
      lead_id: selectedLead.id,
      user_id: userId,
      action: verified ? "lead_verified" : "lead_rejected",
      details: { remarks },
    });

    fetchUserAndLeads();
    setSelectedLead(null);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: "bg-blue-100 text-blue-800",
      verification: "bg-purple-100 text-purple-800",
      documents_pending: "bg-yellow-100 text-yellow-800",
      documents_uploaded: "bg-cyan-100 text-cyan-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getDocStatus = (docType: string) => {
    return documents.find(d => d.document_type === docType);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Verification Queue</h2>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredLeads.length === 0}>
              <FileSpreadsheet className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
          {/* Search & Filters */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1.5">
              <select
                className="flex-1 h-7 px-2 text-xs bg-card border border-border rounded-md outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="documents_pending">Docs Pending</option>
                <option value="documents_uploaded">Docs Uploaded</option>
                <option value="verification">Verification</option>
              </select>
              <select
                className="flex-1 h-7 px-2 text-xs bg-card border border-border rounded-md outline-none"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
          <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedLead?.id === lead.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => handleSelectLead(lead)}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">{lead.full_name}</h3>
                    <p className="text-xs text-muted-foreground truncate">+91 {lead.phone}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${getStatusColor(lead.status)}`}>
                    {lead.status.replace(/_/g, " ")}
                  </span>
                </div>
                {lead.assigned_to && (
                  <p className="text-[10px] text-green-600 mt-1 truncate">
                    ✓ {staffList.find(s => s.id === lead.assigned_to)?.full_name || "Staff"}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(lead.updated_at).toLocaleDateString("en-IN")}
                </p>
                
                {/* Quick Action Buttons - Icon only with tooltips */}
                <div className="flex gap-1 mt-2 pt-2 border-t border-border justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Call"
                    onClick={(e) => { e.stopPropagation(); handleCall(lead.phone); }}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-[#25D366] hover:text-[#20BD5A] hover:bg-green-50"
                    title="WhatsApp"
                    onClick={(e) => { e.stopPropagation(); handleWhatsApp(lead.phone, lead.full_name, lead.status === "paid" ? lead.id : undefined); }}
                  >
                    <WhatsAppIcon size="sm" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    title="SMS"
                    onClick={(e) => { e.stopPropagation(); setSmsLead(lead); setSmsDialogOpen(true); }}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    title="View Details"
                    onClick={(e) => { e.stopPropagation(); setViewDetailsLead(lead); }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
                {lead.status === "paid" && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendDocLink(lead);
                      }}
                    >
                      <WhatsAppIcon size="sm" className="mr-1" />
                      Send Link
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLink(lead);
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {filteredLeads.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery || statusFilter !== "all" || dateFilter !== "all" ? "No matching leads found" : "No leads in verification queue"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Document Verification - Desktop Only */}
      <div className="hidden lg:block lg:col-span-2 space-y-4">
        {selectedLead ? (
          <>
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{selectedLead.full_name}</h2>
                  <p className="text-muted-foreground">{selectedLead.email} • +91 {selectedLead.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium capitalize">{selectedLead.loan_type} Loan</p>
                  <p className="text-muted-foreground">₹{Number(selectedLead.loan_amount).toLocaleString("en-IN")}</p>
                </div>
              </div>

              {/* Editable Additional Fields */}
              <AdditionalLeadFields lead={selectedLead} onSaved={() => fetchUserAndLeads()} />

              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Document Checklist</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadModal(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Document
                </Button>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-3">
                {requiredDocuments.map((doc) => {
                  const uploadedDoc = getDocStatus(doc.type);
                  return (
                    <div
                      key={doc.type}
                      className={`p-4 rounded-xl border ${
                        uploadedDoc?.status === "verified"
                          ? "border-green-200 bg-green-50"
                          : uploadedDoc?.status === "rejected"
                          ? "border-red-200 bg-red-50"
                          : uploadedDoc
                          ? "border-blue-200 bg-blue-50"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">{doc.label}</span>
                        </div>
                        {uploadedDoc ? (
                          <div className="flex gap-1">
                            {uploadedDoc.status === "pending" || uploadedDoc.status === "uploaded" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    // Generate signed URL for private bucket
                                    const storagePath = uploadedDoc.file_url.replace(/^.*\/documents\//, '');
                                    const { data } = await supabase.storage
                                      .from("documents")
                                      .createSignedUrl(storagePath, 3600);
                                    if (data?.signedUrl) {
                                      window.open(data.signedUrl, "_blank");
                                    } else {
                                      window.open(uploadedDoc.file_url, "_blank");
                                    }
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600"
                                  onClick={() => handleVerifyDocument(uploadedDoc.id, "verified")}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => handleVerifyDocument(uploadedDoc.id, "rejected")}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            ) : uploadedDoc.status === "verified" ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not uploaded</span>
                        )}
                      </div>
                      {uploadedDoc?.remarks && (
                        <p className="text-xs text-red-600 mt-2">{uploadedDoc.remarks}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Show additional uploaded documents not in required list */}
              {documents.filter(d => !requiredDocuments.find(r => r.type === d.document_type)).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold mb-3">Additional Documents</h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {documents.filter(d => !requiredDocuments.find(r => r.type === d.document_type)).map((doc) => (
                      <div
                        key={doc.id}
                        className={`p-4 rounded-xl border ${
                          doc.status === "verified"
                            ? "border-green-200 bg-green-50"
                            : doc.status === "rejected"
                            ? "border-red-200 bg-red-50"
                            : "border-blue-200 bg-blue-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileCheck className="w-5 h-5 text-muted-foreground" />
                            <span className="font-medium text-sm">{doc.file_name}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => window.open(doc.file_url, "_blank")}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {doc.status !== "verified" && doc.status !== "rejected" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600"
                                  onClick={() => handleVerifyDocument(doc.id, "verified")}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => handleVerifyDocument(doc.id, "rejected")}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-semibold mb-4">Verification Decision</h3>
              <Textarea
                placeholder="Add remarks (required for rejection)..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="mb-4"
                rows={3}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleVerifyLead(false)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  onClick={() => handleVerifyLead(true)}
                  disabled={documents.length === 0 || documents.some(d => d.status !== "verified")}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve & Send to Bank
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
            Select a lead from the queue to verify documents
          </div>
        )}
      </div>
      </div>

      {/* Mobile Document Verification Sheet */}
      <Sheet open={showMobileDetail && isMobile && !!selectedLead} onOpenChange={(open) => { if (!open) setShowMobileDetail(false); }}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 overflow-hidden">
          <SheetHeader className="sticky top-0 bg-card border-b border-border p-4 flex flex-row items-center justify-between">
            <SheetTitle className="text-left">{selectedLead?.full_name || "Lead Details"}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowMobileDetail(false)}>
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-safe p-4 space-y-4">
            {selectedLead && (
              <>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-sm text-muted-foreground">{selectedLead.email} • +91 {selectedLead.phone}</p>
                  <p className="font-medium capitalize mt-1">{selectedLead.loan_type} Loan — ₹{Number(selectedLead.loan_amount).toLocaleString("en-IN")}</p>
                </div>

                {/* Editable Additional Fields - Mobile */}
                <AdditionalLeadFields lead={selectedLead} onSaved={() => fetchUserAndLeads()} />

                {/* Document Checklist */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-sm">Documents</h3>
                    <Button size="sm" variant="outline" onClick={() => setUploadModal(true)}>
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {requiredDocuments.map((doc) => {
                      const uploadedDoc = getDocStatus(doc.type);
                      return (
                        <div key={doc.type} className={`p-3 rounded-lg border ${
                          uploadedDoc?.status === "verified" ? "border-green-200 bg-green-50" :
                          uploadedDoc?.status === "rejected" ? "border-red-200 bg-red-50" :
                          uploadedDoc ? "border-blue-200 bg-blue-50" : "border-border"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{doc.label}</span>
                            {uploadedDoc ? (
                              <div className="flex gap-1">
                                {(uploadedDoc.status === "pending" || uploadedDoc.status === "uploaded") ? (
                                  <>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                                      const storagePath = uploadedDoc.file_url.replace(/^.*\/documents\//, '');
                                      const { data } = await supabase.storage.from("documents").createSignedUrl(storagePath, 3600);
                                      window.open(data?.signedUrl || uploadedDoc.file_url, "_blank");
                                    }}><Eye className="w-3.5 h-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleVerifyDocument(uploadedDoc.id, "verified")}><CheckCircle className="w-3.5 h-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => handleVerifyDocument(uploadedDoc.id, "rejected")}><XCircle className="w-3.5 h-3.5" /></Button>
                                  </>
                                ) : uploadedDoc.status === "verified" ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Not uploaded</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Verification Decision */}
                <div className="border-t border-border pt-4">
                  <h3 className="font-semibold text-sm mb-2">Decision</h3>
                  <Textarea placeholder="Remarks..." value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="mb-3" />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 text-red-600 border-red-200" onClick={() => handleVerifyLead(false)}>
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button className="flex-1" onClick={() => handleVerifyLead(true)} disabled={documents.length === 0 || documents.some(d => d.status !== "verified")}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Upload Modal */}
      <Dialog open={uploadModal} onOpenChange={setUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {requiredDocuments.map((doc) => (
                    <SelectItem key={doc.type} value={doc.type}>
                      {doc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Upload File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleManualUpload}
                className="mt-1 w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-medium hover:file:bg-primary/90"
                disabled={!uploadDocType || uploading}
              />
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</p>
            </div>
            {uploading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm">Uploading...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Details Modal */}
      {viewDetailsLead && (
        <LeadDetailsModal
          lead={viewDetailsLead}
          staffList={staffList}
          onClose={() => setViewDetailsLead(null)}
          onSaved={fetchUserAndLeads}
        />
      )}

      {/* SMS Dialog */}
      <SendSMSDialog lead={smsLead} open={smsDialogOpen} onOpenChange={setSmsDialogOpen} />

      {/* WhatsApp Direct Chat */}
      <WhatsAppDirectChat
        open={whatsappChatOpen}
        onOpenChange={setWhatsappChatOpen}
        leadPhone={whatsappLead?.phone || ""}
        leadName={whatsappLead?.full_name || ""}
        leadId={whatsappLead?.id}
      />
    </div>
  );
};

export default VerificationPanel;
