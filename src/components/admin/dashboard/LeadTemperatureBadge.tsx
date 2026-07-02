import { Flame, Sun, Snowflake, Zap, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface LeadTemperatureBadgeProps {
  lastActivityDate?: string | null;
  isInterested?: boolean;
  hasFollowUp?: boolean;
  callCount?: number;
  leadScore?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

type Temperature = "hot" | "warm" | "cold" | "new";

const getTemperature = (
  lastActivityDate?: string | null,
  isInterested?: boolean,
  callCount?: number,
  leadScore?: number
): Temperature => {
  // New lead (created in last 2 hours)
  if (lastActivityDate) {
    const hoursAgo = (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60);
    if (hoursAgo <= 2) return "new";
  }
  
  // Hot: Interested, or high score, or recent activity with calls
  if (isInterested) return "hot";
  if (leadScore && leadScore >= 70) return "hot";
  
  if (lastActivityDate) {
    const hoursAgo = (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60);
    
    // Hot: Activity in last 24h AND has been called
    if (hoursAgo <= 24 && callCount && callCount > 0) return "hot";
    
    // Warm: Activity in last 72h
    if (hoursAgo <= 72) return "warm";
  }
  
  // Warm: Has some engagement
  if (callCount && callCount >= 2) return "warm";
  if (leadScore && leadScore >= 40) return "warm";
  
  // Cold: No recent activity
  return "cold";
};

const temperatureConfig = {
  hot: {
    icon: Flame,
    label: "Hot",
    description: "High intent - prioritize this lead!",
    bgColor: "bg-red-100 dark:bg-red-950/50",
    textColor: "text-red-600 dark:text-red-400",
    iconColor: "text-red-500",
    borderColor: "border-red-200 dark:border-red-800",
    animation: "animate-pulse",
  },
  warm: {
    icon: Sun,
    label: "Warm",
    description: "Engaged lead - follow up soon",
    bgColor: "bg-orange-100 dark:bg-orange-950/50",
    textColor: "text-orange-600 dark:text-orange-400",
    iconColor: "text-orange-500",
    borderColor: "border-orange-200 dark:border-orange-800",
    animation: "",
  },
  cold: {
    icon: Snowflake,
    label: "Cold",
    description: "No recent activity - needs re-engagement",
    bgColor: "bg-blue-100 dark:bg-blue-950/50",
    textColor: "text-blue-600 dark:text-blue-400",
    iconColor: "text-blue-500",
    borderColor: "border-blue-200 dark:border-blue-800",
    animation: "",
  },
  new: {
    icon: Zap,
    label: "New",
    description: "Fresh lead - call immediately!",
    bgColor: "bg-green-100 dark:bg-green-950/50",
    textColor: "text-green-600 dark:text-green-400",
    iconColor: "text-green-500",
    borderColor: "border-green-200 dark:border-green-800",
    animation: "animate-bounce",
  },
};

const sizeConfig = {
  sm: { iconSize: "w-3 h-3", padding: "px-1.5 py-0.5", fontSize: "text-[10px]" },
  md: { iconSize: "w-4 h-4", padding: "px-2 py-1", fontSize: "text-xs" },
  lg: { iconSize: "w-5 h-5", padding: "px-3 py-1.5", fontSize: "text-sm" },
};

const LeadTemperatureBadge = ({
  lastActivityDate,
  isInterested,
  hasFollowUp,
  callCount,
  leadScore,
  size = "md",
  showLabel = true,
}: LeadTemperatureBadgeProps) => {
  const temperature = getTemperature(lastActivityDate, isInterested, callCount, leadScore);
  const config = temperatureConfig[temperature];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              inline-flex items-center gap-1 rounded-full border
              ${config.bgColor} ${config.textColor} ${config.borderColor}
              ${sizeStyles.padding} ${sizeStyles.fontSize}
              font-medium cursor-help transition-all
              ${config.animation}
            `}
          >
            <Icon className={`${sizeStyles.iconSize} ${config.iconColor}`} />
            {showLabel && <span>{config.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-1">
            <p className="font-medium flex items-center gap-1">
              <Icon className="w-3 h-3" />
              {config.label} Lead
            </p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {lastActivityDate && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Last activity: {new Date(lastActivityDate).toLocaleDateString("en-IN")}
              </p>
            )}
            {callCount !== undefined && (
              <p className="text-[10px] text-muted-foreground">
                Calls made: {callCount}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Helper function to calculate temperature externally
export const calculateLeadTemperature = getTemperature;

export default LeadTemperatureBadge;
