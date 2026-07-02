import { useState, useEffect } from "react";
import { Plus, Send, Users, Clock, CheckCircle2, XCircle, Play, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateFilterSelect from "../DateFilterSelect";
import { useDateFilter } from "@/hooks/useDateFilter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

interface Campaign {
  id: string;
  name: string;
  message_template: string;
  target_status: string[];
  status: string;
  sent_count: number;
  delivered_count: number;
  scheduled_at: string | null;
  executed_at: string | null;
  created_at: string;
  template_name?: string | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  language: string;
  variables: string[];
}

interface WhatsAppCampaignsProps {
  accountId: string | null;
}

const leadStatuses = [
  "unpaid", "paid", "verification", "documents_pending", 
  "documents_uploaded", "verified", "processing", "approved", "disbursed", "lost"
];

const WhatsAppCampaigns = ({ accountId }: WhatsAppCampaignsProps) => {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id || null;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetCount, setTargetCount] = useState(0);
  
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [useTemplate, setUseTemplate] = useState(true);

  // Date filter for targeting leads
  const { dateRange, setDateRange, customStart, customEnd, setCustomStart, setCustomEnd, startDateISO, endDateISO } = useDateFilter("all");

  useEffect(() => {
    fetchCampaigns();
    if (accountId) fetchTemplates();
  }, [accountId]);

  useEffect(() => {
    if (selectedStatuses.length > 0) {
      fetchTargetCount();
    } else {
      setTargetCount(0);
    }
  }, [selectedStatuses, dateRange, customStart, customEnd]);

  const fetchCampaigns = async () => {
    try {
      let query = supabase
        .from("whatsapp_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (accountId) query = query.eq("account_id", accountId);

      const { data, error } = await query;
      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("id, name, content, language, variables")
        .eq("account_id", accountId)
        .eq("is_active", true);
      
      setTemplates((data || []) as Template[]);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const fetchTargetCount = async () => {
    try {
      let query = supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("status", selectedStatuses as any);
      
      if (companyId) query = query.eq("company_id", companyId);
      
      // Apply date filter
      if (dateRange !== "all") {
        query = query.gte("created_at", startDateISO).lte("created_at", endDateISO);
      }
      
      const { count } = await query;
      setTargetCount(count || 0);
    } catch (error) {
      console.error("Error counting leads:", error);
    }
  };

  const handleCreateCampaign = async () => {
    if (!name || selectedStatuses.length === 0) {
      toast.error("Please fill campaign name and select target statuses");
      return;
    }

    if (useTemplate && !selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    if (!useTemplate && !message) {
      toast.error("Please enter a message");
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          name,
          message_template: useTemplate ? (template?.content || message) : message,
          target_status: selectedStatuses,
          account_id: accountId,
          created_by: session?.user.id,
          status: "draft",
          template_name: useTemplate ? template?.name : null,
          target_date_from: dateRange !== "all" ? startDateISO : null,
          target_date_to: dateRange !== "all" ? endDateISO : null,
        });

      if (error) throw error;

      toast.success("Campaign created");
      fetchCampaigns();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Failed to create campaign");
    }
  };

  const handleExecuteCampaign = async (campaign: Campaign & { target_date_from?: string | null; target_date_to?: string | null }) => {
    // Re-count target leads WITH the saved date filter
    let query = supabase
      .from("leads")
      .select("id, full_name, phone, loan_amount, loan_type, city, status")
      .in("status", (campaign.target_status || []) as any);

    if (companyId) query = query.eq("company_id", companyId);

    // Apply the date filter that was saved with the campaign
    if (campaign.target_date_from) {
      query = query.gte("created_at", campaign.target_date_from);
    }
    if (campaign.target_date_to) {
      query = query.lte("created_at", campaign.target_date_to);
    }

    const { data: rawLeads } = await query;

    if (!rawLeads || rawLeads.length === 0) {
      toast.error("No leads found for this campaign");
      return;
    }

    // Deduplicate by phone number — keep only first occurrence
    const seenPhones = new Set<string>();
    const leads = rawLeads.filter(lead => {
      const phone = lead.phone?.replace(/\D/g, "").slice(-10);
      if (!phone || seenPhones.has(phone)) return false;
      seenPhones.add(phone);
      return true;
    });

    const dupeCount = rawLeads.length - leads.length;
    const dupeMsg = dupeCount > 0 ? ` (${dupeCount} duplicates removed)` : "";

    if (!confirm(`Send messages to ${leads.length} leads via WhatsApp API?${dupeMsg} This will actually deliver messages.`)) return;

    // Look up the template's variable count from the DB
    const templateName = (campaign as any).template_name;
    let templateVarCount = 0;
    let templateLanguage = "en";
    if (templateName) {
      const tpl = templates.find(t => t.name === templateName);
      if (tpl) {
        templateVarCount = (tpl.variables || []).length;
        templateLanguage = tpl.language || "en";
      }
    }

    try {
      await supabase
        .from("whatsapp_campaigns")
        .update({ 
          status: "sending",
          executed_at: new Date().toISOString()
        })
        .eq("id", campaign.id);

      let sentCount = 0;
      let failedCount = 0;

      // Send messages in batches of 10 with delay to avoid rate limiting
      const BATCH_SIZE = 10;
      const DELAY_MS = 1000;

      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.allSettled(
          batch.map(lead => {
            const content = campaign.message_template
              .replace(/\{\{name\}\}/gi, lead.full_name || "")
              .replace(/\{\{amount\}\}/gi, String(lead.loan_amount || ""))
              .replace(/\{\{status\}\}/gi, lead.status || "")
              .replace(/\{\{city\}\}/gi, lead.city || "")
              .replace(/\{\{loan_type\}\}/gi, lead.loan_type || "");

            // Build template_params matching exactly the number of variables the template expects
            let params: string[] | undefined = undefined;
            if (templateName && templateVarCount > 0) {
              const allValues = [lead.full_name || "Customer", String(lead.loan_amount || ""), lead.loan_type || "", lead.city || ""];
              params = allValues.slice(0, templateVarCount);
            }

            return supabase.functions.invoke("send-whatsapp", {
              body: {
                account_id: accountId,
                phone_number: lead.phone,
                contact_name: lead.full_name,
                lead_id: lead.id,
                message: templateName ? undefined : content,
                template_name: templateName || undefined,
                template_language: templateName ? templateLanguage : undefined,
                template_params: params,
                message_source: "campaign",
              },
            });
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value?.data?.success) {
            sentCount++;
          } else {
            failedCount++;
          }
        }

        // Update progress
        toast.info(`Sending... ${sentCount + failedCount}/${leads.length} (${sentCount} sent, ${failedCount} failed)`);

        // Delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < leads.length) {
          await new Promise(r => setTimeout(r, DELAY_MS));
        }
      }

      await supabase
        .from("whatsapp_campaigns")
        .update({ 
          status: failedCount === leads.length ? "failed" : "completed",
          sent_count: sentCount,
          delivered_count: sentCount
        })
        .eq("id", campaign.id);

      toast.success(`Campaign complete: ${sentCount} sent, ${failedCount} failed out of ${leads.length}`);
      fetchCampaigns();
    } catch (error) {
      console.error("Error executing campaign:", error);
      toast.error("Failed to execute campaign");
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.content);
    }
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const resetForm = () => {
    setName("");
    setMessage("");
    setSelectedStatuses([]);
    setSelectedTemplate("");
    setUseTemplate(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "sending":
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" /> Sending</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Bulk Campaigns</h3>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Bulk Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  placeholder="e.g., January Promotion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Template Selection - Primary */}
              <div className="space-y-2">
                <Label className="font-semibold">Message Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={useTemplate ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseTemplate(true)}
                  >
                    Use Template
                  </Button>
                  <Button
                    type="button"
                    variant={!useTemplate ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseTemplate(false)}
                  >
                    Custom Message
                  </Button>
                </div>
              </div>

              {useTemplate ? (
                <div className="space-y-2">
                  <Label>Select Template *</Label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <SelectItem value="none" disabled>No templates available</SelectItem>
                      ) : (
                        templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.language || "en"})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Template Preview:</p>
                      {message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Message *</Label>
                  <Textarea
                    placeholder="Hello {{name}}, your loan of ₹{{amount}} is being processed..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{{name}}, {{amount}}, {{status}}"}
                  </p>
                </div>
              )}

              {/* Target Status */}
              <div className="space-y-2">
                <Label>Target Lead Status *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {leadStatuses.map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`campaign-${status}`}
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() => toggleStatus(status)}
                      />
                      <label htmlFor={`campaign-${status}`} className="text-sm capitalize cursor-pointer">
                        {status.replace(/_/g, " ")}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Lead Date Filter
                </Label>
                <DateFilterSelect
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  customStart={customStart}
                  customEnd={customEnd}
                  setCustomStart={setCustomStart}
                  setCustomEnd={setCustomEnd}
                  showYesterday
                />
                <p className="text-xs text-muted-foreground">
                  Filter leads by creation date. "All Time" targets all matching leads.
                </p>
              </div>

              {targetCount > 0 && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {targetCount} leads will receive this message
                  </p>
                </div>
              )}

              <Button onClick={handleCreateCampaign} className="w-full">
                <Send className="w-4 h-4 mr-2" /> Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{campaign.name}</h4>
                    {getStatusBadge(campaign.status)}
                    {campaign.template_name && (
                      <Badge variant="outline" className="text-xs">
                        Template: {campaign.template_name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {campaign.message_template}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Target: {campaign.target_status?.join(", ")}
                    </span>
                    {campaign.executed_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(campaign.executed_at), "dd MMM yyyy HH:mm")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {campaign.status === "draft" && (
                    <Button size="sm" onClick={() => handleExecuteCampaign(campaign)}>
                      <Play className="w-4 h-4 mr-1" /> Execute
                    </Button>
                  )}
                  {campaign.status === "completed" && (
                    <div className="text-sm">
                      <p className="text-green-600">{campaign.sent_count} sent</p>
                      <p className="text-muted-foreground">{campaign.delivered_count} delivered</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {campaigns.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Send className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No campaigns yet</p>
            <p className="text-sm">Create a bulk campaign to reach multiple leads</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppCampaigns;
