import { useState, useCallback } from "react";
import { Plus, Trash2, GitBranch, Clock, MessageCircle, Mail, UserPlus, ArrowRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "delay";
  category: string;
  label: string;
  config: Record<string, unknown>;
  children?: string[]; // IDs of child nodes
  yesChild?: string; // For condition nodes
  noChild?: string; // For condition nodes
}

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onNodeClick: (node: WorkflowNode) => void;
  selectedNodeId: string | null;
}

const nodeColors: Record<string, { bg: string; border: string; icon: string }> = {
  trigger: { bg: "bg-green-500", border: "border-green-500", icon: "text-white" },
  action: { bg: "bg-blue-500", border: "border-blue-500", icon: "text-white" },
  condition: { bg: "bg-orange-500", border: "border-orange-500", icon: "text-white" },
  delay: { bg: "bg-gray-400", border: "border-gray-400", icon: "text-white" },
};

const getNodeIcon = (category: string) => {
  switch (category) {
    case "whatsapp":
      return MessageCircle;
    case "sms":
      return MessageCircle;
    case "email":
      return Mail;
    case "assign":
      return UserPlus;
    case "condition":
      return GitBranch;
    case "delay":
      return Clock;
    default:
      return ArrowRight;
  }
};

const WorkflowCanvas = ({ nodes, onNodesChange, onNodeClick, selectedNodeId }: WorkflowCanvasProps) => {
  const [draggingNode, setDraggingNode] = useState<string | null>(null);

  const handleAddNode = (parentId: string | null, branch?: "yes" | "no") => {
    // This will trigger the node picker dialog
    onNodeClick({ id: "new", type: "action", category: "", label: "", config: { parentId, branch } });
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedNodes = nodes.filter(n => n.id !== nodeId);
    // Also remove references from parent nodes
    updatedNodes.forEach(node => {
      if (node.children?.includes(nodeId)) {
        node.children = node.children.filter(id => id !== nodeId);
      }
      if (node.yesChild === nodeId) node.yesChild = undefined;
      if (node.noChild === nodeId) node.noChild = undefined;
    });
    onNodesChange(updatedNodes);
  };

  const renderNode = (node: WorkflowNode, depth: number = 0) => {
    const colors = nodeColors[node.type] || nodeColors.action;
    const Icon = getNodeIcon(node.category);
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Node */}
        <div
          onClick={() => onNodeClick(node)}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer transition-all border-2",
            colors.bg,
            isSelected ? "ring-2 ring-primary ring-offset-2" : "",
            "hover:opacity-90 min-w-[180px] justify-center"
          )}
        >
          <Icon className={cn("w-4 h-4", colors.icon)} />
          <span className="text-white text-sm font-medium">{node.label}</span>
          {node.type !== "trigger" && (
            <button
              onClick={(e) => handleDeleteNode(node.id, e)}
              className="absolute -right-2 -top-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3 text-white" />
            </button>
          )}
        </div>

        {/* Connector line */}
        <div className="w-0.5 h-6 bg-border" />

        {/* Condition branches */}
        {node.type === "condition" ? (
          <div className="flex gap-12">
            {/* Yes Branch */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded">Y</span>
              </div>
              {node.yesChild ? (
                renderNode(nodes.find(n => n.id === node.yesChild)!, depth + 1)
              ) : (
                <AddNodeButton onClick={() => handleAddNode(node.id, "yes")} />
              )}
            </div>

            {/* No Branch */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">N</span>
              </div>
              {node.noChild ? (
                renderNode(nodes.find(n => n.id === node.noChild)!, depth + 1)
              ) : (
                <AddNodeButton onClick={() => handleAddNode(node.id, "no")} />
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Regular children */}
            {node.children?.map(childId => {
              const childNode = nodes.find(n => n.id === childId);
              return childNode ? renderNode(childNode, depth + 1) : null;
            })}
            
            {/* Add button */}
            <AddNodeButton onClick={() => handleAddNode(node.id)} />
          </>
        )}
      </div>
    );
  };

  const rootNode = nodes.find(n => n.type === "trigger");

  return (
    <div className="relative overflow-auto bg-muted/30 rounded-xl border border-border p-8 min-h-[500px]">
      {/* Canvas header */}
      <div className="absolute top-4 left-4 text-xs text-muted-foreground">
        Automation starts when the following trigger condition is met
      </div>

      {/* Workflow visualization */}
      <div className="flex flex-col items-center pt-8">
        {rootNode ? (
          renderNode(rootNode)
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-sm">No trigger set</p>
            <Button variant="hero" onClick={() => handleAddNode(null)}>
              <Plus className="w-4 h-4 mr-1" />
              Add New Trigger
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const AddNodeButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-primary/10 transition-colors"
  >
    <Plus className="w-4 h-4 text-muted-foreground" />
  </button>
);

export default WorkflowCanvas;
