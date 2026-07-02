import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead } from "@/types/database";
import { useCompany } from "@/contexts/CompanyContext";
import {
  SMS_TEMPLATES,
  getSMSTemplate,
  getPreviewMessage,
  getCompanyTelecallerTemplate,
} from "@/config/smsTemplates";

interface SendSMSDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SendSMSDialog = ({ lead, open, onOpenChange }: SendSMSDialogProps) => {
  const navigate = useNavigate();
  const { currentCompany, companies } = useCompany();
  
  // Resolve companySlug from the lead's own company_id if available, falling back to active tab's company context
  const getEffectiveCompanySlug = () => {
    console.log("getEffectiveCompanySlug check:", { leadCompanyId: lead?.company_id, companiesList: companies });
    if (lead?.company_id && companies && companies.length > 0) {
      const matched = companies.find(c => c.id === lead.company_id);
      if (matched?.slug) {
        console.log("Matched slug:", matched.slug);
        return matched.slug;
      }
    }
    console.log("Fallback slug:", currentCompany?.slug);
    return currentCompany?.slug || "hariox";
  };

  const companySlug = getEffectiveCompanySlug();
  
  // Get company-specific telecaller template as default
  const defaultTemplate = getCompanyTelecallerTemplate(companySlug);
  
  const [templateType, setTemplateType] = useState<string>(defaultTemplate);
  const [var1, setVar1] = useState("");
  const [var2, setVar2] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Reset to company-specific template when company changes or lead changes
  useEffect(() => {
    if (open && lead) {
      const activeSlug = getEffectiveCompanySlug();
      setTemplateType(getCompanyTelecallerTemplate(activeSlug));
    }
  }, [open, lead?.id, lead?.company_id, currentCompany?.slug, companies]);

  const selectedTemplate = getSMSTemplate(templateType);
  const varCount = selectedTemplate?.varCount || 0;
  
  // Get company-specific telecaller template for priority display
  const companyTelecallerValue = getCompanyTelecallerTemplate(companySlug);
  const companyTelecallerTemplate = getSMSTemplate(companyTelecallerValue);
  
  // Filter templates by category
  const telecallerTemplates = SMS_TEMPLATES.filter(t => t.category === "telecaller");
  const statusTemplates = SMS_TEMPLATES.filter(t => t.category === "status");
  const marketingTemplates = SMS_TEMPLATES.filter(t => t.category === "marketing");

  console.log("SendSMSDialog debugging:", {
    leadId: lead?.id,
    leadCompanyId: lead?.company_id,
    resolvedCompanySlug: companySlug,
    companiesListLength: companies?.length,
    telecallerTemplatesCount: telecallerTemplates.length,
    marketingTemplatesCount: marketingTemplates.length,
  });

  const getPreview = (): string => {
    if (!selectedTemplate || !lead) return "";
    const amount = var1 || String(lead.loan_amount || "0").replace(/,/g, "");
    const url = var2 || "";
    return getPreviewMessage(selectedTemplate, amount, url);
  };

  const handleSend = async () => {
    if (!lead) return;

    setIsSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (!token) {
        toast.error("Session expired. Please sign in again.");
        onOpenChange(false);
        navigate("/admin");
        return;
      }

      const payload: Record<string, unknown> = {
        type: templateType,
        phone: lead.phone,
        leadId: lead.id,
        company_id: lead.company_id,
        variables: {
          var1: var1 || String(lead.loan_amount ?? "").replace(/,/g, ""),
          var2: var2,
          val: var1 || String(lead.loan_amount ?? "").replace(/,/g, ""),
        },
      };

      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: payload,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("SMS sent successfully");
        onOpenChange(false);
        setVar1("");
        setVar2("");
        setTemplateType(defaultTemplate);
      } else if (data?.skipped) {
        toast.info("SMS is disabled in system settings");
      } else {
        toast.error(data?.error || "Failed to send SMS");
      }
    } catch (err: unknown) {
      console.error("SMS error:", err);
      let message = err instanceof Error ? err.message : "Failed to send SMS";
      const anyErr = err as any;
      const res = anyErr?.context as Response | undefined;
      if (res && typeof res.clone === "function") {
        const body = await res.clone().json().catch(() => null);
        if (body?.error) message = String(body.error);
      }
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Send SMS to {lead.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p><strong>Phone:</strong> +91 {lead.phone}</p>
            <p><strong>Loan Amount:</strong> ₹{lead.loan_amount?.toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            <Label>Select Template</Label>
            <Select value={templateType} onValueChange={setTemplateType}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {/* Company-specific Telecaller Template - Show First */}
                <SelectItem value="__header_telecaller" disabled className="font-bold text-primary">
                  — Telecaller SMS ({companies.find(c => c.slug === companySlug)?.name || currentCompany?.name || "Credit"}) —
                </SelectItem>
                {companyTelecallerTemplate && (
                  <SelectItem 
                    key={companyTelecallerTemplate.value} 
                    value={companyTelecallerTemplate.value} 
                    className="bg-primary/5"
                  >
                    ⭐ {companyTelecallerTemplate.label}
                  </SelectItem>
                )}
                
                {/* Other Telecaller Templates */}
                {telecallerTemplates
                  .filter(t => t.value !== companyTelecallerValue)
                  .map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                
                {/* Status/Transaction SMS */}
                <SelectItem value="__header_status" disabled className="font-bold text-muted-foreground mt-2">
                  — Status/Transaction SMS —
                </SelectItem>
                {statusTemplates.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
                
                {/* Marketing SMS */}
                <SelectItem value="__header_marketing" disabled className="font-bold text-muted-foreground mt-2">
                  — Marketing/Remarketing SMS —
                </SelectItem>
                {marketingTemplates.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} {t.varCount === 1 ? "(Fixed URL)" : "(Dynamic URL)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variable inputs */}
          {varCount >= 1 && (
            <div className="space-y-2">
              <Label>Variable 1 (Amount)</Label>
              <Input
                placeholder={`Default: ${lead.loan_amount || "0"}`}
                value={var1}
                onChange={(e) => setVar1(e.target.value)}
              />
            </div>
          )}

          {varCount >= 2 && (
            <div className="space-y-2">
              <Label>Variable 2 (URL)</Label>
              <Input
                placeholder="https://example.com/pay"
                value={var2}
                onChange={(e) => setVar2(e.target.value)}
              />
            </div>
          )}

          {/* Template Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preview (Final Message)</Label>
            <div className="bg-muted/50 rounded-lg p-3 text-sm max-h-32 overflow-y-auto border">
              {getPreview()}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendSMSDialog;
