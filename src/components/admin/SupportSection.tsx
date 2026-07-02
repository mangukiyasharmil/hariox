import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, Calendar, Eye, MessageSquare, RefreshCw, Search, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import CallTrackingDialog from "./CallTrackingDialog";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import type { Lead } from "@/types/database";

interface ContactLead extends Lead {
  follow_up_notes?: string | null;
}

const SupportSection = () => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<ContactLead | null>(null);
  const [callTrackingOpen, setCallTrackingOpen] = useState(false);
  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserId();
    fetchContactLeads();
  }, [companyId]);
  const fetchUserId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setUserId(session.user.id);
  };

  const fetchContactLeads = async () => {
    setIsLoading(true);
    const { data, error } = await applyCompanyFilter(
      supabase
        .from("leads")
        .select("*")
        .eq("source", "contact_us")
        .order("created_at", { ascending: false })
        .limit(200)
    );

    if (!error) setLeads((data as Lead[]) || []);
    setIsLoading(false);
  };

  const filtered = leads.filter(l =>
    l.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.phone.includes(searchQuery) ||
    l.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parseNotes = (notes: string | null) => {
    if (!notes) return { service: "", message: "" };
    const serviceMatch = notes.match(/Service:\s*(.+)/);
    const messageMatch = notes.match(/Message:\s*([\s\S]*)/);
    return {
      service: serviceMatch?.[1]?.split("\n")[0] || "",
      message: messageMatch?.[1]?.trim() || "",
    };
  };

  const handleCall = (lead: Lead) => {
    setCallLead(lead);
    setCallTrackingOpen(true);
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const message = `Hello ${name}, thank you for contacting us. How can we help you?`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Headphones className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Support Inquiries</h2>
            <p className="text-xs text-muted-foreground">{leads.length} contact form submissions</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchContactLeads} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Headphones className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No support inquiries</p>
            <p className="text-sm">Contact form submissions will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => {
            const { service, message } = parseNotes(lead.follow_up_notes || null);
            return (
              <Card key={lead.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{lead.full_name}</p>
                        {service && (
                          <Badge variant="secondary" className="text-[10px]">{service}</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">{lead.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.city}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(lead.created_at), "dd MMM, hh:mm a")}
                        </span>
                      </div>
                      {message && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-muted/50 rounded px-2 py-1">
                          "{message}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedLead(lead)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleCall(lead)}>
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-[#25D366]" onClick={() => handleWhatsApp(lead.phone, lead.full_name)}>
                        <WhatsAppIcon size="sm" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Support Inquiry Details</DialogTitle>
          </DialogHeader>
          {selectedLead && (() => {
            const { service, message } = parseNotes(selectedLead.follow_up_notes || null);
            return (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-20">Name</span>
                    <span className="text-sm">{selectedLead.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-20">Phone</span>
                    <span className="text-sm">{selectedLead.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-20">City</span>
                    <span className="text-sm">{selectedLead.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-20">Service</span>
                    <Badge variant="secondary">{service || "N/A"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-20">Date</span>
                    <span className="text-sm">{format(new Date(selectedLead.created_at), "dd MMM yyyy, hh:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-20">Status</span>
                    <Badge variant="outline">{selectedLead.status}</Badge>
                  </div>
                </div>
                {message && (
                  <div>
                    <p className="text-sm font-medium mb-1">Message</p>
                    <p className="text-sm bg-muted rounded-lg p-3">{message}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm" onClick={() => { handleCall(selectedLead); setSelectedLead(null); }}>
                    <Phone className="w-4 h-4 mr-2" /> Call
                  </Button>
                  <Button variant="outline" className="flex-1" size="sm" onClick={() => { handleWhatsApp(selectedLead.phone, selectedLead.full_name); }}>
                    <WhatsAppIcon size="sm" /> <span className="ml-2">WhatsApp</span>
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CallTrackingDialog
        lead={callLead}
        userId={userId}
        open={callTrackingOpen}
        onOpenChange={setCallTrackingOpen}
        onCallLogged={fetchContactLeads}
      />
    </div>
  );
};

export default SupportSection;
