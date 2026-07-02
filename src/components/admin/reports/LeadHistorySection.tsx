 import { useState, useEffect } from "react";
 import { History, User, ArrowRight, Calendar, Filter, Download } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { supabase } from "@/integrations/supabase/client";
 import { useCompany } from "@/contexts/CompanyContext";
 import { format, formatDistanceToNow } from "date-fns";
 import { toast } from "sonner";
 
 interface LeadHistoryEvent {
   id: string;
   leadId: string;
   leadName: string;
   action: string;
   details: any;
   userId: string;
   userName: string;
   timestamp: string;
 }
 
 interface LeadHistorySectionProps {
   dateFilter: string;
   dateEndFilter: string;
 }
 
 const statusColors: Record<string, string> = {
   unpaid: "bg-gray-100 text-gray-700",
   paid: "bg-green-100 text-green-700",
   verification: "bg-blue-100 text-blue-700",
   documents_pending: "bg-amber-100 text-amber-700",
   documents_uploaded: "bg-purple-100 text-purple-700",
   verified: "bg-emerald-100 text-emerald-700",
   rejected: "bg-red-100 text-red-700",
   processing: "bg-indigo-100 text-indigo-700",
   approved: "bg-teal-100 text-teal-700",
   disbursed: "bg-cyan-100 text-cyan-700",
   lost: "bg-rose-100 text-rose-700",
 };
 
 const LeadHistorySection = ({ dateFilter, dateEndFilter }: LeadHistorySectionProps) => {
   const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
   const [events, setEvents] = useState<LeadHistoryEvent[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [searchTerm, setSearchTerm] = useState("");
   const [actionFilter, setActionFilter] = useState<string>("all");
   const [leadMap, setLeadMap] = useState<Map<string, string>>(new Map());
   const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
 
   useEffect(() => {
     fetchHistory();
   }, [dateFilter, dateEndFilter, currentCompany?.id, showAllCompanies]);
 
   const fetchHistory = async () => {
     setIsLoading(true);
     try {
       // Fetch profiles for user name mapping
       const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
       const pMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
       setProfileMap(pMap);
 
       // Fetch activity logs within date range
       let query = supabase
         .from("activity_logs")
         .select("id, lead_id, action, details, user_id, created_at")
         .gte("created_at", dateFilter)
         .lte("created_at", dateEndFilter)
         .order("created_at", { ascending: false })
         .limit(500);
 
       const { data: logs, error } = await query;
       if (error) throw error;
 
       // Get unique lead IDs
       const leadIds = [...new Set((logs || []).map(l => l.lead_id).filter(Boolean))];
       
       // Fetch lead names
       let leadQuery = supabase
         .from("leads")
         .select("id, full_name, company_id")
         .in("id", leadIds.length > 0 ? leadIds : ["00000000-0000-0000-0000-000000000000"]);
       
       const companyId = getCompanyFilter();
       if (companyId) {
         leadQuery = leadQuery.eq("company_id", companyId);
       }
       
       const { data: leads } = await leadQuery;
       const lMap = new Map(leads?.map(l => [l.id, l.full_name]) || []);
       setLeadMap(lMap);
 
       // Filter logs to only include leads from the selected company
       const companyLeadIds = new Set(leads?.map(l => l.id) || []);
       
       const mappedEvents: LeadHistoryEvent[] = (logs || [])
         .filter(log => log.lead_id && companyLeadIds.has(log.lead_id))
         .map(log => ({
           id: log.id,
           leadId: log.lead_id,
           leadName: lMap.get(log.lead_id) || "Unknown Lead",
           action: log.action,
           details: log.details,
           userId: log.user_id || "",
           userName: pMap.get(log.user_id || "") || "System",
           timestamp: log.created_at,
         }));
 
       setEvents(mappedEvents);
     } catch (error) {
       console.error("Error fetching lead history:", error);
       toast.error("Failed to load lead history");
     } finally {
       setIsLoading(false);
     }
   };
 
   const formatAction = (action: string, details: any): React.ReactNode => {
     switch (action) {
       case "status_change":
         const from = details?.from || "unknown";
         const to = details?.to || "unknown";
         return (
           <div className="flex items-center gap-2 flex-wrap">
             <span className="text-muted-foreground">Status:</span>
             <span className={`px-2 py-0.5 rounded text-xs capitalize ${statusColors[from] || "bg-gray-100"}`}>
               {from.replace(/_/g, " ")}
             </span>
             <ArrowRight className="w-3 h-3 text-muted-foreground" />
             <span className={`px-2 py-0.5 rounded text-xs capitalize ${statusColors[to] || "bg-gray-100"}`}>
               {to.replace(/_/g, " ")}
             </span>
           </div>
         );
       case "assigned":
         return (
           <span className="text-blue-600">
             Assigned to {details?.to_name || "staff member"}
           </span>
         );
       case "transferred":
         return (
           <span className="text-purple-600">
             Transferred from {details?.from_name || "unknown"} to {details?.to_name || "unknown"}
             {details?.reason && <span className="text-muted-foreground"> - {details.reason}</span>}
           </span>
         );
       case "note_added":
         return (
           <span className="text-gray-600">
             Note: {details?.note?.substring(0, 100) || "Added note"}
             {details?.note?.length > 100 && "..."}
           </span>
         );
       case "document_uploaded":
         return (
           <span className="text-green-600">
             Document uploaded: {details?.document_type || "file"}
           </span>
         );
       case "payment_received":
         return (
           <span className="text-green-600 font-medium">
             Payment received: ₹{(details?.amount || 0).toLocaleString("en-IN")}
           </span>
         );
       case "call_made":
         return (
           <span className="text-indigo-600">
             Call: {details?.outcome || "made"} ({details?.duration || 0}s)
           </span>
         );
       default:
         return <span className="capitalize">{action.replace(/_/g, " ")}</span>;
     }
   };
 
   const actionTypes = [
     { value: "all", label: "All Actions" },
     { value: "status_change", label: "Status Changes" },
     { value: "assigned", label: "Assignments" },
     { value: "transferred", label: "Transfers" },
     { value: "note_added", label: "Notes" },
     { value: "document_uploaded", label: "Documents" },
     { value: "payment_received", label: "Payments" },
     { value: "call_made", label: "Calls" },
   ];
 
   const filteredEvents = events.filter(e => {
     const matchesSearch = searchTerm === "" || 
       e.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       e.userName.toLowerCase().includes(searchTerm.toLowerCase());
     const matchesAction = actionFilter === "all" || e.action === actionFilter;
     return matchesSearch && matchesAction;
   });
 
   const exportHistory = () => {
     if (filteredEvents.length === 0) {
       toast.error("No data to export");
       return;
     }
 
     let csv = "Lead History Report\n";
     csv += `Generated: ${new Date().toLocaleString("en-IN")}\n\n`;
     csv += "Timestamp,Lead Name,Action,User,Details\n";
     
     filteredEvents.forEach(e => {
       const timestamp = format(new Date(e.timestamp), "dd/MM/yyyy HH:mm");
       const details = typeof e.details === "object" ? JSON.stringify(e.details) : String(e.details || "");
       csv += `"${timestamp}","${e.leadName}","${e.action.replace(/_/g, " ")}","${e.userName}","${details.replace(/"/g, '""')}"\n`;
     });
 
     const blob = new Blob([csv], { type: "text/csv" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `lead_history_${new Date().toISOString().split("T")[0]}.csv`;
     a.click();
     URL.revokeObjectURL(url);
     toast.success("Lead history exported");
   };
 
   return (
     <div className="space-y-4">
       {/* Filters */}
       <div className="flex flex-col sm:flex-row gap-3">
         <div className="flex-1">
           <Input
             placeholder="Search by lead or staff name..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full"
           />
         </div>
         <Select value={actionFilter} onValueChange={setActionFilter}>
           <SelectTrigger className="w-full sm:w-48">
             <Filter className="w-4 h-4 mr-2" />
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
             {actionTypes.map(t => (
               <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
             ))}
           </SelectContent>
         </Select>
         <Button variant="outline" size="sm" onClick={exportHistory}>
           <Download className="w-4 h-4 mr-1" />
           Export
         </Button>
       </div>
 
       {/* Results count */}
       <div className="text-sm text-muted-foreground">
         Showing {filteredEvents.length} events
       </div>
 
       {/* History List */}
       <div className="bg-card rounded-xl border border-border overflow-hidden">
         <div className="p-3 border-b border-border flex items-center gap-2">
           <History className="w-4 h-4 text-primary" />
           <h3 className="font-semibold text-sm">Lead Activity History</h3>
         </div>
         
         {isLoading ? (
           <div className="p-8 flex items-center justify-center">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
           </div>
         ) : filteredEvents.length === 0 ? (
           <div className="p-8 text-center text-muted-foreground">
             No activity logs found for the selected period
           </div>
         ) : (
           <ScrollArea className="h-[500px]">
             <div className="divide-y divide-border">
               {filteredEvents.map((event) => (
                 <div key={event.id} className="p-3 hover:bg-muted/30 transition-colors">
                   <div className="flex items-start gap-3">
                     <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                       <User className="w-4 h-4 text-primary" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 flex-wrap mb-1">
                         <span className="font-medium text-sm truncate max-w-40">
                           {event.leadName}
                         </span>
                         <span className="text-muted-foreground text-xs">•</span>
                         <span className="text-xs text-muted-foreground">
                           by {event.userName}
                         </span>
                       </div>
                       <div className="text-sm">
                         {formatAction(event.action, event.details)}
                       </div>
                       <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                         <Calendar className="w-3 h-3" />
                         <span>{format(new Date(event.timestamp), "dd MMM yyyy, hh:mm a")}</span>
                         <span className="text-muted-foreground/60">
                           ({formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })})
                         </span>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           </ScrollArea>
         )}
       </div>
     </div>
   );
 };
 
 export default LeadHistorySection;