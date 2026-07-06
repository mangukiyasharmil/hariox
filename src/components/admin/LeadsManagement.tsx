import { useState, useEffect, useMemo } from "react";
import { Search, Download, Eye, Plus, Phone, ArrowRight, Calendar, Trash2, CheckSquare, Square, IndianRupee, ArrowRightLeft, User, UserX, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/database";
import LeadDetailsModal from "./LeadDetailsModal";
import AddLeadDialog from "./AddLeadDialog";
import ManualPaymentDialog from "./ManualPaymentDialog";
import PasswordConfirmDialog from "./PasswordConfirmDialog";
import LeadTransferDialog from "./LeadTransferDialog";
import DateFilterSelect from "./DateFilterSelect";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Skeleton, TableRowSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "@/hooks/useRealtimeLeads";

// Helper to format lead source to friendly subdomain name
const formatLeadSource = (source: string | null | undefined): string => {
  if (!source) return "Website";
  
  const s = source.toLowerCase();
  
  // Map known sources to friendly names
  if (s.includes("capital") || s.includes("capital.hariox")) return "Capital";
  if (s.includes("finance") || s.includes("finance.hariox")) return "Finance";
  if (s.includes("credit") || s.includes("hariox")) return "Credit";
  if (s === "website" || s === "website-otp") return "Credit";
  if (s.includes("telecaller")) return "Telecaller";
  if (s.includes("marketing")) return "Marketing";
  if (s.includes("whatsapp")) {
    if (s.includes("capital")) return "WhatsApp (Capital)";
    if (s.includes("finance")) return "WhatsApp (Finance)";
    return "WhatsApp (Credit)";
  }
  
  // Default: capitalize first letter
  return source.charAt(0).toUpperCase() + source.slice(1);
};

// Extended lead type with profile info
interface LeadWithProfile extends Lead {
  profiles?: { full_name: string } | null;
  state: string | null;
  cibil_score_range: string | null;
  assignedStaffName?: string | null;
}

const LeadsManagement = () => {
  const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
  const { applyCompanyFilter } = useCompanyFilter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState<"all" | "with_name" | "without_name">("all");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [telecallerFilter, setTelecallerFilter] = useState<string>("all");
  const [staffList, setStaffList] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithProfile | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkTransferDialog, setShowBulkTransferDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentLeadId, setPaymentLeadId] = useState<string>("");
  const [paymentLeadName, setPaymentLeadName] = useState<string>("");
  
  // Use the date filter hook
  const { dateRange, setDateRange, customStart, customEnd, setCustomStart, setCustomEnd, startDateISO, endDateISO } = useDateFilter("today");

  // Realtime sync — auto-refresh when any lead changes across devices
  useRealtimeSync();

  // Debounce search input
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    fetchStaff();
  }, []);

  const companyId = getCompanyFilter();

  // React Query for leads — cached, deduped, auto-refreshed via realtime
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads", statusFilter, sourceFilter, dateRange, customStart, customEnd, telecallerFilter, companyId, showAllCompanies, debouncedSearch],
    queryFn: async () => {
      const hasSearch = debouncedSearch.length > 0;
      const phoneDigits = debouncedSearch.replace(/\D/g, "");

      let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500);

      // Use shared company filter (includes company_id IS NULL for hariox)
      query = applyCompanyFilter(query);

      if (statusFilter === "all") {
        // Show all
      } else if (statusFilter === "docs") {
        query = query.in("status", ["verification", "documents_pending", "documents_uploaded"]);
      } else if (statusFilter === "processing") {
        query = query.in("status", ["processing", "approved"]);
      } else {
        query = query.eq("status", statusFilter as Lead["status"]);
      }

      if (telecallerFilter === "unassigned") {
        query = query.is("assigned_to", null);
      } else if (telecallerFilter !== "all") {
        query = query.eq("assigned_to", telecallerFilter);
      }

      if (sourceFilter !== "all") {
        if (sourceFilter === "website") {
          query = query.or("source.ilike.%website%,source.is.null");
        } else if (sourceFilter === "whatsapp") {
          query = query.ilike("source", "%whatsapp%");
        } else if (sourceFilter === "telecaller") {
          query = query.ilike("source", "%telecaller%");
        } else if (sourceFilter === "sms") {
          query = query.ilike("source", "%sms%");
        } else if (sourceFilter === "exit_intent") {
          query = query.eq("source", "exit_intent_popup");
        }
      }

      if (hasSearch) {
        query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
        query = applyCompanyFilter(query);

        if (phoneDigits.length >= 8) {
          const phoneKey = phoneDigits.slice(-10);
          query = query.ilike("phone", `%${phoneKey}%`);
        } else {
          const safe = debouncedSearch.replace(/[(),]/g, " ").trim();
          if (safe) {
            query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
          }
        }
      }

      if (!hasSearch && dateRange !== "all") {
        query = query.gte("created_at", startDateISO).lte("created_at", endDateISO);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch only relevant profiles for assigned staff
      const assignedIds = [...new Set((data || []).map(l => l.assigned_to).filter(Boolean))];
      let profileMap = new Map<string, string>();
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", assignedIds);
        profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      }

      return (data || []).map(lead => ({
        ...lead,
        assignedStaffName: lead.assigned_to ? profileMap.get(lead.assigned_to) || null : null,
      })) as LeadWithProfile[];
    },
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const leads = leadsData || [];

  const fetchStaff = async () => {
    try {
      // Get all staff user IDs and roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["telecaller", "verification", "login_team"]);

      if (rolesError || !roles) {
        console.error("Error fetching roles:", rolesError);
        return;
      }

      // Get profiles for these users
      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return;
      }

      // Map profiles to roles
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      
      setStaffList(
        roles.map((r) => ({
          id: r.user_id,
          full_name: profileMap.get(r.user_id) || "Unknown",
          role: r.role,
        }))
      );
    } catch (error) {
      console.error("Error in fetchStaff:", error);
    }
  };

  const refetchLeads = () => queryClient.invalidateQueries({ queryKey: ["leads"] });

  const handleAssign = async (leadId: string, staffId: string) => {
    const { error } = await supabase.from("leads").update({ assigned_to: staffId || null }).eq("id", leadId);
    if (!error) refetchLeads();
  };

  const handleDelete = async (leadId: string) => {
    setLeadToDelete(leadId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!leadToDelete) return;
    const { error } = await supabase.from("leads").delete().eq("id", leadToDelete);
    if (!error) {
      toast.success("Lead deleted successfully");
      refetchLeads();
    } else {
      console.error("Delete lead failed:", error);
      toast.error(`Failed to delete lead: ${error.message}`);
    }
    setShowDeleteDialog(false);
    setLeadToDelete(null);
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    
    const { error } = await supabase.from("leads").delete().in("id", selectedLeadIds);
    if (!error) {
      toast.success(`${selectedLeadIds.length} leads deleted successfully`);
      refetchLeads();
    } else {
      console.error("Bulk delete failed:", error);
      toast.error(`Failed to delete leads: ${error.message}`);
    }
    setShowBulkDeleteDialog(false);
    setSelectedLeadIds([]);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleCall = (phone: string) => window.open(`tel:+91${phone}`, "_self");
  const handleWhatsApp = (phone: string, name: string) => {
    const companyName = currentCompany?.name || "Credit Hariox";
    const message = `Hello ${name}, this is ${companyName}. We received your loan application and would like to assist you.`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const exportLeadsCSV = () => {
    if (filteredLeads.length === 0) {
      toast.error("No leads to export");
      return;
    }

    // CSV header
    let csv = "Customer Export - " + (currentCompany?.name || "All Companies") + "\n";
    csv += "Generated: " + new Date().toLocaleString("en-IN") + "\n\n";
    csv += "Full Name,Email,Phone,City,State,Product,Order Value,Shopify Order ID,Status,Source,Assigned To,Created At\n";

    // CSV rows
    filteredLeads.forEach((lead) => {
      const productLabel = lead.loan_type === 'personal' ? 'Hariox Light Blue' 
        : lead.loan_type === 'business' ? 'Pro Bundle' 
        : lead.loan_type === 'home' ? 'Starter Pack' 
        : lead.loan_type === 'marriage' ? 'Custom Branding' 
        : lead.loan_type;

      const row = [
        `"${lead.full_name || ""}"`,
        `"${lead.email || ""}"`,
        `"${lead.phone || ""}"`,
        `"${lead.city || ""}"`,
        `"${lead.state || ""}"`,
        `"${productLabel || ""}"`,
        `$${lead.loan_amount || 129}`,
        `"${lead.application_id || ""}"`,
        `"${lead.status === 'unpaid' ? 'Pending Lead' : lead.status === 'paid' ? 'Active Customer' : lead.status?.replace(/_/g, " ") || ""}"`,
        `"${formatLeadSource(lead.source)}"`,
        `"${lead.assignedStaffName || "Unassigned"}"`,
        `"${new Date(lead.created_at).toLocaleString("en-IN")}"`,
      ];
      csv += row.join(",") + "\n";
    });

    // Create and download file
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `customers-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast.success(`Exported ${filteredLeads.length} customers`);
  };

  const filteredLeads = leads.filter((lead) => {
    const fullName = (lead.full_name || "").toLowerCase();
    const email = (lead.email || "").toLowerCase();
    const phone = lead.phone || "";
    const term = searchTerm.trim().toLowerCase();

    const matchesSearch = term.length === 0
      ? true
      : fullName.includes(term) || email.includes(term) || phone.includes(term.replace(/\D/g, "")) || phone.includes(term);

    const matchesNameFilter = nameFilter === "all"
      ? true
      : nameFilter === "with_name"
        ? (lead.full_name || "").trim().length > 0
        : (lead.full_name || "").trim().length === 0;

    return matchesSearch && matchesNameFilter;
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, sourceFilter, nameFilter, telecallerFilter, searchTerm, dateRange, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const paginatedLeads = pageSize === 0 ? filteredLeads : filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      verification: "bg-purple-100 text-purple-800",
      documents_pending: "bg-orange-100 text-orange-800",
      documents_uploaded: "bg-cyan-100 text-cyan-800",
      verified: "bg-emerald-100 text-emerald-800",
      rejected: "bg-red-100 text-red-800",
      processing: "bg-indigo-100 text-indigo-800",
      approved: "bg-teal-100 text-teal-800",
      disbursed: "bg-blue-100 text-blue-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      unpaid: "Pending Lead",
      paid: "Active Customer",
      verification: "Verification",
      documents_pending: "Docs Pending",
      documents_uploaded: "Docs Uploaded",
      verified: "Verified",
      rejected: "Rejected",
      processing: "Processing",
      approved: "Approved",
      disbursed: "Onboarded",
    };
    return labels[status] || status.replace(/_/g, " ");
  };

  // Simplified status groupings for easier filtering
  const statusGroups = [
    { value: "all", label: "All Status" },
    { value: "unpaid", label: "Pending Leads" },
    { value: "paid", label: "Active Customers" },
    { value: "docs", label: "Onboarding Pending" }, 
    { value: "verified", label: "Verified" },
    { value: "processing", label: "Processing" }, 
    { value: "disbursed", label: "Onboarded" },
    { value: "rejected", label: "Rejected" },
  ];

  const statuses = ["all", "unpaid", "paid", "verification", "documents_pending", "documents_uploaded", "verified", "rejected", "processing", "approved", "disbursed"];

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <DateFilterSelect
            dateRange={dateRange}
            setDateRange={setDateRange}
            customStart={customStart}
            customEnd={customEnd}
            setCustomStart={setCustomStart}
            setCustomEnd={setCustomEnd}
            showYesterday
          />
          <select className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs sm:text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusGroups.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
            {[
              { key: "all", label: "All", icon: null },
              { key: "with_name", label: "Named", icon: User },
              { key: "without_name", label: "Draft", icon: UserX },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setNameFilter(f.key as any)}
                className={`px-1.5 py-1 rounded text-[10px] sm:text-xs font-medium flex items-center gap-0.5 ${nameFilter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {f.icon && <f.icon className="w-3 h-3" />}
                {f.label}
              </button>
            ))}
          </div>
          <select className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs sm:text-sm max-w-[140px]" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="website">Website</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telecaller">Telecaller</option>
            <option value="sms">SMS</option>
            <option value="exit_intent">Exit Popup</option>
          </select>
          <select className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs sm:text-sm max-w-[140px]" value={telecallerFilter} onChange={(e) => setTelecallerFilter(e.target.value)}>
            <option value="all">All Staff</option>
            <option value="unassigned">Unassigned</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search leads..." className="pl-9 h-9 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {/* Pagination Controls */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <select
              className="px-2 py-1 rounded border border-input bg-background text-xs"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
            <span className="hidden sm:inline">of {filteredLeads.length}</span>
          </div>
          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs px-1">{currentPage}/{totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {selectedLeadIds.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowBulkTransferDialog(true)}>
                <ArrowRightLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Transfer ({selectedLeadIds.length})</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Delete ({selectedLeadIds.length})</span>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportLeadsCSV} className="hidden sm:flex"><Download className="w-4 h-4 mr-1" />Export</Button>
          <Button variant="hero" size="sm" onClick={() => setShowAddDialog(true)}><Plus className="w-4 h-4" /><span className="hidden sm:inline ml-1">Add</span></Button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No leads found</div>
        ) : (
          paginatedLeads.map((lead) => (
            <div key={lead.id} className="bg-card rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleLeadSelection(lead.id)} className="shrink-0">
                    {selectedLeadIds.includes(lead.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{lead.full_name || "No Name"}</p>
                    <p className="text-[11px] text-muted-foreground">{lead.phone?.replace(/\D/g, "").slice(-10)}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize shrink-0 ${getStatusColor(lead.status)}`}>
                  {lead.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">
                  {(lead.loan_type === 'personal' ? 'Hariox Light Blue' : lead.loan_type === 'business' ? 'Pro Bundle' : lead.loan_type === 'home' ? 'Starter Pack' : lead.loan_type === 'marriage' ? 'Custom Branding' : lead.loan_type)} • ${lead.loan_amount || 129}
                </span>
                <span>{new Date(lead.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {lead.assignedStaffName || "Unassigned"} • {formatLeadSource(lead.source)}
                  {lead.application_id && ` • Shopify: ${lead.application_id}`}
                </span>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCall(lead.phone)}><Phone className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleWhatsApp(lead.phone, lead.full_name)}><WhatsAppIcon size="sm" className="text-[#25D366]" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedLead(lead)}><Eye className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">
                  <button onClick={toggleSelectAll} className="flex items-center gap-2">
                    {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Product Details</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Source</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Assigned To</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Created</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No leads found</td></tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr key={lead.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-4">
                      <button onClick={() => toggleLeadSelection(lead.id)}>
                        {selectedLeadIds.includes(lead.id) ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <p className="font-medium">{lead.full_name}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone?.replace(/\D/g, "").slice(-10)}</p>
                      <p className="text-xs text-muted-foreground">{lead.city}{lead.state ? `, ${lead.state}` : ""}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium capitalize">
                        {(lead.loan_type === 'personal' ? 'Hariox Light Blue' : lead.loan_type === 'business' ? 'Pro Bundle' : lead.loan_type === 'home' ? 'Starter Pack' : lead.loan_type === 'marriage' ? 'Custom Branding' : lead.loan_type)}
                      </p>
                      <p className="text-sm font-semibold text-primary">${lead.loan_amount || 129}</p>
                      {lead.application_id && (
                        <p className="text-xs text-blue-600 font-semibold">Shopify ID: {lead.application_id}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(lead.status)}`}>
                        {getStatusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{formatLeadSource(lead.source)}</td>
                    <td className="p-4">
                      <select 
                        className="text-sm px-2 py-1.5 rounded border border-input bg-background min-w-[160px] font-medium" 
                        value={lead.assigned_to || ""} 
                        onChange={(e) => handleAssign(lead.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {staffList.map((s) => {
                          const roleLabel = s.role === 'telecaller' ? 'Telecaller' 
                            : s.role === 'verification' ? 'Verification' 
                            : s.role === 'login_team' ? 'Login Team' 
                            : s.role;
                          return (
                            <option key={s.id} value={s.id}>
                              {s.full_name} ({roleLabel})
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {new Date(lead.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      <br />
                      <span className="text-muted-foreground">
                        {new Date(lead.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" title="Call" onClick={() => handleCall(lead.phone)}><Phone className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" title="WhatsApp" onClick={() => handleWhatsApp(lead.phone, lead.full_name)}><WhatsAppIcon size="sm" className="text-[#25D366]" /></Button>
                        {lead.status === "unpaid" && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Mark Paid"
                            className="text-green-600"
                            onClick={() => {
                              setPaymentLeadId(lead.id);
                              setPaymentLeadName(lead.full_name);
                              setShowPaymentDialog(true);
                            }}
                          >
                            <IndianRupee className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" title="View" onClick={() => setSelectedLead(lead)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" title="Delete" onClick={() => handleDelete(lead.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Lead Details Modal */}
      {selectedLead && (
        <LeadDetailsModal lead={selectedLead} staffList={staffList} onClose={() => setSelectedLead(null)} onSaved={refetchLeads} />
      )}

      {/* Add Lead Dialog */}
      <AddLeadDialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} onSuccess={refetchLeads} />

      {/* Delete Confirmation Dialog with Password */}
      <PasswordConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete Lead"
        description="Enter admin password to confirm deletion. This action cannot be undone."
      />

      {/* Bulk Delete Confirmation Dialog with Password */}
      <PasswordConfirmDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedLeadIds.length} Leads`}
        description={`Enter admin password to delete ${selectedLeadIds.length} leads. This action cannot be undone.`}
      />

      {/* Bulk Transfer Dialog */}
      <LeadTransferDialog
        open={showBulkTransferDialog}
        onOpenChange={setShowBulkTransferDialog}
        leadIds={selectedLeadIds}
        staffList={staffList}
        onTransferred={() => {
          setSelectedLeadIds([]);
          refetchLeads();
        }}
      />

      {/* Manual Payment Dialog */}
      <ManualPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        leadId={paymentLeadId}
        leadName={paymentLeadName}
        onSuccess={refetchLeads}
      />
    </div>
  );
};

export default LeadsManagement;
