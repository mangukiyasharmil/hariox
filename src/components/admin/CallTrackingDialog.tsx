import { useState, useEffect, useRef } from "react";
import { Phone, Clock, CheckCircle, XCircle, PhoneOff, PhoneMissed, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/database";
import { toast } from "sonner";
import CallScriptDisplay from "./CallScriptDisplay";
import { useQuery } from "@tanstack/react-query";

interface CallTrackingDialogProps {
  lead: Lead | null;
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCallLogged?: () => void;
}

// Removed "callback" - only connected and failed outcomes
type CallOutcome = "connected" | "busy" | "no_answer" | "switched_off";
type ConnectedAction = "interested" | "lost" | null;

const CONNECTED_THRESHOLD_SECONDS = 15;

const CallTrackingDialog = ({ lead, userId, open, onOpenChange, onCallLogged }: CallTrackingDialogProps) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [connectedAction, setConnectedAction] = useState<ConnectedAction>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: telecallerProfile } = useQuery({
    queryKey: ["telecaller-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("user_id", userId).single();
      return data;
    },
    enabled: !!userId,
  });
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setIsCallActive(false);
      setElapsedSeconds(0);
      setOutcome(null);
      setConnectedAction(null);
      setNotes("");
    }
  }, [open]);

  const startCall = () => {
    if (!lead) return;
    
    // Open native dialer without navigating away
    const link = document.createElement("a");
    link.href = `tel:+91${lead.phone}`;
    link.click();
    
    // Start timer
    setIsCallActive(true);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const endCall = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsCallActive(false);
    
    // Auto-determine if call was connected based on duration
    if (elapsedSeconds >= CONNECTED_THRESHOLD_SECONDS) {
      setOutcome("connected");
    }
  };

  const handleSave = async () => {
    if (!lead || !userId || !outcome) {
      toast.error("Please select a call outcome");
      return;
    }

    // If connected, require sub-action
    if (outcome === "connected" && !connectedAction) {
      toast.error("Please select Interest or Lost");
      return;
    }

    setIsSaving(true);
    try {
      // Only log duration if call was connected (15+ seconds)
      const callDuration = outcome === "connected" && elapsedSeconds >= CONNECTED_THRESHOLD_SECONDS 
        ? elapsedSeconds 
        : null;

      const { error: callError } = await supabase.from("call_logs").insert({
        lead_id: lead.id,
        caller_id: userId,
        call_duration: callDuration,
        outcome: outcome === "connected" ? connectedAction : outcome,
        notes: notes || null,
        call_type: "outbound",
      });

      if (callError) {
        console.error("Error inserting call log:", callError);
        toast.error("Failed to save call log");
        setIsSaving(false);
        return;
      }

      // Update lead based on outcome
      if (outcome === "connected" && connectedAction === "interested") {
        await supabase.from("leads").update({ is_interested: true }).eq("id", lead.id);
      } else if (outcome === "connected" && connectedAction === "lost") {
        await supabase.from("leads").update({ status: "lost" as any }).eq("id", lead.id);
      } else if (["busy", "no_answer", "switched_off"].includes(outcome)) {
        // Set follow-up for tomorrow so lead appears in retry tab
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        await supabase.from("leads").update({ 
          follow_up_date: tomorrow.toISOString(),
          follow_up_notes: `Auto: ${outcome.replace("_", " ")} - ${notes || "No notes"}`
        }).eq("id", lead.id);
      }

      await supabase.from("activity_logs").insert({
        lead_id: lead.id,
        user_id: userId,
        action: "call_logged",
        details: { outcome: outcome === "connected" ? connectedAction : outcome, duration: callDuration, notes },
      });

      toast.success("Call logged successfully");
      onCallLogged?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error logging call:", error);
      toast.error("Failed to log call");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Removed "callback" option as per requirements
  const outcomeOptions: { value: CallOutcome; label: string; icon: React.ReactNode; color: string }[] = [
    { value: "connected", label: "Connected", icon: <CheckCircle className="w-4 h-4" />, color: "text-green-600 border-green-200 bg-green-50" },
    { value: "busy", label: "Busy", icon: <PhoneOff className="w-4 h-4" />, color: "text-orange-600 border-orange-200 bg-orange-50" },
    { value: "no_answer", label: "No Answer", icon: <PhoneMissed className="w-4 h-4" />, color: "text-red-600 border-red-200 bg-red-50" },
    { value: "switched_off", label: "Switched Off", icon: <XCircle className="w-4 h-4" />, color: "text-gray-600 border-gray-200 bg-gray-50" },
  ];

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Call Tracking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Call Script */}
          <CallScriptDisplay lead={lead} telecallerName={telecallerProfile?.full_name || ""} />

          {/* Lead Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="font-semibold">{lead.full_name}</p>
            <p className="text-sm text-muted-foreground">+91 {lead.phone}</p>
          </div>

          {/* Timer Display */}
          <div className="text-center py-4">
            <div className={`text-4xl font-mono font-bold ${isCallActive ? "text-primary animate-pulse" : elapsedSeconds >= CONNECTED_THRESHOLD_SECONDS ? "text-green-600" : "text-muted-foreground"}`}>
              {formatTime(elapsedSeconds)}
            </div>
            {isCallActive && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Call in progress...
              </p>
            )}
            {!isCallActive && elapsedSeconds > 0 && elapsedSeconds >= CONNECTED_THRESHOLD_SECONDS && (
              <p className="text-xs text-green-600 mt-1">✓ Call Connected</p>
            )}
          </div>

          {/* Call Controls */}
          {!isCallActive && elapsedSeconds === 0 ? (
            <Button onClick={startCall} className="w-full" size="lg">
              <Phone className="w-5 h-5 mr-2" />
              Start Call
            </Button>
          ) : isCallActive ? (
            <Button onClick={endCall} variant="destructive" className="w-full" size="lg">
              <PhoneOff className="w-5 h-5 mr-2" />
              End Call
            </Button>
          ) : (
            <>
              {/* Outcome Selection */}
              <div>
                <p className="text-sm font-medium mb-2">Call Outcome</p>
                <div className="grid grid-cols-2 gap-2">
                  {outcomeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setOutcome(opt.value);
                        if (opt.value !== "connected") setConnectedAction(null);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        outcome === opt.value 
                          ? `${opt.color} ring-2 ring-offset-1 ring-primary` 
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Connected Sub-Actions */}
              {outcome === "connected" && (
                <div>
                  <p className="text-sm font-medium mb-2">Move Lead To</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConnectedAction("interested")}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        connectedAction === "interested"
                          ? "text-blue-600 border-blue-200 bg-blue-50 ring-2 ring-offset-1 ring-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <Star className="w-4 h-4" />
                      Interest
                    </button>
                    <button
                      onClick={() => setConnectedAction("lost")}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        connectedAction === "lost"
                          ? "text-red-600 border-red-200 bg-red-50 ring-2 ring-offset-1 ring-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      Lost
                    </button>
                  </div>
                </div>
              )}

              {/* Failed outcome info */}
              {outcome && ["busy", "no_answer", "switched_off"].includes(outcome) && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                  → Lead will be moved to <span className="font-semibold">Retry</span> tab with follow-up tomorrow
                </p>
              )}

              {/* Notes */}
              <div>
                <p className="text-sm font-medium mb-2">Notes (optional)</p>
                <Textarea
                  placeholder="Brief call notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleSkip}>
                  Skip
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={isSaving || !outcome || (outcome === "connected" && !connectedAction)}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallTrackingDialog;
