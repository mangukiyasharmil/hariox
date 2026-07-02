import { Phone, MessageSquare, Star, IndianRupee, XCircle, Clock, Calendar, User, Eye, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import type { Lead } from "@/types/database";
import LeadTemperatureBadge from "./dashboard/LeadTemperatureBadge";

interface LeadCardProps {
  lead: Lead & { 
    call_count?: number; 
    last_activity?: string | null;
    lead_score?: number;
  };
  isSelected: boolean;
  viewMode: "grid" | "list";
  onSelect: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onWhatsAppAPI?: () => void;
  onSMS: () => void;
  onMarkInterested: () => void;
  onMarkPaid?: () => void;
  onMarkLost: () => void;
  isFollowUpDue: boolean;
  onViewDetails?: () => void;
  paymentLink?: string;
  showMarkPaid?: boolean;
}

const LeadCard = ({
  lead,
  isSelected,
  viewMode,
  onSelect,
  onCall,
  onWhatsApp,
  onWhatsAppAPI,
  onSMS,
  onMarkInterested,
  onMarkPaid,
  onMarkLost,
  isFollowUpDue,
  onViewDetails,
  paymentLink,
  showMarkPaid = true,
}: LeadCardProps) => {
  const getStatusColor = (status: string) => {
    if (status === "lost") return "bg-gray-100 text-gray-800";
    return status === "unpaid" 
      ? "bg-yellow-100 text-yellow-800" 
      : "bg-green-100 text-green-800";
  };

  const isInterested = (lead as any).is_interested;
  const followUpDate = (lead as any).follow_up_date;
  const lastActivity = lead.last_activity || lead.updated_at;
  const callCount = lead.call_count || 0;
  const leadScore = lead.lead_score;

  if (viewMode === "grid") {
    return (
      <TooltipProvider delayDuration={200}>
        <div
          className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
            isSelected
              ? "border-primary bg-primary/5 shadow-md"
              : isFollowUpDue
              ? "border-yellow-400 bg-yellow-50"
              : "border-border hover:border-primary/30"
          }`}
          onClick={onSelect}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-medium text-sm truncate">{lead.full_name}</p>
                  {isInterested && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{lead.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <LeadTemperatureBadge
                lastActivityDate={lastActivity}
                isInterested={isInterested}
                callCount={callCount}
                leadScore={leadScore}
                size="sm"
                showLabel={false}
              />
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(lead.status)}`}>
                {lead.status}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="capitalize">{lead.loan_type}</span>
            <span>•</span>
            <span>₹{Number(lead.loan_amount).toLocaleString("en-IN")}</span>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
            <Calendar className="w-3 h-3" />
            <span>{new Date(lead.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
            <span>•</span>
            <Clock className="w-3 h-3" />
            <span>{new Date(lead.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
          </div>

          {/* Follow-up indicator */}
          {isFollowUpDue && (
            <div className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 rounded px-1.5 py-0.5 mb-2 w-fit">
              <Clock className="w-3 h-3" />
              Follow-up due
            </div>
          )}
          {followUpDate && !isFollowUpDue && (
            <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(followUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </p>
          )}

          {/* Action Icons */}
          <div className="flex items-center gap-1 pt-2 border-t border-border/50">
            {/* WhatsApp API Chat - First */}
            {onWhatsAppAPI && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-[#25D366] hover:text-[#20BD5A] hover:bg-green-50"
                    onClick={(e) => { e.stopPropagation(); onWhatsAppAPI(); }}
                  >
                    <Bot className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>API Chat</p></TooltipContent>
              </Tooltip>
            )}

            {/* View Details */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                  onClick={(e) => { e.stopPropagation(); onViewDetails ? onViewDetails() : onSelect(); }}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>View Details</p></TooltipContent>
            </Tooltip>

            {/* Call */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={(e) => { e.stopPropagation(); onCall(); }}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Call</p></TooltipContent>
            </Tooltip>

            {/* WhatsApp Web */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-[#128C7E] hover:text-[#0d7366] hover:bg-teal-50"
                  onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
                >
                  <WhatsAppIcon size="sm" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>WhatsApp Web</p></TooltipContent>
            </Tooltip>

            {/* SMS */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={(e) => { e.stopPropagation(); onSMS(); }}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>SMS</p></TooltipContent>
            </Tooltip>

            {lead.status === "unpaid" && !isInterested && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                    onClick={(e) => { e.stopPropagation(); onMarkInterested(); }}
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Mark Interested</p></TooltipContent>
              </Tooltip>
            )}

            <div className="flex-1" />

            {lead.status === "unpaid" && (
              <>
                {showMarkPaid && onMarkPaid && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); onMarkPaid(); }}
                      >
                        <IndianRupee className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Mark Paid</p></TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      onClick={(e) => { e.stopPropagation(); onMarkLost(); }}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Mark Lost</p></TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // List View - Compact single line with only call button
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
        isSelected
          ? "border-primary bg-primary/5"
          : isFollowUpDue
          ? "border-yellow-400 bg-yellow-50"
          : "border-border hover:border-primary/30"
      }`}
      onClick={onSelect}
    >
      {/* Name + indicators */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{lead.full_name || "No Name"}</p>
        {isInterested && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
        {isFollowUpDue && <Clock className="w-3 h-3 text-yellow-600 flex-shrink-0" />}
      </div>

      {/* Date + Loan info */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
        <span className="text-[10px]">{new Date(lead.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
        <span>•</span>
        <span className="capitalize">{lead.loan_type}</span>
        <span>₹{Number(lead.loan_amount).toLocaleString("en-IN")}</span>
      </div>

      {/* Status badge */}
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${getStatusColor(lead.status)}`}>
        {lead.status}
      </span>

      {/* API Chat button */}
      {onWhatsAppAPI && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-[#25D366] hover:text-[#20BD5A] hover:bg-green-50 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onWhatsAppAPI(); }}
        >
          <Bot className="w-4 h-4" />
        </Button>
      )}
      {/* Call button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 flex-shrink-0"
        onClick={(e) => { e.stopPropagation(); onCall(); }}
      >
        <Phone className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default LeadCard;
