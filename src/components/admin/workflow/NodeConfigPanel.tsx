import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowNode } from "./WorkflowCanvas";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

const leadStatuses = [
  "unpaid", "paid", "verification", "documents_pending", 
  "documents_uploaded", "verified", "rejected", "processing", "approved", "disbursed", "lost"
];

import { SMS_TEMPLATES } from "@/config/smsTemplates";

const delayUnits = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
];

interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
}

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onUpdate: (config: Record<string, unknown>) => void;
  telecallers: { user_id: string; full_name: string }[];
}

const NodeConfigPanel = ({ node, onUpdate, telecallers }: NodeConfigPanelProps) => {
  const { currentCompany } = useCompany();
  const [config, setConfig] = useState(node.config);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);

  useEffect(() => {
    setConfig(node.config);
  }, [node.id, node.config]);

  useEffect(() => {
    fetchWhatsAppTemplates();
  }, [currentCompany?.id]);

  const fetchWhatsAppTemplates = async () => {
    // Filter templates by the current company's WhatsApp account
    let query = supabase
      .from("whatsapp_templates")
      .select("id, name, content")
      .eq("is_active", true);
    
    if (currentCompany?.id) {
      // Get account IDs for current company
      const { data: accounts } = await supabase
        .from("whatsapp_accounts")
        .select("id")
        .eq("company_id", currentCompany.id);
      
      if (accounts && accounts.length > 0) {
        const accountIds = accounts.map(a => a.id);
        query = query.in("account_id", accountIds);
      }
    }
    
    const { data } = await query;
    setWhatsappTemplates((data || []) as WhatsAppTemplate[]);
  };

  const handleChange = (key: string, value: unknown) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(newConfig);
  };

  const renderTriggerConfig = () => {
    switch (node.config.triggerId) {
      case "status_changed":
        return (
          <div className="space-y-4">
            <div>
              <Label>From Status (optional)</Label>
              <Select
                value={(config.from_status as string) || "any"}
                onValueChange={(v) => handleChange("from_status", v === "any" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Status</SelectItem>
                  {leadStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Status</Label>
              <Select
                value={(config.to_status as string) || ""}
                onValueChange={(v) => handleChange("to_status", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {leadStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case "documents_verified":
        return (
          <div className="p-3 bg-green-500/10 rounded-lg">
            <p className="text-sm text-green-700">Triggers when lead documents are verified and status changes to <strong>verified</strong></p>
          </div>
        );
      case "loan_approved":
        return (
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <p className="text-sm text-blue-700">Triggers when loan is approved and status changes to <strong>approved</strong></p>
          </div>
        );
      case "loan_rejected":
        return (
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="text-sm text-red-700">Triggers when application is rejected and status changes to <strong>rejected</strong></p>
          </div>
        );
      case "loan_disbursed":
        return (
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <p className="text-sm text-emerald-700">Triggers when loan amount is disbursed and status changes to <strong>disbursed</strong></p>
          </div>
        );
      case "whatsapp_button_click":
        return (
          <div className="space-y-4">
            <div>
              <Label>Button Text to Match</Label>
              <Input
                placeholder="e.g., Interested, Apply Now"
                value={(config.button_text as string) || ""}
                onChange={(e) => handleChange("button_text", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Match the exact quick reply button text. Leave empty to match any button click.
              </p>
            </div>
            <div>
              <Label>From Template (optional)</Label>
              <Select
                value={(config.source_template as string) || "any"}
                onValueChange={(v) => handleChange("source_template", v === "any" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Template</SelectItem>
                  {whatsappTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <p className="text-sm text-green-700">
                <strong>How it works:</strong> When a customer taps a Quick Reply button on a WhatsApp template, this workflow triggers automatically.
              </p>
            </div>
          </div>
        );
      case "whatsapp_message_received":
        return (
          <div className="space-y-4">
            <div>
              <Label>Keyword Filter (optional)</Label>
              <Input
                placeholder="e.g., interested, apply, help"
                value={(config.keyword as string) || ""}
                onChange={(e) => handleChange("keyword", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated keywords. Leave empty to trigger on any message.
              </p>
            </div>
          </div>
        );
      case "whatsapp_no_reply":
        return (
          <div className="space-y-4">
            <div>
              <Label>Timeout Duration</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  value={config.timeout_value !== undefined ? (config.timeout_value as string | number) : 24}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange("timeout_value", val === "" ? "" : parseInt(val));
                  }}
                  min={1}
                  max={168}
                  className="w-24"
                />
                <Select
                  value={(config.timeout_unit as string) || "hours"}
                  onValueChange={(v) => handleChange("timeout_unit", v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Trigger if no reply within this timeframe after sending last message.
              </p>
            </div>
          </div>
        );
      default:
        return <p className="text-sm text-muted-foreground">No additional configuration required</p>;
    }
  };

  const renderActionConfig = () => {
    const actionId = config.actionId as string;

    switch (actionId) {
      case "send_whatsapp":
      case "send_whatsapp_media":
        return (
          <div className="space-y-4">
            <div>
              <Label>Select Template</Label>
              <Select
                value={(config.template_id as string) || "custom"}
                onValueChange={(v) => {
                  handleChange("template_id", v);
                  if (v !== "custom") {
                    const template = whatsappTemplates.find(t => t.id === v);
                    if (template) {
                      handleChange("message", template.content);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose template or custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Message</SelectItem>
                  {whatsappTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {whatsappTemplates.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No templates found. Create templates in WhatsApp Marketing → Templates
                </p>
              )}
            </div>
            <div>
              <Label>Message Content</Label>
              <Textarea
                placeholder="Hello {{name}}, your loan application..."
                value={(config.message as string) || ""}
                onChange={(e) => handleChange("message", e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variables: {"{{name}}"}, {"{{phone}}"}, {"{{loan_amount}}"}, {"{{status}}"}
              </p>
            </div>
          </div>
        );

      case "send_sms":
        return (
          <div className="space-y-4">
            <div>
              <Label>SMS Type</Label>
              <Select
                value={(config.sms_type as string) || "status_update"}
                onValueChange={(v) => handleChange("sms_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SMS_TEMPLATES.filter(t => 
                    t.category !== "otp" && 
                    (t.companySlug === null || !currentCompany?.slug || t.companySlug === currentCompany.slug || t.companySlug === currentCompany.slug.split('-')[0])
                  ).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {config.sms_type === "custom" && (
              <div>
                <Label>Custom Message</Label>
                <Textarea
                  placeholder="Enter custom SMS..."
                  value={(config.custom_message as string) || ""}
                  onChange={(e) => handleChange("custom_message", e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        );

      case "start_remarketing":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">3-Day SMS Remarketing Cycle</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sends 6 company-specific SMS over 3 days:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Day 0: 10:00 AM & 9:00 PM IST</li>
                <li>Day 1: 11:00 AM & 7:00 PM IST</li>
                <li>Day 2: 12:00 PM IST</li>
                <li>Day 3: 8:00 PM IST</li>
              </ul>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> Cycle auto-stops when lead makes a payment or status changes to paid/verified/disbursed.
              </p>
            </div>
          </div>
        );

      case "stop_remarketing":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm text-red-700 font-medium">Stop Active Remarketing</p>
              <p className="text-xs text-muted-foreground mt-1">
                This will immediately stop any active remarketing cycle for this lead. 
                No further automated SMS will be sent.
              </p>
            </div>
          </div>
        );

      case "send_email":
        return (
          <div className="space-y-4">
            <div>
              <Label>Email Subject</Label>
              <Input
                placeholder="Your loan application update"
                value={(config.subject as string) || ""}
                onChange={(e) => handleChange("subject", e.target.value)}
              />
            </div>
            <div>
              <Label>Email Body</Label>
              <Textarea
                placeholder="Email content..."
                value={(config.body as string) || ""}
                onChange={(e) => handleChange("body", e.target.value)}
                rows={4}
              />
            </div>
          </div>
        );

      case "assign_to_staff":
        return (
          <div className="space-y-4">
            <div>
              <Label className="mb-3 block">Assignment Method</Label>
              <RadioGroup
                value={(config.assignment_type as string) || "round_robin"}
                onValueChange={(v) => handleChange("assignment_type", v)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                  <RadioGroupItem value="round_robin" id="round_robin" />
                  <div className="flex-1">
                    <Label htmlFor="round_robin" className="font-medium cursor-pointer">Round Robin</Label>
                    <p className="text-xs text-muted-foreground">Distribute leads evenly in rotation</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                  <RadioGroupItem value="least_leads" id="least_leads" />
                  <div className="flex-1">
                    <Label htmlFor="least_leads" className="font-medium cursor-pointer">Least Active Leads</Label>
                    <p className="text-xs text-muted-foreground">Assign to staff with fewest active leads</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50">
                  <RadioGroupItem value="specific" id="specific" />
                  <div className="flex-1">
                    <Label htmlFor="specific" className="font-medium cursor-pointer">Specific Person</Label>
                    <p className="text-xs text-muted-foreground">Always assign to chosen staff member</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
            {config.assignment_type === "specific" && (
              <div>
                <Label>Select Staff Member</Label>
                <Select
                  value={(config.telecaller_id as string) || ""}
                  onValueChange={(v) => handleChange("telecaller_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {telecallers.length === 0 ? (
                      <SelectItem value="" disabled>No staff available</SelectItem>
                    ) : (
                      telecallers.map((t) => (
                        <SelectItem key={t.user_id} value={t.user_id}>
                          {t.full_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case "update_status":
        return (
          <div>
            <Label>New Status</Label>
            <Select
              value={(config.new_status as string) || "paid"}
              onValueChange={(v) => handleChange("new_status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leadStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "wait_minutes":
      case "wait_hours":
      case "wait_days": {
        const defaultUnit = actionId === "wait_minutes" ? "minutes" : actionId === "wait_hours" ? "hours" : "days";
        const currentUnit = (config.delay_unit as string) || defaultUnit;
        
        return (
          <div className="space-y-4">
            <div>
              <Label>Delay Duration</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  value={config.delay_value !== undefined ? (config.delay_value as string | number) : 1}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange("delay_value", val === "" ? "" : parseInt(val));
                  }}
                  min={1}
                  max={365}
                  className="w-24"
                />
                <Select
                  value={currentUnit}
                  onValueChange={(v) => handleChange("delay_unit", v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {delayUnits.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Wait {config.delay_value === "" || config.delay_value === undefined ? "..." : (config.delay_value as string | number)} {currentUnit} before proceeding
              </p>
            </div>
          </div>
        );
      }

      case "wait_until":
        return (
          <div className="space-y-4">
            <div>
              <Label>Wait Until Time</Label>
              <Input
                type="time"
                value={(config.wait_time as string) || "09:00"}
                onChange={(e) => handleChange("wait_time", e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Execute at this time (IST timezone)
              </p>
            </div>
          </div>
        );

      case "if_lead":
      case "if_status":
        return (
          <div className="space-y-4">
            <div>
              <Label>Condition Field</Label>
              <Select
                value={(config.condition_field as string) || "status"}
                onValueChange={(v) => handleChange("condition_field", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Lead Status</SelectItem>
                  <SelectItem value="payment_status">Payment Status</SelectItem>
                  <SelectItem value="loan_type">Loan Type</SelectItem>
                  <SelectItem value="has_documents">Has Documents</SelectItem>
                  <SelectItem value="is_assigned">Is Assigned</SelectItem>
                  <SelectItem value="is_interested">Is Interested</SelectItem>
                  <SelectItem value="cibil_range">CIBIL Score Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition Value</Label>
              {config.condition_field === "status" || !config.condition_field ? (
                <Select
                  value={(config.condition_value as string) || "paid"}
                  onValueChange={(v) => handleChange("condition_value", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leadStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : config.condition_field === "loan_type" ? (
                <Select
                  value={(config.condition_value as string) || "personal"}
                  onValueChange={(v) => handleChange("condition_value", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="marriage">Marriage</SelectItem>
                  </SelectContent>
                </Select>
              ) : config.condition_field === "payment_status" ? (
                <Select
                  value={(config.condition_value as string) || "paid"}
                  onValueChange={(v) => handleChange("condition_value", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              ) : config.condition_field === "has_documents" || config.condition_field === "is_assigned" || config.condition_field === "is_interested" ? (
                <Select
                  value={(config.condition_value as string) || "true"}
                  onValueChange={(v) => handleChange("condition_value", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Value to check"
                  value={(config.condition_value as string) || ""}
                  onChange={(e) => handleChange("condition_value", e.target.value)}
                />
              )}
            </div>
          </div>
        );

      case "if_payment":
        return (
          <div className="space-y-4">
            <div>
              <Label>Payment Condition</Label>
              <Select
                value={(config.condition_value as string) || "completed"}
                onValueChange={(v) => handleChange("condition_value", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Payment Completed</SelectItem>
                  <SelectItem value="pending">Payment Pending</SelectItem>
                  <SelectItem value="failed">Payment Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "stop_automation":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm text-red-700 font-medium">Stop All Automations</p>
              <p className="text-xs text-muted-foreground mt-1">
                This will immediately cancel all pending scheduled workflow actions and stop any 
                active remarketing cycles for this lead. No further automated messages will be sent.
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <p className="text-xs text-amber-700">
                <strong>Tip:</strong> Use this with a "Keyword Match" trigger on keywords like "stop", 
                "unsubscribe" to let customers opt out of automations.
              </p>
            </div>
          </div>
        );

      default:
        return <p className="text-sm text-muted-foreground">Configure {node.label}</p>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h3 className="font-semibold text-lg">{node.label}</h3>
        <p className="text-sm text-muted-foreground capitalize">{node.type}</p>
      </div>

      {node.type === "trigger" ? renderTriggerConfig() : renderActionConfig()}
    </div>
  );
};

export default NodeConfigPanel;
