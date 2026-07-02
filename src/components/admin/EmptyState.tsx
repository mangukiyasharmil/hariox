import { Package, Search, FileText, Users, IndianRupee, Bell } from "lucide-react";

interface EmptyStateProps {
  type: "leads" | "payments" | "documents" | "notifications" | "search" | "default";
  title?: string;
  description?: string;
}

const EmptyState = ({ type, title, description }: EmptyStateProps) => {
  const getContent = () => {
    switch (type) {
      case "leads":
        return {
          icon: <Users className="w-16 h-16 text-muted-foreground/30" />,
          title: title || "No leads found",
          description: description || "New leads will appear here when customers apply",
        };
      case "payments":
        return {
          icon: <IndianRupee className="w-16 h-16 text-muted-foreground/30" />,
          title: title || "No payments yet",
          description: description || "Payment records will appear here once transactions are made",
        };
      case "documents":
        return {
          icon: <FileText className="w-16 h-16 text-muted-foreground/30" />,
          title: title || "No documents uploaded",
          description: description || "Customer documents will appear here after upload",
        };
      case "notifications":
        return {
          icon: <Bell className="w-16 h-16 text-muted-foreground/30" />,
          title: title || "No notifications",
          description: description || "You're all caught up! New notifications will appear here",
        };
      case "search":
        return {
          icon: <Search className="w-16 h-16 text-muted-foreground/30" />,
          title: title || "No results found",
          description: description || "Try adjusting your search or filter to find what you're looking for",
        };
      default:
        return {
          icon: <Package className="w-16 h-16 text-muted-foreground/30" />,
          title: title || "Nothing here yet",
          description: description || "Content will appear here when available",
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 animate-pulse">
        {content.icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {content.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {content.description}
      </p>
    </div>
  );
};

export default EmptyState;
