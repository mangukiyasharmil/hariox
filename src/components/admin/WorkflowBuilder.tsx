import { useState, useEffect } from "react";
import { Plus, Play, Pause, Trash2, Zap, ArrowRight, Edit, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import WorkflowEditor from "./workflow/WorkflowEditor";
import WorkflowLogs from "./WorkflowLogs";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  actions: { nodes?: unknown[] } | null;
  is_active: boolean;
  created_at: string;
}

const triggerLabels: Record<string, string> = {
  lead_created: "New Lead Created",
  status_changed: "Status Changed",
  payment_received: "Payment Received",
  document_uploaded: "Document Uploaded",
  form_filled: "Form Filled",
  follow_up: "Follow Up Due",
  documents_verified: "Documents Verified",
  loan_approved: "Loan Approved",
  loan_rejected: "Loan Rejected",
  loan_disbursed: "Loan Disbursed",
};

const WorkflowBuilder = () => {
  const { currentCompany } = useCompany();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, [currentCompany?.id]);

  const fetchWorkflows = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("workflows")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Company isolation for workflows
      if (currentCompany?.id) {
        query = query.eq("company_id", currentCompany.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setWorkflows((data || []) as unknown as Workflow[]);
    } catch (error) {
      console.error("Error fetching workflows:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    await supabase
      .from("workflows")
      .update({ is_active: !workflow.is_active })
      .eq("id", workflow.id);
    fetchWorkflows();
    toast.success(workflow.is_active ? "Workflow paused" : "Workflow activated");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    await supabase.from("workflows").delete().eq("id", id);
    fetchWorkflows();
    toast.success("Workflow deleted");
  };

  const handleEdit = (workflowId: string) => {
    setEditingWorkflowId(workflowId);
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditingWorkflowId(null);
    setShowEditor(true);
  };

  const handleBack = () => {
    setShowEditor(false);
    setEditingWorkflowId(null);
    fetchWorkflows();
  };

  if (showEditor) {
    return (
      <div className="h-[calc(100vh-200px)] -m-6">
        <WorkflowEditor workflowId={editingWorkflowId} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Workflow Automation</h2>
          <p className="text-sm text-muted-foreground">Create visual automation flows with triggers, conditions, and actions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLogs(!showLogs)}>
            <History className="w-4 h-4 mr-1" />
            {showLogs ? "Hide Logs" : "Logs"}
          </Button>
          <Button variant="hero" onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Logs Section */}
      {showLogs && (
        <WorkflowLogs />
      )}

      {/* Workflows List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-medium mb-2">No workflows yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first automation to streamline your operations
            </p>
            <Button variant="hero" onClick={handleNew}>
              <Plus className="w-4 h-4 mr-1" />
              Create Workflow
            </Button>
          </div>
        ) : (
          workflows.map((workflow) => {
            const nodeCount = (workflow.actions as any)?.nodes?.length || 0;
            return (
              <div key={workflow.id} className="bg-card rounded-xl border border-border p-5 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{workflow.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        workflow.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}>
                        {workflow.is_active ? "Running" : "Paused"}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={workflow.is_active} onCheckedChange={() => handleToggleActive(workflow)} />
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(workflow.id)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(workflow.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-700 rounded-lg text-sm">
                    <Zap className="w-3 h-3" />
                    <span>{triggerLabels[workflow.trigger_type] || workflow.trigger_type.replace(/_/g, " ")}</span>
                  </div>
                  {nodeCount > 1 && (
                    <>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="px-3 py-1.5 bg-muted rounded-lg text-sm">
                        {nodeCount - 1} action{nodeCount - 1 > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Created {new Date(workflow.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilder;
