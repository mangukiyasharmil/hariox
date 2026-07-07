import { useState, useEffect, useMemo } from "react";
import { Package, Truck, Send, CheckCircle, Clock, DollarSign, FileText, XCircle, RefreshCw, Phone, User, Download, Eye, FileCheck, X, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, BankSubmission, Document } from "@/types/database";
import LeadDetailsModal from "./LeadDetailsModal";
import WhatsAppDirectChat from "./whatsapp/WhatsAppDirectChat";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// E-commerce courier partners
const courierPartners = [
  "Delhivery",
  "BlueDart",
  "FedEx",
  "DTDC",
  "India Post",
  "Ekart",
  "Shadowfax",
];

const LoginTeamPanel = () => {
  const isMobile = useIsMobile();
  const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bankSubmissions, setBankSubmissions] = useState<BankSubmission[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [remarks, setRemarks] = useState("");
  const [approvalAmount, setApprovalAmount] = useState("");
  const [bankApplicationId, setBankApplicationId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [lostModal, setLostModal] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [viewDetailsLead, setViewDetailsLead] = useState<Lead | null>(null);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [whatsappChatOpen, setWhatsappChatOpen] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let result = leads;

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

    if (statusFilter !== "all") {
      result = result.filter(l => l.status === statusFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      if (dateFilter === "today") result = result.filter(l => l.updated_at >= todayStart);
      else if (dateFilter === "week") result = result.filter(l => l.updated_at >= weekAgo);
      else if (dateFilter === "month") result = result.filter(l => l.updated_at >= monthAgo);
    }

    // Sort by updated_at descending
    result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return result;
  }, [leads, searchQuery, statusFilter, dateFilter]);

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
  
  const handleWhatsApp = (phone: string, name: string) => {
    const message = `Hello ${name}, your Hariox order is being processed. We will update you with the tracking details shortly. 📦`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
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
        .order("created_at", { ascending: false });

      // Apply company filter - null means show all companies
      const companyId = getCompanyFilter();
      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      if (!isAdmin) {
        query = query.eq("assigned_to", session.user.id);
      }

      const { data } = await query.in("status", ["verified", "processing", "approved", "disbursed", "rejected"]);
      setLeads((data || []) as Lead[]);
    }
    setIsLoading(false);
  };

  const handleMarkAsLost = async () => {
    if (!selectedLead || !userId) return;

    const oldStatus = selectedLead.status;
    
    await supabase
      .from("leads")
      .update({ status: "lost" })
      .eq("id", selectedLead.id);
    
    // Trigger workflow for lost
    triggerStatusWorkflow(selectedLead.id, oldStatus, "lost");

    await supabase.from("activity_logs").insert({
      lead_id: selectedLead.id,
      user_id: userId,
      action: "lead_marked_lost",
      details: { reason: lostReason, from_status: selectedLead.status },
    });

    setLostModal(false);
    setLostReason("");
    setSelectedLead(null);
    fetchUserAndLeads();
  };

  const fetchDocuments = async (leadId: string) => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("lead_id", leadId);
    setDocuments(data || []);
  };

  const fetchSubmissions = async (leadId: string) => {
    const { data } = await supabase
      .from("bank_submissions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setBankSubmissions(data || []);
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    fetchSubmissions(lead.id);
    fetchDocuments(lead.id);
    setSelectedBank("");
    setRemarks("");
    setApprovalAmount("");
    setBankApplicationId("");
    if (isMobile) setShowMobileDetail(true);
  };

  const handleSubmitToBank = async () => {
    if (!selectedLead || !userId || !selectedBank) return;

    await supabase.from("bank_submissions").insert({
      lead_id: selectedLead.id,
      bank_name: selectedBank,
      submitted_by: userId,
      status: "submitted",
    });

    // Update lead status to processing
    await supabase
      .from("leads")
      .update({ status: "processing" })
      .eq("id", selectedLead.id);

    await supabase.from("activity_logs").insert({
      lead_id: selectedLead.id,
      user_id: userId,
      action: "submitted_to_bank",
      details: { bank: selectedBank },
    });

    fetchSubmissions(selectedLead.id);
    fetchUserAndLeads();
    setSelectedBank("");
  };

  const handleUpdateSubmission = async (submissionId: string, status: string) => {
    if (!userId) return;

    const updateData: Partial<BankSubmission> = { status, remarks };
    
    if (status === "approved") {
      if (approvalAmount) {
        updateData.approval_amount = Number(approvalAmount);
      }
      if (bankApplicationId) {
        (updateData as Record<string, unknown>).bank_application_id = bankApplicationId;
      }
    }
    
    if (status === "disbursed") {
      updateData.disbursement_date = new Date().toISOString();
      const oldStatus = selectedLead!.status;
      // Update lead status
      await supabase
        .from("leads")
        .update({ status: "disbursed" })
        .eq("id", selectedLead!.id);
      // Trigger workflow for disbursed
      triggerStatusWorkflow(selectedLead!.id, oldStatus, "disbursed");
    } else if (status === "approved") {
      const oldStatus = selectedLead!.status;
      await supabase
        .from("leads")
        .update({ status: "approved" })
        .eq("id", selectedLead!.id);
      // Trigger workflow for approved
      triggerStatusWorkflow(selectedLead!.id, oldStatus, "approved");
    }

    await supabase
      .from("bank_submissions")
      .update(updateData)
      .eq("id", submissionId);

    fetchSubmissions(selectedLead!.id);
    fetchUserAndLeads();
    setRemarks("");
    setApprovalAmount("");
    setBankApplicationId("");
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      verified: "bg-green-100 text-green-800",
      processing: "bg-blue-100 text-blue-800",
      approved: "bg-emerald-100 text-emerald-800",
      disbursed: "bg-teal-100 text-teal-800",
      submitted: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
      lost: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
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
          <h2 className="text-lg font-semibold mb-3">Bank Processing Queue</h2>
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
                <option value="verified">Verified</option>
                <option value="processing">Processing</option>
                <option value="approved">Approved</option>
                <option value="disbursed">Disbursed</option>
                <option value="rejected">Rejected</option>
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
          <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  selectedLead?.id === lead.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => handleSelectLead(lead)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium">{lead.full_name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p className="capitalize">Product: {lead.loan_type === 'personal' ? 'Light Blue' : lead.loan_type === 'business' ? 'Pro Bundle' : lead.loan_type}</p>
                  <p className="font-medium text-foreground">${Number(lead.loan_amount).toLocaleString("en-US")} order value</p>
                  <p>+91 {lead.phone}</p>
                  {lead.assigned_to && (
                    <p className="text-xs text-green-600">
                      ✓ Assigned: {staffList.find(s => s.id === lead.assigned_to)?.full_name || "Staff"}
                    </p>
                  )}
                  <p className="text-xs mt-1">
                    Transferred: {new Date(lead.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} {new Date(lead.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                
                {/* Quick Action Buttons */}
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8"
                    onClick={(e) => { e.stopPropagation(); handleCall(lead.phone); }}
                  >
                    <Phone className="w-3.5 h-3.5 mr-1" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 text-[#25D366] hover:text-[#20BD5A]"
                    onClick={(e) => { e.stopPropagation(); handleWhatsApp(lead.phone, lead.full_name); }}
                  >
                    <WhatsAppIcon size="xs" className="mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8"
                    onClick={(e) => { e.stopPropagation(); setViewDetailsLead(lead); }}
                  >
                    <User className="w-3.5 h-3.5 mr-1" />
                    Details
                  </Button>
                </div>
              </div>
            ))}
            {filteredLeads.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery || statusFilter !== "all" || dateFilter !== "all" ? "No matching leads found" : "No orders ready for fulfillment"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bank Submissions - Desktop Only */}
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
                  <p className="font-medium capitalize">Product: {selectedLead.loan_type === 'personal' ? 'Light Blue' : selectedLead.loan_type === 'business' ? 'Pro Bundle' : selectedLead.loan_type}</p>
                  <p className="text-2xl font-bold text-primary">${Number(selectedLead.loan_amount).toLocaleString("en-US")} <span className="text-sm font-normal text-muted-foreground">order value</span></p>
                </div>
              </div>

              {/* Documents Section */}
              <Collapsible open={showDocuments} onOpenChange={setShowDocuments} className="mb-6">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4" />
                      <span>View Documents ({documents.length})</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{showDocuments ? "Hide" : "Show"}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className={`p-3 rounded-lg border ${
                          doc.status === "verified" ? "border-green-200 bg-green-50" :
                          doc.status === "rejected" ? "border-red-200 bg-red-50" :
                          "border-border bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">{doc.document_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              doc.status === "verified" ? "bg-green-100 text-green-700" :
                              doc.status === "rejected" ? "bg-red-100 text-red-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {doc.status}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                // Generate signed URL for private bucket
                                const { data } = await supabase.storage
                                  .from("documents")
                                  .createSignedUrl(doc.file_url.replace(/^.*\/documents\//, ''), 3600);
                                if (data?.signedUrl) {
                                  window.open(data.signedUrl, "_blank");
                                } else {
                                  // Fallback to direct URL
                                  window.open(doc.file_url, "_blank");
                                }
                              }}
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                // Generate signed URL for download
                                const { data } = await supabase.storage
                                  .from("documents")
                                  .createSignedUrl(doc.file_url.replace(/^.*\/documents\//, ''), 3600);
                                if (data?.signedUrl) {
                                  const a = document.createElement("a");
                                  a.href = data.signedUrl;
                                  a.download = doc.file_name;
                                  a.target = "_blank";
                                  a.click();
                                }
                              }}
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <p className="col-span-2 text-center text-muted-foreground py-4">No documents uploaded</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Submit to Bank */}
              {selectedLead.status === "verified" && (
                <div className="bg-muted/50 rounded-xl p-4 mb-6">
                  <h3 className="font-semibold mb-3">Dispatch Order</h3>
                  <div className="flex gap-3">
                    <select
                      className="flex-1 px-4 py-2 rounded-lg border border-input bg-background"
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                    >
                      <option value="">Select Courier Partner</option>
                      {courierPartners.map((courier) => (
                        <option key={courier} value={courier}>{courier}</option>
                      ))}
                    </select>
                    <Button onClick={handleSubmitToBank} disabled={!selectedBank}>
                      <Package className="w-4 h-4 mr-2" />
                      Dispatch
                    </Button>
                  </div>
                </div>
              )}

              {/* Submissions History */}
              <h3 className="font-semibold mb-4">Courier Dispatches</h3>
              <div className="space-y-3">
                {bankSubmissions.map((sub) => (
                  <div key={sub.id} className="p-4 rounded-xl border border-border">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-primary" />
                        <span className="font-medium">{sub.bank_name}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                        {sub.status === 'submitted' ? 'Dispatched' : sub.status === 'approved' ? 'Shipped' : sub.status === 'disbursed' ? 'Delivered' : sub.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      <p>Submitted: {new Date(sub.submission_date).toLocaleDateString("en-IN")}</p>
                      {(sub as unknown as Record<string, unknown>).bank_application_id && (
                        <p className="text-blue-600">Tracking Number: {(sub as unknown as Record<string, unknown>).bank_application_id as string}</p>
                      )}
                      {sub.approval_amount && (
                        <p className="text-green-600 font-medium">Package Weight (kg): {Number(sub.approval_amount).toLocaleString("en-US")}</p>
                      )}
                      {sub.disbursement_date && (
                        <p className="text-teal-600">Delivered: {new Date(sub.disbursement_date).toLocaleDateString("en-IN")}</p>
                      )}
                    </div>

                    {sub.status === "submitted" && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Tracking Number"
                          value={bankApplicationId}
                          onChange={(e) => setBankApplicationId(e.target.value)}
                        />
                        <Input
                          placeholder="Package Weight (kg)"
                          type="number"
                          value={approvalAmount}
                          onChange={(e) => setApprovalAmount(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 flex-1"
                            onClick={() => handleUpdateSubmission(sub.id, "rejected")}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Rejected
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 flex-1"
                            onClick={() => handleUpdateSubmission(sub.id, "approved")}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approved
                          </Button>
                        </div>
                      </div>
                    )}

                    {sub.status === "rejected" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            // Reset lead status to verified to allow new bank submission
                            const { error } = await supabase
                              .from("leads")
                              .update({ status: "verified" })
                              .eq("id", selectedLead!.id);
                            
                            if (error) {
                              console.error("Error resetting lead status:", error);
                              return;
                            }
                            
                            // Update the selected lead locally to show Submit to Bank section
                            setSelectedLead(prev => prev ? { ...prev, status: "verified" } : null);
                            setSelectedBank("");
                            
                            // Refetch leads list
                            fetchUserAndLeads();
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                           Return to Review
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-600"
                          onClick={() => setLostModal(true)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Mark as Lost
                        </Button>
                      </div>
                    )}

                    {sub.status === "approved" && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Package Weight (kg)"
                          type="number"
                          value={approvalAmount}
                          onChange={(e) => setApprovalAmount(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="hero"
                          className="w-full"
                          onClick={() => handleUpdateSubmission(sub.id, "disbursed")}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Mark Delivered
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {bankSubmissions.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No bank submissions yet
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
            Select a lead to manage bank submissions
          </div>
        )}
      </div>
      </div>

      {/* Mobile Detail Sheet */}
      <Sheet open={showMobileDetail && isMobile && !!selectedLead} onOpenChange={(open) => { if (!open) setShowMobileDetail(false); }}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 overflow-hidden">
          <SheetHeader className="sticky top-0 bg-card border-b border-border p-4 flex flex-row items-center justify-between">
            <SheetTitle className="text-left">{selectedLead?.full_name || "Lead"}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowMobileDetail(false)}>
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-safe p-4 space-y-4">
            {selectedLead && (
              <>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-sm text-muted-foreground">{selectedLead.email} • +91 {selectedLead.phone}</p>
                  <p className="font-medium capitalize mt-1">Product: {selectedLead.loan_type === 'personal' ? 'Light Blue' : selectedLead.loan_type === 'business' ? 'Pro Bundle' : selectedLead.loan_type} — ${Number(selectedLead.loan_amount).toLocaleString("en-US")} order value</p>
                </div>

                {/* Submit to Bank */}
                {selectedLead.status === "verified" && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <h3 className="font-semibold text-sm mb-2">Dispatch Order</h3>
                    <select className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm mb-2" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
                      <option value="">Select Courier Partner</option>
                      {courierPartners.map((courier) => (<option key={courier} value={courier}>{courier}</option>))}
                    </select>
                    <Button onClick={handleSubmitToBank} disabled={!selectedBank} size="sm" className="w-full">
                      <Package className="w-3.5 h-3.5 mr-1" />Dispatch
                    </Button>
                  </div>
                )}

                {/* Bank Submissions */}
                <div>
                  <h3 className="font-semibold text-sm mb-2">Courier Dispatches</h3>
                  <div className="space-y-2">
                    {bankSubmissions.map((sub) => (
                      <div key={sub.id} className="p-3 rounded-xl border border-border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-sm">{sub.bank_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(sub.status)}`}>{sub.status === 'submitted' ? 'Dispatched' : sub.status === 'approved' ? 'Shipped' : sub.status === 'disbursed' ? 'Delivered' : sub.status}</span>
                        </div>
                        {sub.status === "submitted" && (
                          <div className="space-y-2">
                            <Input placeholder="Tracking Number" value={bankApplicationId} onChange={(e) => setBankApplicationId(e.target.value)} className="h-8 text-sm" />
                            <Input placeholder="Package Weight (kg)" type="number" value={approvalAmount} onChange={(e) => setApprovalAmount(e.target.value)} className="h-8 text-sm" />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 text-red-600" onClick={() => handleUpdateSubmission(sub.id, "rejected")}>Rejected</Button>
                              <Button size="sm" variant="outline" className="flex-1 text-green-600" onClick={() => handleUpdateSubmission(sub.id, "approved")}>Approved</Button>
                            </div>
                          </div>
                        )}
                        {sub.status === "approved" && (
                          <Button size="sm" className="w-full mt-2" onClick={() => handleUpdateSubmission(sub.id, "disbursed")}>
                            <Package className="w-3.5 h-3.5 mr-1" />Mark Delivered
                          </Button>
                        )}
                        {sub.status === "rejected" && (
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="outline" className="flex-1" onClick={async () => {
                              await supabase.from("leads").update({ status: "verified" }).eq("id", selectedLead!.id);
                              setSelectedLead(prev => prev ? { ...prev, status: "verified" } : null);
                              fetchUserAndLeads();
                            }}>
                              <RefreshCw className="w-3 h-3 mr-1" />Return to Review
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 text-gray-600" onClick={() => setLostModal(true)}>
                              <XCircle className="w-3 h-3 mr-1" />Lost
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {bankSubmissions.length === 0 && <p className="text-center text-muted-foreground text-xs py-4">No submissions yet</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Lost Lead Modal */}
      <Dialog open={lostModal} onOpenChange={setLostModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Order as Returned</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              This will move the lead to "Lost" status. Please provide a reason.
            </p>
            <Textarea
              placeholder="Return reason..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLostModal(false)} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={handleMarkAsLost} disabled={!lostReason.trim()} className="flex-1">
                <XCircle className="w-4 h-4 mr-2" />Mark Returned
              </Button>
            </div>
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

export default LoginTeamPanel;
