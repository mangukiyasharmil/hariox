import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Zap, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface LeadScoreBadgeProps {
  leadId: string;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

interface LeadScore {
  score: number;
  profile_score: number;
  engagement_score: number;
  activity_score: number;
  last_calculated_at: string;
}

const LeadScoreBadge = ({ leadId, showDetails = false, size = "md" }: LeadScoreBadgeProps) => {
  const [score, setScore] = useState<LeadScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchScore();
  }, [leadId]);

  const fetchScore = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_scores")
        .select("*")
        .eq("lead_id", leadId)
        .maybeSingle();

      if (error) throw error;
      setScore(data);
    } catch (err) {
      console.error("Error fetching lead score:", err);
    }
  };

  const recalculateScore = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("calculate_lead_score", {
        p_lead_id: leadId,
      });

      if (error) throw error;
      
      // Refetch the score details
      await fetchScore();
    } catch (err) {
      console.error("Error recalculating score:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (value: number) => {
    if (value >= 70) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (value >= 40) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const getScoreLabel = (value: number) => {
    if (value >= 70) return "Hot";
    if (value >= 40) return "Warm";
    return "Cold";
  };

  const getScoreIcon = (value: number) => {
    if (value >= 70) return <TrendingUp className="w-3 h-3" />;
    if (value >= 40) return <Minus className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  if (!score) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={recalculateScore}
        disabled={isLoading}
        className="h-6 text-xs text-muted-foreground"
      >
        {isLoading ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <Zap className="w-3 h-3 mr-1" />
            Calculate Score
          </>
        )}
      </Button>
    );
  }

  const ScoreBadge = (
    <Badge
      variant="outline"
      className={`${getScoreColor(score.score)} ${sizeClasses[size]} font-semibold gap-1`}
    >
      {getScoreIcon(score.score)}
      <span>{score.score}</span>
      <span className="opacity-70">• {getScoreLabel(score.score)}</span>
    </Badge>
  );

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{ScoreBadge}</TooltipTrigger>
          <TooltipContent side="top" className="p-0 overflow-hidden">
            <div className="p-3 space-y-2 min-w-48">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Lead Score Breakdown</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={recalculateScore}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Profile</span>
                  <span className="font-medium">{score.profile_score}/40</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(score.profile_score / 40) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Engagement</span>
                  <span className="font-medium">{score.engagement_score}/30</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(score.engagement_score / 30) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Activity</span>
                  <span className="font-medium">{score.activity_score}/30</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${(score.activity_score / 30) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {ScoreBadge}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={recalculateScore}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Profile Score</span>
            <span className="font-medium">{score.profile_score}/40</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(score.profile_score / 40) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Engagement Score</span>
            <span className="font-medium">{score.engagement_score}/30</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(score.engagement_score / 30) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Activity Score</span>
            <span className="font-medium">{score.activity_score}/30</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${(score.activity_score / 30) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadScoreBadge;
