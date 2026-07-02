import { useState, useEffect } from "react";
import { Play, Pause, Save, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import WorkflowCanvas, { WorkflowNode } from "./WorkflowCanvas";
import TriggerPicker from "./TriggerPicker";
import ActionPicker from "./ActionPicker";
import NodeConfigPanel from "./NodeConfigPanel";

interface WorkflowEditorProps {
  workflowId: string | null;
  onBack: () => void;
}

interface Telecaller {
  user_id: string;
  full_name: string;
}

const WorkflowEditor = ({ workflowId, onBack }: WorkflowEditorProps) => {
  const { currentCompany } = useCompany();
  const [name, setName] = useState("Untitled Automation");
  const [description, setDescription] = useState("");
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [scheduleEnable, setScheduleEnable] = useState("");
  const [scheduleDisable, setScheduleDisable] = useState("");
  const [allowReentry, setAllowReentry] = useState(true);
  const [specificTime, setSpecificTime] = useState(false);
  
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [showTriggerPicker, setShowTriggerPicker] = useState(false);
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [pendingBranch, setPendingBranch] = useState<"yes" | "no" | null>(null);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTelecallers();
    if (workflowId) loadWorkflow(workflowId);
  }, [workflowId]);

  const fetchTelecallers = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "telecaller");

    if (roles && roles.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roles.map(r => r.user_id));
      
      setTelecallers(profiles as Telecaller[] || []);
    }
  };

  const loadWorkflow = async (id: string) => {
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (data && !error) {
      setName(data.name);
      setDescription(data.description || "");
      setIsActive(data.is_active);
      
      // Parse nodes from actions
      const savedNodes = (data.actions as any)?.nodes || [];
      setNodes(savedNodes);
      
      // Parse schedule config
      const triggerConfig = data.trigger_config as any;
      if (triggerConfig) {
        setScheduleEnable(triggerConfig.schedule_enable || "");
        setScheduleDisable(triggerConfig.schedule_disable || "");
        setAllowReentry(triggerConfig.allow_reentry !== false);
        setSpecificTime(triggerConfig.specific_time || false);
      }
    }
  };

  const handleNodeClick = (node: WorkflowNode) => {
    if (node.id === "new") {
      // New node creation
      const parentId = node.config.parentId as string | null;
      const branch = node.config.branch as "yes" | "no" | undefined;
      
      setPendingParentId(parentId);
      setPendingBranch(branch || null);
      
      if (!parentId && nodes.length === 0) {
        // Adding trigger
        setShowTriggerPicker(true);
      } else {
        // Adding action
        setShowActionPicker(true);
      }
    } else {
      setSelectedNode(node);
    }
  };

  const handleTriggerSelect = (categoryId: string, triggerId: string, label: string) => {
    const newNode: WorkflowNode = {
      id: `trigger_${Date.now()}`,
      type: "trigger",
      category: categoryId,
      label,
      config: { categoryId, triggerId },
      children: [],
    };
    setNodes([newNode]);
    setSelectedNode(newNode);
  };

  const handleActionSelect = (categoryId: string, actionId: string, label: string) => {
    const nodeType = categoryId === "condition" ? "condition" : 
                     categoryId === "delay" ? "delay" : "action";
    
    const newNode: WorkflowNode = {
      id: `${nodeType}_${Date.now()}`,
      type: nodeType,
      category: categoryId,
      label,
      config: { categoryId, actionId },
      children: nodeType !== "condition" ? [] : undefined,
    };

    // Add to parent
    if (pendingParentId) {
      setNodes(prevNodes => {
        const updated = [...prevNodes, newNode];
        return updated.map(n => {
          if (n.id === pendingParentId) {
            if (pendingBranch === "yes") {
              return { ...n, yesChild: newNode.id };
            } else if (pendingBranch === "no") {
              return { ...n, noChild: newNode.id };
            } else {
              return { ...n, children: [...(n.children || []), newNode.id] };
            }
          }
          return n;
        });
      });
    } else {
      setNodes(prev => [...prev, newNode]);
    }

    setPendingParentId(null);
    setPendingBranch(null);
    setSelectedNode(newNode);
  };

  const handleNodeUpdate = (config: Record<string, unknown>) => {
    if (!selectedNode) return;
    setNodes(prevNodes =>
      prevNodes.map(n =>
        n.id === selectedNode.id ? { ...n, config: { ...n.config, ...config } } : n
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const triggerNode = nodes.find(n => n.type === "trigger");

      const workflowData = {
        name,
        description: description || null,
        trigger_type: triggerNode?.config.triggerId || "lead_created",
        trigger_config: {
          ...triggerNode?.config,
          schedule_enable: scheduleEnable || null,
          schedule_disable: scheduleDisable || null,
          allow_reentry: allowReentry,
          specific_time: specificTime,
        },
        actions: { nodes },
        is_active: isActive,
        created_by: session?.user.id,
        company_id: currentCompany?.id || null,
      };

      if (workflowId) {
        await supabase
          .from("workflows")
          .update(workflowData as any)
          .eq("id", workflowId);
      } else {
        await supabase.from("workflows").insert(workflowData as any);
      }

      toast.success("Workflow saved!");
      onBack();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className={`text-sm ${isActive ? "text-green-600" : "text-muted-foreground"}`}>
                {isActive ? "Running" : "Paused"}
              </span>
            </div>
          </div>
          
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs text-center font-medium border-none bg-transparent focus:ring-0"
            placeholder="Workflow Name"
          />

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Play className="w-4 h-4 mr-1" />
              Test Workflow
            </Button>
            <Button variant="hero" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 p-4 overflow-auto">
          <WorkflowCanvas
            nodes={nodes}
            onNodesChange={setNodes}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNode?.id || null}
          />
        </div>
      </div>

      {/* Right Sidebar - Config Panel */}
      <div className="w-80 border-l bg-card p-4 overflow-y-auto">
        {selectedNode ? (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={handleNodeUpdate}
            telecallers={telecallers}
          />
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold">{name}</h3>
              {nodes.find(n => n.type === "trigger") ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {nodes.find(n => n.type === "trigger")?.label}
                </p>
              ) : (
                <p className="text-sm text-destructive mt-1">Trigger Not Set</p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Below is general information of the automation. You can update the settings and click 'Save' button.
            </p>

            <div className="space-y-4">
              <div>
                <Label>Schedule Enable</Label>
                <Input
                  type="datetime-local"
                  value={scheduleEnable}
                  onChange={(e) => setScheduleEnable(e.target.value)}
                  placeholder="dd-mm-yyyy --:--"
                />
              </div>

              <div>
                <Label>
                  Schedule Disable
                  <span className="text-xs text-muted-foreground ml-1">
                    (if date not selected then it will not disable automatically)
                  </span>
                </Label>
                <Input
                  type="datetime-local"
                  value={scheduleDisable}
                  onChange={(e) => setScheduleDisable(e.target.value)}
                  placeholder="dd-mm-yyyy --:--"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Allow Re-entry</Label>
                <Switch checked={allowReentry} onCheckedChange={setAllowReentry} />
              </div>

              <div className="flex items-center justify-between">
                <Label>Specific Time</Label>
                <Switch checked={specificTime} onCheckedChange={setSpecificTime} />
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Pickers */}
      <TriggerPicker
        open={showTriggerPicker}
        onOpenChange={setShowTriggerPicker}
        onSelect={handleTriggerSelect}
      />
      <ActionPicker
        open={showActionPicker}
        onOpenChange={setShowActionPicker}
        onSelect={handleActionSelect}
      />
    </div>
  );
};

export default WorkflowEditor;
