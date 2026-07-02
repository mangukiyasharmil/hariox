import { useState, useEffect, useCallback } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeLeads";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, IndianRupee, User, UserX, XCircle, Filter, Star, Clock, Calendar, X, Search, MessageSquare, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/database";
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
import SendSMSDialog from "./SendSMSDialog";
import CallTrackingDialog from "./CallTrackingDialog";
import LeadCard from "./LeadCard";
import ManualPaymentDialog from "./ManualPaymentDialog";
import WhatsAppDirectChat from "./whatsapp/WhatsAppDirectChat";
import DateFilterSelect from "./DateFilterSelect";
import { useDateFilter } from "@/hooks/useDateFilter";
import { LeadCardSkeleton } from "@/components/ui/skeleton";

import { useIsMobile } from "@/hooks/use-mobile";

type LeadFilter = "fresh" | "interested" | "active" | "lost" | "retry";
type ViewMode = "grid" | "list";
type NameFilter = "all" | "with_name" | "without_name";

const TelecallerPanel = () => {
  const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
  const isMobile = useIsMobile();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<LeadFilter>("fresh");
  const [nameFilter, setNameFilter] = useState<NameFilter>("all");
  const [followUpModal, setFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsLead, setSmsLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [callTrackingOpen, setCallTrackingOpen] = useState(false);
  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLead, setPaymentLead] = useState<Lead | null>(null);
  const [whatsappChatOpen, setWhatsappChatOpen] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  
  const queryClient = useQueryClient();
  
  // Date filter hook — default to "all" so telecallers see all their assigned leads
  const { dateRange, setDateRange, customStart, customEnd, setCustomStart, setCustomEnd, startDateISO, endDateISO } = useDateFilter("all");

  // Realtime sync — auto-refresh across devices
  useRealtimeSync([["telecaller-leads"]]);

  // Get user info once
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", session.user.id);
        setIsAdmin(roles?.some(r => r.role === "admin") || false);
      }
    });
  }, []);

  // React Query for leads — cached, deduped, auto-refresh
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["telecaller-leads", filter, currentCompany?.id, showAllCompanies, dateRange, customStart, customEnd, userId, isAdmin],
    enabled: !!userId,
    queryFn: async () => {
      // Handle retry filter separately
      if (filter === "retry") {
        // Get call logs with failed outcomes
        let callQuery = supabase
          .from("call_logs")
          .select("lead_id, outcome, created_at")
          .in("outcome", ["busy", "no_answer", "switched_off"]);

        // Apply date filter for retry tab
        if (dateRange !== "all") {
          callQuery = callQuery.gte("created_at", startDateISO).lte("created_at", endDateISO);
        }

        // Non-admins only see their own calls
        if (!isAdmin) {
          callQuery = callQuery.eq("caller_id", userId!);
        }

        // Always fetch most recent call logs first to avoid losing active leads
        // (oldest logs often belong to already-lost/paid leads that get filtered out)
        callQuery = callQuery.order("created_at", { ascending: false }).limit(5000);

        const { data: failedCalls, error: callError } = await callQuery;
        
        if (callError) {
          console.error("[retry] Error fetching call logs:", callError);
          return [];
        }

        if (failedCalls && failedCalls.length > 0) {
          const uniqueLeadIds = [...new Set(failedCalls.map(c => c.lead_id))];
          
          // Split into batches of 100 to avoid query limits
          const allLeads: Lead[] = [];
          for (let i = 0; i < uniqueLeadIds.length; i += 100) {
            const batch = uniqueLeadIds.slice(i, i + 100);
            let query = supabase.from("leads").select("*")
              .in("id", batch)
              .neq("status", "lost")
              .neq("status", "paid");
            const companyId = getCompanyFilter();
            if (companyId) query = query.eq("company_id", companyId);
            // For non-admins, only show leads assigned to them
            if (!isAdmin) query = query.eq("assigned_to", userId!);
            const { data } = await query;
            if (data) allLeads.push(...(data as Lead[]));
          }
          // Sort oldest first so overdue follow-ups appear at top
          allLeads.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return allLeads;
        }
        return [];
      }

      let query = supabase.from("leads").select("*")
        .order("created_at", { ascending: false }).limit(5000);

      if (dateRange !== "all") {
        query = query.gte("created_at", startDateISO).lte("created_at", endDateISO);
      }
      const companyId = getCompanyFilter();
      if (companyId) query = query.eq("company_id", companyId);
      if (!isAdmin) query = query.eq("assigned_to", userId!);

      if (filter === "fresh") {
        query = query.eq("status", "unpaid").or("is_interested.is.null,is_interested.eq.false");
      } else if (filter === "interested") {
        query = query.eq("is_interested", true).neq("status", "lost");
      } else if (filter === "active") {
        query = query.in("status", ["unpaid", "paid"]).neq("status", "lost");
      } else if (filter === "lost") {
        query = query.eq("status", "lost").limit(200);
      }

      // For fresh filter: exclude leads that were contacted today OR have failed call attempts (retry leads)
      if (filter === "fresh") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        // Fetch contacted-today calls and all failed calls in parallel
        const [contactedRes, failedRes] = await Promise.all([
          supabase.from("call_logs").select("lead_id")
            .eq("caller_id", userId!)
            .eq("outcome", "contacted")
            .gte("created_at", todayStart.toISOString()),
          supabase.from("call_logs").select("lead_id")
            .eq("caller_id", userId!)
            .in("outcome", ["busy", "no_answer", "switched_off"]),
        ]);
        
        const contactedTodayIds = new Set((contactedRes.data || []).map(c => c.lead_id));
        const retryLeadIds = new Set((failedRes.data || []).map(c => c.lead_id));
        
        if (contactedTodayIds.size > 0 || retryLeadIds.size > 0) {
          const { data } = await query;
          return ((data || []) as Lead[]).filter(lead => 
            !contactedTodayIds.has(lead.id) && !retryLeadIds.has(lead.id)
          );
        }
      }

      const { data } = await query;
      return (data || []) as Lead[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const handleCall = (lead: Lead) => {
    setCallLead(lead);
    setCallTrackingOpen(true);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const companyName = currentCompany?.name || "Credit Hariox";
    const slug = currentCompany?.slug || "hariox";
    const domainMap: Record<string, string> = {
      hariox: "https://credit.hariox.com",
      finance: "https://finance.hariox.com",
      capital: "https://capital.hariox.com",
    };
    const paymentLink = `${domainMap[slug] || "https://credit.hariox.com"}/telecaller`;
    const message = `Hello ${name},

Thank you for showing interest in our loan services!

🏦 *${companyName}* is here to help you get your loan approved quickly.

📋 *Next Step:* Complete your ₹799 consultation fee payment to start the process.

💳 *Pay Now:* ${paymentLink}

✅ 30+ Partner Banks
✅ Quick Approval
✅ 24hr Disbursal

For any queries, feel free to reply to this message.`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleWhatsAppAPI = (lead: Lead) => {
    setWhatsappLead(lead);
    setWhatsappChatOpen(true);
  };

  const handleLogCall = async () => {
    if (!selectedLead || !userId) return;

    await supabase.from("call_logs").insert({
      lead_id: selectedLead.id,
      caller_id: userId,
      notes: callNotes,
      outcome: "contacted",
    });

    await supabase.from("activity_logs").insert({
      lead_id: selectedLead.id,
      user_id: userId,
      action: "call_logged",
      details: { notes: callNotes },
    });

    setCallNotes("");
    alert("Call logged successfully!");
  };

  const handleMarkAsInterested = async (lead: Lead) => {
    if (!userId) return;
    
    await supabase
      .from("leads")
      .update({ is_interested: true } as any)
      .eq("id", lead.id);

    await supabase.from("activity_logs").insert({
      lead_id: lead.id,
      user_id: userId,
      action: "marked_interested",
      details: {},
    });

    queryClient.invalidateQueries({ queryKey: ["telecaller-leads"] });
  };

  const handleSetFollowUp = async () => {
    if (!selectedLead || !userId || !followUpDate) return;

    await supabase
      .from("leads")
      .update({ 
        follow_up_date: followUpDate,
        follow_up_notes: followUpNotes,
        is_interested: true,
      } as any)
      .eq("id", selectedLead.id);

    await supabase.from("activity_logs").insert({
      lead_id: selectedLead.id,
      user_id: userId,
      action: "follow_up_scheduled",
      details: { date: followUpDate, notes: followUpNotes },
    });

    setFollowUpModal(false);
    setFollowUpDate("");
    setFollowUpNotes("");
    queryClient.invalidateQueries({ queryKey: ["telecaller-leads"] });
    alert("Follow-up scheduled!");
  };

  const handleMarkAsPaid = (lead: Lead) => {
    setPaymentLead(lead);
    setPaymentDialogOpen(true);
  };

  const handleMarkAsLost = async (leadId: string) => {
    if (!userId) {
      console.error("[handleMarkAsLost] No userId available");
      alert("Error: User session not found. Please refresh the page.");
      return;
    }
    
    if (!confirm("Mark this lead as lost? It will be hidden from the main list.")) return;
    
    console.log(`[handleMarkAsLost] Updating lead ${leadId} to lost status`);
    
    // Keep assigned_to so telecaller can see it in their "Lost" tab
    const { error } = await supabase
      .from("leads")
      .update({ status: "lost" as Lead["status"] })
      .eq("id", leadId);

    if (error) {
      console.error("[handleMarkAsLost] Error updating lead:", error);
      alert(`Failed to mark lead as lost: ${error.message}`);
      return;
    }

    console.log(`[handleMarkAsLost] Lead ${leadId} successfully marked as lost`);

    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      user_id: userId,
      action: "lead_marked_lost",
      details: { notes: callNotes || "Marked as lost by telecaller" },
    });

    queryClient.invalidateQueries({ queryKey: ["telecaller-leads"] });
    setSelectedLead(null);
    setShowLeadDetails(false);
    alert("Lead marked as lost successfully!");
  };

  const autoAssignLead = async (leadId: string) => {
    try {
      // Get all telecallers with their assignment count
      const { data: telecallers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "telecaller");

      if (!telecallers || telecallers.length === 0) return;

      // Get assignment counts for each telecaller
      const assignmentCounts = await Promise.all(
        telecallers.map(async (tc) => {
          const { count } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", tc.user_id)
            .eq("status", "unpaid");
          return { user_id: tc.user_id, count: count || 0 };
        })
      );

      // Assign to telecaller with fewest leads (round-robin style)
      const minAssignments = Math.min(...assignmentCounts.map(a => a.count));
      const telecallerId = assignmentCounts.find(a => a.count === minAssignments)?.user_id;

      if (telecallerId) {
        await supabase
          .from("leads")
          .update({ assigned_to: telecallerId })
          .eq("id", leadId);
        console.log(`Lead ${leadId} auto-assigned to telecaller ${telecallerId}`);
      }
    } catch (error) {
      console.error("Auto-assign error:", error);
    }
  };

  const isFollowUpDue = (lead: Lead) => {
    const followUp = (lead as any).follow_up_date;
    if (!followUp) return false;
    return new Date(followUp) <= new Date();
  };

  // Reusable Lead Details Content Component
  const LeadDetailsContent = ({ 
    lead, 
    callNotes, 
    setCallNotes, 
    handleLogCall, 
    handleMarkAsLost, 
    setFollowUpModal 
  }: {
    lead: Lead | null;
    callNotes: string;
    setCallNotes: (notes: string) => void;
    handleLogCall: () => void;
    handleMarkAsLost: (id: string) => void;
    setFollowUpModal: (open: boolean) => void;
  }) => {
    if (!lead) {
      return (
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          Select a lead to view details
        </div>
      );
    }

    return (
      <>
        <div className="bg-card rounded-2xl border border-border p-4 mb-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">{lead.full_name}</p>
                <p className="text-sm text-muted-foreground">{lead.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-muted-foreground text-xs">Phone</p>
                <p className="font-medium">{lead.phone?.replace(/\D/g, "").slice(-10)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-muted-foreground text-xs">City</p>
                <p className="font-medium">{lead.city}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-muted-foreground text-xs">Loan Type</p>
                <p className="font-medium capitalize">{lead.loan_type}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-muted-foreground text-xs">Amount</p>
                <p className="font-medium">₹{Number(lead.loan_amount).toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-muted-foreground text-xs">Income</p>
                <p className="font-medium">₹{Number(lead.monthly_income).toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-muted-foreground text-xs">CIBIL Range</p>
                <p className="font-medium">{(lead as any).cibil_score_range || "N/A"}</p>
              </div>
            </div>

            {lead.status === "unpaid" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setFollowUpModal(true)}
              >
                <Clock className="w-4 h-4 mr-2" />
                Schedule Follow-up
              </Button>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="text-sm font-semibold mb-3">Log Call</h3>
          <Textarea
            placeholder="Enter call notes..."
            value={callNotes}
            onChange={(e) => setCallNotes(e.target.value)}
            className="mb-3"
            rows={3}
          />
          <div className="flex gap-2">
            <Button onClick={handleLogCall} className="flex-1" size="sm">
              Save Call Log
            </Button>
            {lead.status === "unpaid" && (
              <Button variant="outline" size="sm" className="text-gray-600" onClick={() => handleMarkAsLost(lead.id)}>
                <XCircle className="w-4 h-4 mr-1" />
                Lost
              </Button>
            )}
          </div>
        </div>
      </>
    );
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = searchTerm === "" || 
      lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesNameFilter = nameFilter === "all" ? true :
      nameFilter === "with_name" ? lead.full_name.trim().length > 0 :
      lead.full_name.trim().length === 0;
    
    return matchesSearch && matchesNameFilter;
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filter, nameFilter, searchTerm, dateRange, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const paginatedLeads = pageSize === 0 ? filteredLeads : filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LeadCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Search, Date Filter, Name Filter & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, phone..." 
            className="pl-9" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        
        {/* Date Filter */}
        <DateFilterSelect
          dateRange={dateRange}
          setDateRange={setDateRange}
          customStart={customStart}
          customEnd={customEnd}
          setCustomStart={setCustomStart}
          setCustomEnd={setCustomEnd}
          showYesterday
        />
        
        {/* Name Filter */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-input bg-background">
          <button
            onClick={() => setNameFilter("all")}
            className={`px-2 py-1 rounded text-xs font-medium ${nameFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            All
          </button>
          <button
            onClick={() => setNameFilter("with_name")}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${nameFilter === "with_name" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <User className="w-3 h-3" />
          </button>
          <button
            onClick={() => setNameFilter("without_name")}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${nameFilter === "without_name" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <UserX className="w-3 h-3" />
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1 bg-card rounded-xl p-1 border border-border">
          <Filter className="w-3.5 h-3.5 text-muted-foreground ml-1" />
          {([
            { key: "fresh" as const, label: "Fresh", activeColor: "bg-blue-600 text-white", icon: null as React.ReactNode },
            { key: "interested" as const, label: "Interest", activeColor: "bg-yellow-600 text-white", icon: <Star className="w-3 h-3" /> as React.ReactNode },
            { key: "retry" as const, label: "Retry", activeColor: "bg-orange-600 text-white", icon: <Phone className="w-3 h-3" /> as React.ReactNode },
            { key: "active" as const, label: "Active", activeColor: "bg-primary text-primary-foreground", icon: null as React.ReactNode },
            { key: "lost" as const, label: "Lost", activeColor: "bg-gray-600 text-white", icon: null as React.ReactNode },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${filter === f.key ? f.activeColor : "hover:bg-muted"}`}
            >
              {f.icon || null}
              {f.label}
            </button>
          ))}
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

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-card rounded-xl p-1 border border-border">
          <Button
            size="icon"
            variant={viewMode === "grid" ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === "list" ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Leads List - Full width on mobile */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-4">
            <h2 className="text-lg font-semibold mb-4">
              {filter === "fresh" ? "Fresh Leads" : 
               filter === "interested" ? "Interest - Follow Up" :
               filter === "retry" ? "Retry Calls" :
               filter === "active" ? "All Active Leads" : "Lost Leads"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredLeads.length})
              </span>
            </h2>
            
            {/* Grid or List View */}
            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 gap-3" 
              : "space-y-2"
            }>
              {paginatedLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isSelected={selectedLead?.id === lead.id}
                  viewMode={viewMode}
                  onSelect={() => {
                    setSelectedLead(lead);
                    if (isMobile) setShowLeadDetails(true);
                  }}
                  onViewDetails={() => {
                    setSelectedLead(lead);
                    setShowLeadDetails(true);
                  }}
                  onCall={() => handleCall(lead)}
                  onWhatsApp={() => handleWhatsApp(lead.phone, lead.full_name)}
                  onWhatsAppAPI={() => handleWhatsAppAPI(lead)}
                  onSMS={() => {
                    setSmsLead(lead);
                    setSmsDialogOpen(true);
                  }}
                  onMarkInterested={() => handleMarkAsInterested(lead)}
                  onMarkLost={() => handleMarkAsLost(lead.id)}
                  isFollowUpDue={isFollowUpDue(lead)}
                  showMarkPaid={isAdmin}
                />
              ))}
            </div>

            {filteredLeads.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {searchTerm ? "No leads match your search" : "No leads in this category"}
              </p>
            )}

          </div>
        </div>

        {/* Lead Details - Desktop sidebar / Mobile Sheet */}
        <div className="hidden lg:block space-y-4">
          <LeadDetailsContent
            lead={selectedLead}
            callNotes={callNotes}
            setCallNotes={setCallNotes}
            handleLogCall={handleLogCall}
            handleMarkAsLost={handleMarkAsLost}
            setFollowUpModal={setFollowUpModal}
          />
        </div>
      </div>

      {/* Mobile Lead Details Sheet */}
      <Sheet open={showLeadDetails && isMobile} onOpenChange={setShowLeadDetails}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 overflow-hidden">
          <SheetHeader className="sticky top-0 bg-card border-b border-border p-4 flex flex-row items-center justify-between">
            <SheetTitle className="text-left">Lead Details</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowLeadDetails(false)}>
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-safe p-4">
            <LeadDetailsContent
              lead={selectedLead}
              callNotes={callNotes}
              setCallNotes={setCallNotes}
              handleLogCall={handleLogCall}
              handleMarkAsLost={handleMarkAsLost}
              setFollowUpModal={setFollowUpModal}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Follow-up Modal */}
      <Dialog open={followUpModal} onOpenChange={setFollowUpModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Follow-up Date & Time</label>
              <Input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Reminder notes..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={handleSetFollowUp} className="w-full">
              Schedule Follow-up
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* SMS Dialog */}
      <SendSMSDialog lead={smsLead} open={smsDialogOpen} onOpenChange={setSmsDialogOpen} />

      {/* Call Tracking Dialog */}
      <CallTrackingDialog 
        lead={callLead} 
        userId={userId} 
        open={callTrackingOpen} 
        onOpenChange={setCallTrackingOpen}
        onCallLogged={() => queryClient.invalidateQueries({ queryKey: ["telecaller-leads"] })}
      />

      {/* Manual Payment Dialog */}
      <ManualPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        leadId={paymentLead?.id || ""}
        leadName={paymentLead?.full_name || ""}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["telecaller-leads"] })}
      />

      {/* WhatsApp Direct Chat */}
      <WhatsAppDirectChat
        open={whatsappChatOpen}
        onOpenChange={setWhatsappChatOpen}
        leadPhone={whatsappLead?.phone || ""}
        leadName={whatsappLead?.full_name || ""}
        leadId={whatsappLead?.id}
        leadData={{
          loan_amount: whatsappLead?.loan_amount,
          loan_type: whatsappLead?.loan_type,
          city: whatsappLead?.city,
        }}
      />
    </div>
  );
};

export default TelecallerPanel;
