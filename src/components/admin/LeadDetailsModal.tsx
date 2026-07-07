import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  X, Phone, Save, Loader2, MessageSquare, 
  ArrowRightLeft, Clock, FileText, IndianRupee, Activity, 
  CheckCircle, XCircle, User, Calendar, Mail
} from "lucide-react";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, AppRole } from "@/types/database";
import { toast } from "@/hooks/use-toast";
import SendSMSDialog from "./SendSMSDialog";
import LeadTransferDialog from "./LeadTransferDialog";
import LeadScoreBadge from "./LeadScoreBadge";
import { formatDistanceToNow, format } from "date-fns";

interface LeadDetailsModalProps {
  lead: Lead | null;
  staffList: { id: string; full_name: string; role: string }[];
  onClose: () => void;
  onSaved: () => void;
}

interface TimelineEvent {
  id: string;
  type: "call" | "payment" | "document" | "status" | "note" | "transfer" | "sms" | "whatsapp";
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
  actor_id?: string | null;
}

interface AssignmentHistoryRecord {
  id: string;
  assigned_to: string | null;
  created_at: string;
}

// E-commerce status options with display labels
const statusOptions: { value: Lead["status"]; label: string }[] = [
  { value: "unpaid", label: "New Enquiry" },
  { value: "paid", label: "Order Confirmed" },
  { value: "verification", label: "In Review" },
  { value: "documents_pending", label: "Payment Pending" },
  { value: "documents_uploaded", label: "Payment Received" },
  { value: "verified", label: "Processing" },
  { value: "processing", label: "Packed" },
  { value: "approved", label: "Shipped" },
  { value: "disbursed", label: "Delivered" },
  { value: "rejected", label: "Cancelled" },
  { value: "lost", label: "Returned" },
];

