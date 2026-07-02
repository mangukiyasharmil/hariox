import { useState, useEffect } from "react";
import { History, CheckCircle, XCircle, Clock, User, Zap, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorkflowLog {
  id: string;
  workflow_id: string | null;
  workflow_name: string;
  lead_id: string | null;
  lead_name: string | null;
  trigger_type: string;
  status: string;
  actions_executed: string[];
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

const triggerLabels: Record<string, string> = {
  lead_created: "Lead Created",
  status_changed: "Status Changed",
  payment_received: "Payment Received",
  document_uploaded: "Doc Uploaded",
  documents_verified: "Docs Verified",
  loan_approved: "Loan Approved",
  loan_rejected: "Loan Rejected",
  loan_disbursed: "Loan Disbursed",
};

const WorkflowLogs = () => {
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("workflow_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Type cast the data properly
      const typedLogs = (data || []).map(log => ({
        ...log,
        actions_executed: Array.isArray(log.actions_executed) 
          ? log.actions_executed as string[]
          : [],
      }));
      
      setLogs(typedLogs);
    } catch (error) {
      console.error("Error fetching workflow logs:", error);
      toast.error("Failed to fetch logs");
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm("Clear all workflow logs? This cannot be undone.")) return;

    try {
      const { error } = await supabase.from("workflow_logs").delete().neq("id", "");
      if (error) throw error;
      setLogs([]);
      toast.success("Logs cleared");
    } catch (error) {
      console.error("Error clearing logs:", error);
      toast.error("Failed to clear logs");
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "completed") return log.status === "completed";
    if (filter === "failed") return log.status === "failed";
    return true;
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Execution Logs</h3>
          <span className="text-xs text-muted-foreground">({filteredLogs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5 text-xs">
            {(["all", "completed", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded capitalize ${
                  filter === f ? "bg-background shadow-sm" : ""
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={fetchLogs}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearLogs}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Logs List */}
      <div className="border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No workflow executions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-auto">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {log.status === "completed" ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{log.workflow_name}</span>
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px]">
                          {triggerLabels[log.trigger_type] || log.trigger_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {log.lead_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.lead_name}
                          </span>
                        )}
                        {log.execution_time_ms !== null && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.execution_time_ms}ms
                          </span>
                        )}
                      </div>
                      {log.actions_executed && log.actions_executed.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {log.actions_executed.map((action, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-[10px]"
                            >
                              <Zap className="w-2.5 h-2.5" />
                              {action}
                            </span>
                          ))}
                        </div>
                      )}
                      {log.error_message && (
                        <p className="mt-1 text-xs text-red-500">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTime(log.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowLogs;
