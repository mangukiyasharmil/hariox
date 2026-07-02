import { useState, useEffect } from "react";
import { Plus, Trash2, Save, MessageCircle, Bot, Clock, Tag, User, Zap, StopCircle, FileText, Sparkles, MousePointerClick, MessageSquare, Settings2, Play, Pause, ArrowDown, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Workflow {
  id: string;
  account_id: string | null;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: any;
  is_active: boolean;
  priority: number;
  created_at: string;
  actions?: WorkflowAction[];
}

interface WorkflowAction {
  id: string;
  workflow_id: string;
  action_type: string;
  action_config: any;
  sequence_order: number;
}

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
}

interface WhatsAppWorkflowBuilderProps {
  accountId: string | null;
}

const TRIGGER_TYPES = [
  { id: "lead_created", label: "Lead Created", icon: Zap, color: "bg-emerald-500", description: "New lead for remarketing" },
  { id: "incoming_message", label: "Message Received", icon: MessageCircle, color: "bg-blue-500", description: "Any incoming message" },
  { id: "keyword", label: "Keyword Match", icon: MessageSquare, color: "bg-purple-500", description: "Specific keywords" },
  { id: "button_click", label: "Button Reply", icon: MousePointerClick, color: "bg-amber-500", description: "Button interaction" },
  { id: "no_reply_timeout", label: "No Reply Timeout", icon: Clock, color: "bg-orange-500", description: "User didn't reply" },
  { id: "payment_received", label: "Payment Received", icon: Zap, color: "bg-green-600", description: "Payment confirmed" },
];

const ACTION_TYPES = [
  { id: "send_message", label: "Send Message", icon: MessageCircle, color: "bg-blue-500", description: "Text message" },
  { id: "send_template", label: "Send Template", icon: FileText, color: "bg-indigo-500", description: "Pre-approved template" },
  { id: "ai_reply", label: "AI Auto-Reply", icon: Sparkles, color: "bg-violet-500", description: "AI response" },
  { id: "assign_agent", label: "Assign Agent", icon: User, color: "bg-cyan-500", description: "Route to human" },
  { id: "add_tag", label: "Add Tag", icon: Tag, color: "bg-pink-500", description: "Tag conversation" },
  { id: "delay", label: "Wait / Delay", icon: Clock, color: "bg-amber-500", description: "Pause before next" },
  { id: "stop_automation", label: "Stop All", icon: StopCircle, color: "bg-red-500", description: "Stop automations" },
];

const DELAY_PRESETS = [
  { label: "1 minute", value: 1 },
  { label: "5 minutes", value: 5 },
  { label: "1 hour", value: 60 },
  { label: "1 day", value: 1440 },
  { label: "2 days", value: 2880 },
  { label: "3 days", value: 4320 },
  { label: "5 days", value: 7200 },
  { label: "7 days", value: 10080 },
  { label: "Custom", value: 0 },
];

