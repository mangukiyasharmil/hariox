import { useState, useEffect } from "react";
import { Phone, Clock, RefreshCw, PhoneOff, User, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/database";
import CallTrackingDialog from "./CallTrackingDialog";
import PushNotificationSettings from "./PushNotificationSettings";

interface RetryLead extends Lead {
  lastCallOutcome?: string;
  lastCallTime?: string;
}

const NotificationsPage = () => {
  const [dueFollowUps, setDueFollowUps] = useState<Lead[]>([]);
  const [retryLeads, setRetryLeads] = useState<RetryLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [callTrackingOpen, setCallTrackingOpen] = useState(false);
  const [callLead, setCallLead] = useState<Lead | null>(null);

  useEffect(() => {
    checkUserAndFetch();
  }, []);

  const checkUserAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setUserId(session.user.id);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const hasAdmin = roles?.some(r => r.role === "admin");
    setIsAdmin(hasAdmin || false);

    fetchNotifications(session.user.id, hasAdmin || false);
  };

  const fetchNotifications = async (uid: string, admin: boolean) => {
    setIsLoading(true);

    // Fetch due follow-ups only
    let followUpQuery = supabase
      .from("leads")
      .select("*")
      .eq("is_interested", true)
      .lte("follow_up_date", new Date().toISOString())
      .neq("status", "lost")
      .order("follow_up_date", { ascending: true });

    if (!admin) {
      followUpQuery = followUpQuery.eq("assigned_to", uid);
    }

    const { data: followUpData } = await followUpQuery;
    setDueFollowUps((followUpData as Lead[]) || []);

    // Fetch leads with failed call outcomes (busy, no_answer, switched_off) - retry section
    const { data: failedCalls } = await supabase
      .from("call_logs")
      .select("lead_id, outcome, created_at")
      .in("outcome", ["busy", "no_answer", "switched_off"])
      .eq("caller_id", uid)
      .order("created_at", { ascending: false });

    if (failedCalls && failedCalls.length > 0) {
      // Get unique lead IDs with their most recent failed call
      const leadCallMap = new Map<string, { outcome: string; time: string }>();
      failedCalls.forEach(call => {
        if (!leadCallMap.has(call.lead_id)) {
          leadCallMap.set(call.lead_id, { outcome: call.outcome || "", time: call.created_at });
        }
      });

      const leadIds = Array.from(leadCallMap.keys());

      // Fetch lead details
      let leadsQuery = supabase
        .from("leads")
        .select("*")
        .in("id", leadIds)
        .neq("status", "lost")
        .neq("status", "paid");

      if (!admin) {
        leadsQuery = leadsQuery.eq("assigned_to", uid);
      }

      const { data: leadsData } = await leadsQuery;

      const retryData: RetryLead[] = (leadsData || []).map(lead => ({
        ...lead,
        lastCallOutcome: leadCallMap.get(lead.id)?.outcome,
        lastCallTime: leadCallMap.get(lead.id)?.time,
      })) as RetryLead[];

      // Sort by most recent failed call
      retryData.sort((a, b) => {
        const timeA = a.lastCallTime ? new Date(a.lastCallTime).getTime() : 0;
        const timeB = b.lastCallTime ? new Date(b.lastCallTime).getTime() : 0;
        return timeB - timeA;
      });

      setRetryLeads(retryData.slice(0, 20)); // Limit to 20
    } else {
      setRetryLeads([]);
    }

    setIsLoading(false);
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
    if (userId) fetchNotifications(userId, isAdmin);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getOutcomeLabel = (outcome?: string) => {
    switch (outcome) {
      case "busy": return "Busy";
      case "no_answer": return "No Answer";
      case "switched_off": return "Switched Off";
      default: return outcome;
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case "busy": return "bg-orange-100 text-orange-700";
      case "no_answer": return "bg-red-100 text-red-700";
      case "switched_off": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const LeadCardCompact = ({ lead, showDismiss = false, showRetry = false }: { lead: RetryLead; showDismiss?: boolean; showRetry?: boolean }) => (
    <Card className="mb-2">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{lead.full_name}</p>
              {showRetry && lead.lastCallOutcome && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getOutcomeColor(lead.lastCallOutcome)}`}>
                  {getOutcomeLabel(lead.lastCallOutcome)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {lead.loan_type} • ₹{Number(lead.loan_amount).toLocaleString("en-IN")}
              {showRetry && lead.lastCallTime && (
                <span className="ml-2">• {formatTime(lead.lastCallTime)}</span>
              )}
              {!showRetry && (
                <span className="ml-2">• {lead.city}</span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => handleCall(lead)}
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-[#25D366] hover:bg-green-50"
              onClick={() => handleWhatsApp(lead.phone, lead.full_name)}
            >
              <WhatsAppIcon size="sm" />
            </Button>
            {showDismiss && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => dismissFollowUp(lead.id)}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Push Notification Settings */}
      <PushNotificationSettings />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Follow-ups & Retries</h2>
          <p className="text-muted-foreground text-sm">
            Leads that need your attention
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => userId && fetchNotifications(userId, isAdmin)}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="followups" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="followups" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Follow-ups
            {dueFollowUps.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{dueFollowUps.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="retry" className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Retry Calls
            {retryLeads.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{retryLeads.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="followups">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : dueFollowUps.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No follow-ups due</p>
                <p className="text-sm">Scheduled follow-ups will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dueFollowUps.map((lead) => (
                <LeadCardCompact key={lead.id} lead={lead as RetryLead} showDismiss />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="retry">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : retryLeads.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <PhoneOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No retry calls</p>
                <p className="text-sm">Failed calls (busy, no answer, switched off) will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {retryLeads.map((lead) => (
                <LeadCardCompact key={lead.id} lead={lead} showRetry />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Call Tracking Dialog */}
      <CallTrackingDialog 
        lead={callLead} 
        userId={userId} 
        open={callTrackingOpen} 
        onOpenChange={setCallTrackingOpen}
        onCallLogged={() => userId && fetchNotifications(userId, isAdmin)}
      />
    </div>
  );
};

export default NotificationsPage;