const LeadDetailsModal = ({ lead, staffList, onClose, onSaved }: LeadDetailsModalProps) => {
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [firstAssignee, setFirstAssignee] = useState<{ id: string; name: string } | null>(null);

  // Build staff map from staffList
  useEffect(() => {
    const map: Record<string, string> = {};
    staffList.forEach(s => {
      map[s.id] = s.full_name;
    });
    setStaffMap(map);
  }, [staffList]);

  useEffect(() => {
    if (lead) {
      setFormData({ ...lead });
      fetchLatestLeadDetails();
      fetchTimeline();
      fetchFirstAssignee();
    }
  }, [lead]);

  const fetchLatestLeadDetails = async () => {
    if (!lead) return;
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching latest lead details:", error);
      return;
    }

    if (data) {
      setFormData({ ...lead, ...data } as Lead);
    }
  };

  const fetchFirstAssignee = async () => {
    if (!lead) return;
    try {
      // Fetch first assignment from history table
      const { data: historyData } = await supabase
        .from("lead_assignment_history")
        .select("id, assigned_to, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (historyData && historyData.length > 0) {
        const firstRecord = historyData[0] as AssignmentHistoryRecord;
        if (firstRecord.assigned_to) {
          // Look up the staff name
          const name = staffMap[firstRecord.assigned_to] || 
            staffList.find(s => s.id === firstRecord.assigned_to)?.full_name || 
            "Unknown Staff";
          setFirstAssignee({ id: firstRecord.assigned_to, name });
        }
      } else {
        // Fallback: Use current assignment if no history exists
        if (lead.assigned_to) {
          const name = staffMap[lead.assigned_to] || 
            staffList.find(s => s.id === lead.assigned_to)?.full_name || 
            "Unknown Staff";
          setFirstAssignee({ id: lead.assigned_to, name });
        }
      }
    } catch (err) {
      console.error("Error fetching first assignee:", err);
    }
  };

  const fetchTimeline = async () => {
    if (!lead) return;
    setIsLoadingTimeline(true);
    try {
      const events: TimelineEvent[] = [];

      // Fetch activity logs
      const { data: activities } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(50);

      activities?.forEach(a => {
        let title = a.action.replace(/_/g, " ");
        let type: TimelineEvent["type"] = "note";
        
        if (a.action.includes("call")) type = "call";
        else if (a.action.includes("payment")) type = "payment";
        else if (a.action.includes("document")) type = "document";
        else if (a.action.includes("status")) type = "status";
        else if (a.action.includes("transfer")) type = "transfer";

        const details = a.details as Record<string, any> | null;
        const descriptionText = details?.note || details?.reason || (details ? JSON.stringify(details) : "");

        events.push({
          id: a.id,
          type,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          description: descriptionText,
          timestamp: a.created_at,
          metadata: a.details,
          actor_id: a.user_id,
        });
      });

      // Fetch call logs
      const { data: calls } = await supabase
        .from("call_logs")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      calls?.forEach(c => {
        events.push({
          id: c.id,
          type: "call",
          title: `${c.outcome || "Call"} - ${c.call_duration ? `${Math.floor(c.call_duration / 60)}m ${c.call_duration % 60}s` : "No duration"}`,
          description: c.notes || "No notes",
          timestamp: c.created_at,
          metadata: c,
          actor_id: c.caller_id,
        });
      });

      // Fetch payments
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      payments?.forEach(p => {
        events.push({
          id: p.id,
          type: "payment",
          title: `Payment ${p.status === "completed" ? "Received" : p.status}`,
          description: `$${p.total_amount?.toLocaleString("en-US")} via ${p.payment_source}`,
          timestamp: p.created_at,
          metadata: p,
          actor_id: p.collected_by,
        });
      });

      // Fetch documents
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      docs?.forEach(d => {
        events.push({
          id: d.id,
          type: "document",
          title: `${d.document_type} - ${d.status}`,
          description: d.remarks || d.file_name,
          timestamp: d.created_at,
          metadata: d,
          actor_id: d.verified_by,
        });
      });

      // Fetch SMS logs for this lead
      const { data: smsLogs } = await supabase
        .from("sms_logs")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      smsLogs?.forEach(s => {
        events.push({
          id: `sms-${s.id}`,
          type: "sms",
          title: `SMS ${s.sms_type === "remarketing" ? "Remarketing" : s.sms_type} — ${s.status}`,
          description: s.message?.substring(0, 120) + (s.message?.length > 120 ? "..." : ""),
          timestamp: s.sent_at || s.created_at,
          metadata: s,
        });
      });

      // Fetch WhatsApp messages for this lead
      const { data: waMsgs } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(50);

      waMsgs?.forEach(w => {
        events.push({
          id: `wa-${w.id}`,
          type: "whatsapp",
          title: `WhatsApp ${w.direction === "outbound" ? "Sent" : "Received"} — ${w.status || "sent"}`,
          description: w.content?.substring(0, 120) + (w.content?.length > 120 ? "..." : ""),
          timestamp: w.sent_at || w.created_at,
          metadata: w,
        });
      });

      // Sort by timestamp
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimeline(events);
    } catch (err) {
      console.error("Error fetching timeline:", err);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  if (!lead) return null;

  const handleCall = () => window.open(`tel:+91${formData.phone}`, "_self");

  const handleWhatsApp = () => {
    const message = `Hello ${formData.full_name}, we received your order request from Hariox and would like to assist you.`;
    window.open(`https://wa.me/91${formData.phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          city: formData.city,
          state: formData.state || null,
          loan_type: formData.loan_type,
          loan_amount: formData.loan_amount,
          application_id: formData.application_id || null,
          status: formData.status,
          assigned_to: formData.assigned_to || null,
        })
        .eq("id", lead.id);

      if (error) throw error;

      // Add note if provided
      if (note.trim()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from("activity_logs").insert({
            lead_id: lead.id,
            user_id: session.user.id,
            action: "note_added",
            details: { note: note.trim() },
          });
        }
      }

      toast({ title: "Lead updated successfully" });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to update lead", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: "bg-yellow-500",
      paid: "bg-green-500",
      verification: "bg-purple-500",
      documents_pending: "bg-orange-500",
      documents_uploaded: "bg-cyan-500",
      verified: "bg-indigo-500",
      rejected: "bg-red-500",
      processing: "bg-blue-500",
      approved: "bg-teal-500",
      disbursed: "bg-emerald-500",
      lost: "bg-gray-400",
    };
    return colors[status] || "bg-gray-500";
  };

  const getTimelineIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "call": return <Phone className="w-4 h-4" />;
      case "payment": return <IndianRupee className="w-4 h-4" />;
      case "document": return <FileText className="w-4 h-4" />;
      case "status": return <CheckCircle className="w-4 h-4" />;
      case "transfer": return <ArrowRightLeft className="w-4 h-4" />;
      case "sms": return <MessageSquare className="w-4 h-4" />;
      case "whatsapp": return <Mail className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getTimelineColor = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "call": return "bg-blue-100 text-blue-600";
      case "payment": return "bg-green-100 text-green-600";
      case "document": return "bg-purple-100 text-purple-600";
      case "status": return "bg-amber-100 text-amber-600";
      case "transfer": return "bg-pink-100 text-pink-600";
      case "sms": return "bg-cyan-100 text-cyan-600";
      case "whatsapp": return "bg-emerald-100 text-emerald-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onPointerDown={(e) => {
          // Only close when clicking the backdrop itself (not when interacting with any content
          // inside the modal, including portalled UI).
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-card z-10 flex items-center justify-between p-4 md:p-6 border-b border-border">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg md:text-xl font-bold">Customer Details</h2>
              <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(formData.status || "unpaid")}`}>
                {(formData.status || "unpaid").replace(/_/g, " ")}
              </span>
              <LeadScoreBadge leadId={lead.id} size="sm" />
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button size="sm" variant="outline" onClick={handleCall} className="hidden sm:flex">
                <Phone className="w-4 h-4 mr-1" /> Call
              </Button>
              <Button size="sm" variant="outline" className="text-[#25D366] hover:bg-[#25D366] hover:text-white hidden sm:flex" onClick={handleWhatsApp}>
                <WhatsAppIcon size="sm" className="mr-1" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="text-blue-600 hidden sm:flex" onClick={() => setSmsDialogOpen(true)}>
                <MessageSquare className="w-4 h-4 mr-1" /> SMS
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTransferDialogOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Transfer</span>
              </Button>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="details" className="flex-1">
            <TabsList className="w-full justify-start rounded-none border-b px-4 md:px-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="p-4 md:p-6 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
              {/* Personal + Loan grids */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Customer Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Name</Label>
                      <Input value={formData.full_name || ""} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>City</Label>
                        <Input value={formData.city || ""} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input 
                          value={(formData as any).state || ""} 
                          onChange={(e) => setFormData({ ...formData, state: e.target.value } as any)} 
                          placeholder="State"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Product &amp; Order Details</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Product Category</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm capitalize font-medium"
                        value={formData.loan_type || "personal"}
                        onChange={(e) => setFormData({ ...formData, loan_type: e.target.value as Lead["loan_type"] })}
                      >
                        <option value="personal">Hariox Light Blue ($129)</option>
                        <option value="business">Pro Bundle ($129)</option>
                        <option value="home">Starter Pack ($129)</option>
                        <option value="marriage">Custom Branding ($129)</option>
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Order Value ($)</Label>
                        <Input
                          type="number"
                          value={formData.loan_amount || ""}
                          onChange={(e) => setFormData({ ...formData, loan_amount: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Shopify Order ID</Label>
                        <Input
                          value={formData.application_id || ""}
                          onChange={(e) => setFormData({ ...formData, application_id: e.target.value })}
                          placeholder="e.g. #1024"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lead Score Details */}
              <div className="p-4 bg-muted/30 rounded-xl">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3">Lead Score</h3>
                <LeadScoreBadge leadId={lead.id} showDetails />
              </div>

              {/* Status & Assignment */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Status &amp; Assignment</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
                      value={formData.status || "unpaid"}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Lead["status"] })}
                    >
                      {statusOptions.map((s) => (
                        <option key={s.value} value={s.value} className="capitalize">{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Assigned To</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={formData.assigned_to || ""}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Notes &amp; Follow-ups</h3>
                <div className="flex gap-3">
                  <Textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="flex-1" />
                  <Button variant="outline" disabled={!note.trim()} onClick={() => { /* note handled in save */ }}>Add Note</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="p-4 md:p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
              {/* Lead Owner + First Assignee Badge */}
              {(lead.assigned_to || firstAssignee) && (
                <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
                  {/* Current Owner */}
                  {lead.assigned_to && (
                    <>
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lead Owner</p>
                    <p className="font-medium text-sm">
                      {staffMap[lead.assigned_to] || staffList.find(s => s.id === lead.assigned_to)?.full_name || "Unknown"}
                    </p>
                  </div>
                    </>
                  )}
                  
                  {/* First Assignee */}
                  {firstAssignee && firstAssignee.id !== lead.assigned_to && (
                    <>
                      <div className="h-6 border-l border-border mx-2" />
                      <div>
                        <p className="text-xs text-muted-foreground">First Assigned To</p>
                        <p className="font-medium text-sm text-muted-foreground">{firstAssignee.name}</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isLoadingTimeline ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-border" />
                  
                  <div className="space-y-4">
                    {timeline.map((event, idx) => (
                      <div key={event.id} className="relative flex gap-4 pl-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${getTimelineColor(event.type)}`}>
                          {getTimelineIcon(event.type)}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm">{event.title}</p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {typeof event.description === "string" ? event.description : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {event.actor_id && staffMap[event.actor_id] && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {staffMap[event.actor_id]}
                              </span>
                            )}
                            {event.actor_id && staffMap[event.actor_id] && <span>•</span>}
                            <span>{format(new Date(event.timestamp), "dd MMM yyyy, hh:mm a")}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="hero" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* SMS Dialog */}
      <SendSMSDialog lead={lead} open={smsDialogOpen} onOpenChange={setSmsDialogOpen} />
      
      {/* Transfer Dialog */}
      <LeadTransferDialog 
        lead={lead} 
        open={transferDialogOpen} 
        onOpenChange={setTransferDialogOpen}
        onTransferred={() => {
          onSaved();
          fetchTimeline();
        }}
      />
    </>
  );
};

export default LeadDetailsModal;