const WhatsAppWorkflowBuilder = ({ accountId }: WhatsAppWorkflowBuilderProps) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [actions, setActions] = useState<Partial<WorkflowAction>[]>([]);
  const [showActionPicker, setShowActionPicker] = useState(false);

  useEffect(() => {
    if (accountId) {
      fetchWorkflows();
      fetchLogs();
      fetchTemplates();
    }
  }, [accountId]);

  const fetchWorkflows = async () => {
    try {
      const { data } = await supabase
        .from("whatsapp_workflows")
        .select("*")
        .eq("account_id", accountId)
        .order("priority", { ascending: false });

      const withActions = await Promise.all(
        (data || []).map(async (w) => {
          const { data: acts } = await supabase
            .from("whatsapp_workflow_actions")
            .select("*")
            .eq("workflow_id", w.id)
            .order("sequence_order");
          return { ...w, actions: acts || [] };
        })
      );
      setWorkflows(withActions);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    let query = supabase
      .from("whatsapp_workflow_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (accountId) query = query.eq("workflow_id", accountId);
    // Filter by workflows belonging to this account
    const { data: wfIds } = await supabase
      .from("whatsapp_workflows")
      .select("id")
      .eq("account_id", accountId);
    const ids = (wfIds || []).map(w => w.id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("whatsapp_workflow_logs")
        .select("*")
        .in("workflow_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs(data || []);
    } else {
      setLogs([]);
    }
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("id, name, content, variables")
      .eq("account_id", accountId)
      .eq("is_active", true);
    setTemplates(data || []);
  };

  const handleNew = () => {
    setSelectedWorkflow(null);
    setName(""); setDescription(""); setTriggerType(""); setTriggerConfig({}); setActions([]);
    setIsEditing(true);
  };

  const handleEdit = (w: Workflow) => {
    setSelectedWorkflow(w);
    setName(w.name);
    setDescription(w.description || "");
    setTriggerType(w.trigger_type);
    setTriggerConfig(w.trigger_config || {});
    setActions(w.actions || []);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name || !triggerType) { toast.error("Name and trigger required"); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (selectedWorkflow) {
        await supabase.from("whatsapp_workflows").update({ name, description, trigger_type: triggerType, trigger_config: triggerConfig }).eq("id", selectedWorkflow.id);
        await supabase.from("whatsapp_workflow_actions").delete().eq("workflow_id", selectedWorkflow.id);
        if (actions.length > 0) {
          await supabase.from("whatsapp_workflow_actions").insert(
            actions.map((a, i) => ({ workflow_id: selectedWorkflow.id, action_type: a.action_type!, action_config: a.action_config || {}, sequence_order: i }))
          );
        }
        toast.success("Workflow updated");
      } else {
        const { data: nw, error } = await supabase.from("whatsapp_workflows").insert({ account_id: accountId, name, description, trigger_type: triggerType, trigger_config: triggerConfig, created_by: session?.user.id }).select().single();
        if (error) throw error;
        if (actions.length > 0 && nw) {
          await supabase.from("whatsapp_workflow_actions").insert(
            actions.map((a, i) => ({ workflow_id: nw.id, action_type: a.action_type!, action_config: a.action_config || {}, sequence_order: i }))
          );
        }
        toast.success("Workflow created");
      }
      fetchWorkflows();
      setIsEditing(false);
    } catch (e: any) {
      toast.error("Failed to save");
      console.error(e);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("whatsapp_workflows").update({ is_active: active }).eq("id", id);
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, is_active: active } : w));
    toast.success(active ? "Activated" : "Paused");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await supabase.from("whatsapp_workflows").delete().eq("id", id);
    setWorkflows(prev => prev.filter(w => w.id !== id));
    toast.success("Deleted");
  };

  const handleAddAction = (type: string) => {
    setActions([...actions, { action_type: type, action_config: {} }]);
    setShowActionPicker(false);
  };

  const handleUpdateAction = (idx: number, config: Record<string, any>) => {
    const u = [...actions];
    u[idx] = { ...u[idx], action_config: config };
    setActions(u);
  };

  const handleRemoveAction = (idx: number) => setActions(actions.filter((_, i) => i !== idx));

  if (!accountId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Zap className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p>Select a WhatsApp account to manage automations</p>
      </div>
    );
  }

  // Visual Flow Builder Editor
  if (isEditing) {
    const selectedTrigger = TRIGGER_TYPES.find(t => t.id === triggerType);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>← Back</Button>
          <Button onClick={handleSave} className="bg-[#25D366] hover:bg-[#20b858]">
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>

        {/* Name & Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="text-xs">Name *</Label><Input placeholder="Workflow name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Description</Label><Input placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>

        {/* Visual Flow */}
        <div className="bg-muted/30 rounded-xl border border-border p-6 min-h-[400px]">
          <p className="text-[10px] text-muted-foreground mb-4 uppercase tracking-wider font-medium">Visual Flow Builder</p>

          {/* TRIGGER NODE */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-muted-foreground mb-2">WHEN</div>
            {triggerType ? (
              <div 
                className={`${selectedTrigger?.color || "bg-emerald-500"} text-white px-5 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-xl transition-shadow min-w-[220px] justify-center`}
                onClick={() => setTriggerType("")}
              >
                {selectedTrigger && <selectedTrigger.icon className="w-5 h-5" />}
                <div>
                  <p className="font-semibold text-sm">{selectedTrigger?.label}</p>
                  <p className="text-[10px] opacity-80">{selectedTrigger?.description}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-xl">
                {TRIGGER_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTriggerType(t.id)}
                      className={`${t.color} text-white p-3 rounded-xl text-left hover:opacity-90 transition-opacity`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      <p className="font-medium text-xs">{t.label}</p>
                      <p className="text-[9px] opacity-70">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Trigger Config */}
            {triggerType === "keyword" && (
              <div className="mt-3 w-full max-w-md">
                <Input
                  placeholder="Keywords (comma-separated): hi, hello, loan"
                  value={triggerConfig.keywords || ""}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, keywords: e.target.value })}
                  className="text-sm"
                />
              </div>
            )}
            {triggerType === "button_click" && (
              <div className="mt-3 w-full max-w-md">
                <Input
                  placeholder="Button payload ID: interested, apply_now"
                  value={triggerConfig.button_id || ""}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, button_id: e.target.value })}
                  className="text-sm"
                />
              </div>
            )}
            {triggerType === "no_reply_timeout" && (
              <div className="mt-3 w-full max-w-md">
                <Input
                  type="number"
                  placeholder="Timeout in hours (e.g. 24)"
                  value={triggerConfig.timeout_hours || ""}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, timeout_hours: parseInt(e.target.value) })}
                  className="text-sm"
                />
              </div>
            )}

            {triggerType && (
              <>
                {/* Connector Line */}
                <div className="w-0.5 h-8 bg-border" />
                <ArrowDown className="w-4 h-4 text-muted-foreground -mt-1 -mb-1" />
                <div className="w-0.5 h-4 bg-border" />

                {/* ACTION NODES */}
                {actions.map((action, idx) => {
                  const actionInfo = ACTION_TYPES.find(a => a.id === action.action_type);
                  const Icon = actionInfo?.icon || Zap;
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="text-[10px] text-muted-foreground mb-1">{idx === 0 ? "THEN" : "AND THEN"}</div>
                      <div className={`${actionInfo?.color || "bg-blue-500"} text-white px-5 py-3 rounded-xl flex items-center gap-3 shadow-md min-w-[280px] relative group`}>
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{actionInfo?.label}</p>
                          {/* Inline config */}
                          <ActionConfig
                            action={action}
                            index={idx}
                            templates={templates}
                            onUpdate={handleUpdateAction}
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveAction(idx)}
                          className="absolute -right-2 -top-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                      <div className="w-0.5 h-6 bg-border" />
                      <ArrowDown className="w-4 h-4 text-muted-foreground -mt-1 -mb-1" />
                      <div className="w-0.5 h-4 bg-border" />
                    </div>
                  );
                })}

                {/* Add Action Button */}
                <Dialog open={showActionPicker} onOpenChange={setShowActionPicker}>
                  <DialogTrigger asChild>
                    <button className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-[#25D366] hover:bg-[#25D366]/10 transition-all">
                      <Plus className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Action</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-2">
                      {ACTION_TYPES.map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.id}
                            onClick={() => handleAddAction(a.id)}
                            className={`${a.color} text-white p-3 rounded-xl text-left hover:opacity-90 transition-opacity`}
                          >
                            <Icon className="w-4 h-4 mb-1" />
                            <p className="font-medium text-xs">{a.label}</p>
                            <p className="text-[9px] opacity-70">{a.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Workflow List View
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Automations</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLogs(!showLogs)}>
            <Clock className="w-3.5 h-3.5 mr-1" /> {showLogs ? "Hide" : "Logs"}
          </Button>
          <Button size="sm" onClick={handleNew} className="bg-[#25D366] hover:bg-[#20b858]">
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
      </div>

      {/* Logs */}
      {showLogs && (
        <Card>
          <CardContent className="p-3">
            <ScrollArea className="h-48">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No logs yet</p>
              ) : (
                <div className="space-y-1">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div>
                        <span className="font-medium">{log.workflow_name}</span>
                        <span className="text-muted-foreground ml-2">{log.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === "completed" ? "default" : "destructive"} className="text-[10px]">{log.status}</Badge>
                        <span className="text-muted-foreground">{format(new Date(log.created_at), "dd MMM HH:mm")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Workflow Cards */}
      <div className="grid gap-3">
        {isLoading ? (
          <div className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12 border rounded-xl border-dashed">
            <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">No automations yet</p>
            <Button size="sm" onClick={handleNew} className="bg-[#25D366] hover:bg-[#20b858]">
              <Plus className="w-4 h-4 mr-1" /> Create First
            </Button>
          </div>
        ) : (
          workflows.map(w => {
            const trigger = TRIGGER_TYPES.find(t => t.id === w.trigger_type);
            const TriggerIcon = trigger?.icon || Zap;
            const actionCount = w.actions?.length || 0;
            return (
              <Card key={w.id} className="hover:border-[#25D366]/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${trigger?.color || "bg-muted"} flex items-center justify-center`}>
                        <TriggerIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{w.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{trigger?.label}</span>
                          {actionCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">→ {actionCount} action{actionCount > 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={w.is_active ? "default" : "secondary"} className={`text-[10px] ${w.is_active ? "bg-green-500" : ""}`}>
                        {w.is_active ? "Active" : "Paused"}
                      </Badge>
                      <Switch checked={w.is_active} onCheckedChange={(v) => handleToggle(w.id, v)} className="scale-75" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(w)}>
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(w.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

// Inline action config component
const ActionConfig = ({ action, index, templates, onUpdate }: { action: Partial<WorkflowAction>; index: number; templates: Template[]; onUpdate: (idx: number, config: any) => void }) => {
  const [expanded, setExpanded] = useState(false);

  if (action.action_type === "send_message") {
    return (
      <div className="mt-1">
        {expanded ? (
          <textarea
            className="w-full bg-white/20 text-white placeholder-white/50 text-xs rounded p-1.5 border-0 resize-none focus:ring-1 focus:ring-white/30"
            placeholder="Type message..."
            rows={2}
            value={action.action_config?.message || ""}
            onChange={(e) => onUpdate(index, { message: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button onClick={() => setExpanded(true)} className="text-[10px] opacity-70 hover:opacity-100">
            {action.action_config?.message ? action.action_config.message.substring(0, 40) + "..." : "Click to add message"}
          </button>
        )}
      </div>
    );
  }

  if (action.action_type === "send_template") {
    return (
      <div className="mt-1">
        <select
          className="w-full bg-white/20 text-white text-xs rounded p-1 border-0"
          value={action.action_config?.template_id || ""}
          onChange={(e) => { e.stopPropagation(); onUpdate(index, { template_id: e.target.value }); }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Select template</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    );
  }

  if (action.action_type === "delay") {
    return (
      <div className="mt-1">
        <select
          className="w-full bg-white/20 text-white text-xs rounded p-1 border-0"
          value={action.action_config?.delay_minutes ? String(action.action_config.delay_minutes) : ""}
          onChange={(e) => {
            e.stopPropagation();
            const val = parseInt(e.target.value);
            const preset = DELAY_PRESETS.find(p => p.value === val);
            onUpdate(index, { delay_minutes: val, delay_label: preset?.label || `${val} min` });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Select delay</option>
          {DELAY_PRESETS.filter(p => p.value > 0).map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
        </select>
      </div>
    );
  }

  if (action.action_type === "ai_reply") {
    return <p className="text-[10px] opacity-70 mt-1">AI will auto-generate response</p>;
  }

  if (action.action_type === "add_tag") {
    return (
      <div className="mt-1">
        <input
          className="w-full bg-white/20 text-white placeholder-white/50 text-xs rounded p-1 border-0"
          placeholder="Tag name"
          value={action.action_config?.tag || ""}
          onChange={(e) => { e.stopPropagation(); onUpdate(index, { tag: e.target.value }); }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  if (action.action_type === "stop_automation") {
    return <p className="text-[10px] opacity-70 mt-1">Stops all active automations</p>;
  }

  return null;
};

export default WhatsAppWorkflowBuilder;
