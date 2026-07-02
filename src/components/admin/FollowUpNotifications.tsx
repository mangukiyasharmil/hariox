import { useState, useEffect } from "react";
import { Bell, Phone, X, Clock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/database";
import CallTrackingDialog from "./CallTrackingDialog";

interface FollowUpNotificationsProps {
  userId: string | null;
  isAdmin: boolean;
}

const FollowUpNotifications = ({ userId, isAdmin }: FollowUpNotificationsProps) => {
  const [dueFollowUps, setDueFollowUps] = useState<Lead[]>([]);
  const [freshLeads, setFreshLeads] = useState<Lead[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"fresh" | "followups">("fresh");
  const [callTrackingOpen, setCallTrackingOpen] = useState(false);
  const [callLead, setCallLead] = useState<Lead | null>(null);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [userId, isAdmin]);

  const fetchNotifications = async () => {
    // Fetch fresh leads (newly assigned, not yet contacted)
    let freshQuery = supabase
      .from("leads")
      .select("*")
      .eq("status", "unpaid")
      .or("is_interested.is.null,is_interested.eq.false")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!isAdmin && userId) {
      freshQuery = freshQuery.eq("assigned_to", userId);
    }

    const { data: freshData } = await freshQuery;
    setFreshLeads((freshData as Lead[]) || []);

    // Fetch due follow-ups
    let followUpQuery = supabase
      .from("leads")
      .select("*")
      .eq("is_interested", true)
      .lte("follow_up_date", new Date().toISOString())
      .neq("status", "lost")
      .order("follow_up_date", { ascending: true })
      .limit(50);

    if (!isAdmin && userId) {
      followUpQuery = followUpQuery.eq("assigned_to", userId);
    }

    const { data: followUpData } = await followUpQuery;
    setDueFollowUps((followUpData as Lead[]) || []);
  };

  const handleCall = (lead: Lead) => {
    setCallLead(lead);
    setCallTrackingOpen(true);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const message = `Hello ${name}, following up on your loan application. Would you like to proceed?`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const dismissFollowUp = async (leadId: string) => {
    await supabase
      .from("leads")
      .update({ follow_up_date: null } as any)
      .eq("id", leadId);
    fetchNotifications();
  };

  const totalCount = freshLeads.length + dueFollowUps.length;
  if (totalCount === 0) return null;

  const currentLeads = activeTab === "fresh" ? freshLeads : dueFollowUps;

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 max-w-sm w-full sm:w-80">
        {/* Notification Badge */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -top-2 -right-2 w-10 h-10 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg animate-bounce"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold flex items-center justify-center">
            {totalCount}
          </span>
        </button>

        {/* Notification Panel */}
        {isExpanded && (
          <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            <div className="bg-destructive/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-destructive" />
                <span className="font-semibold text-sm">Notifications</span>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab("fresh")}
                className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${
                  activeTab === "fresh" 
                    ? "bg-primary/10 text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Fresh ({freshLeads.length})
              </button>
              <button
                onClick={() => setActiveTab("followups")}
                className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${
                  activeTab === "followups" 
                    ? "bg-primary/10 text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Follow-ups ({dueFollowUps.length})
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {currentLeads.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No {activeTab === "fresh" ? "fresh leads" : "follow-ups due"}
                </div>
              ) : (
                currentLeads.map((lead) => (
                  <div key={lead.id} className="p-3 border-b border-border last:border-b-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{lead.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.loan_type} Loan • ₹{Number(lead.loan_amount).toLocaleString("en-IN")}
                        </p>
                      </div>
                      {activeTab === "followups" && (
                        <button
                          onClick={() => dismissFollowUp(lead.id)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => handleCall(lead)}
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366] hover:text-white hover:border-[#25D366]"
                        onClick={() => handleWhatsApp(lead.phone, lead.full_name)}
                      >
                        <WhatsAppIcon size="xs" />
                        <span className="ml-1">WhatsApp</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Call Tracking Dialog */}
      <CallTrackingDialog 
        lead={callLead} 
        userId={userId} 
        open={callTrackingOpen} 
        onOpenChange={setCallTrackingOpen}
        onCallLogged={fetchNotifications}
      />
    </>
  );
};

export default FollowUpNotifications;
