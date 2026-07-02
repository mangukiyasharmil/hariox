import { useState, useEffect } from "react";
import { Play, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInMinutes, format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AttendanceSession {
  id: string;
  clock_in: string;
  clock_out: string | null;
}

const ClockInOutButton = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      checkActiveSession();
    }
  }, [currentUserId]);

  // Update elapsed time every minute
  useEffect(() => {
    if (!activeSession) {
      setElapsedTime("");
      return;
    }

    const updateElapsed = () => {
      const mins = differenceInMinutes(new Date(), new Date(activeSession.clock_in));
      const hours = Math.floor(mins / 60);
      const minutes = mins % 60;
      setElapsedTime(`${hours}h ${minutes}m`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const checkActiveSession = async () => {
    if (!currentUserId) return;
    
    const { data } = await supabase
      .from("staff_attendance")
      .select("id, clock_in, clock_out")
      .eq("user_id", currentUserId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveSession(data);
  };

  const handleClockIn = async () => {
    if (!currentUserId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("staff_attendance")
        .insert({
          user_id: currentUserId,
          clock_in: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setActiveSession(data);
      toast.success("Clocked in successfully!");
    } catch (error) {
      console.error("Clock in error:", error);
      toast.error("Failed to clock in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentUserId || !activeSession) return;
    setIsLoading(true);

    try {
      const clockOut = new Date();
      const duration = differenceInMinutes(clockOut, new Date(activeSession.clock_in));

      const { error } = await supabase
        .from("staff_attendance")
        .update({
          clock_out: clockOut.toISOString(),
          work_duration_minutes: duration,
        })
        .eq("id", activeSession.id);

      if (error) throw error;

      setActiveSession(null);
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      toast.success(`Clocked out! Total: ${hours}h ${mins}m`);
    } catch (error) {
      console.error("Clock out error:", error);
      toast.error("Failed to clock out");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {activeSession ? (
            <Button 
              onClick={handleClockOut} 
              variant="destructive" 
              size="sm"
              disabled={isLoading}
              className="gap-1.5 h-9 px-3"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Out</span>
              {elapsedTime && (
                <span className="text-xs opacity-90 font-normal">
                  ({elapsedTime})
                </span>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleClockIn} 
              size="sm"
              disabled={isLoading}
              className="gap-1.5 h-9 px-3 bg-emerald-600 hover:bg-emerald-700"
            >
              <Play className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clock In</span>
            </Button>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {activeSession 
            ? `Clocked in since ${format(new Date(activeSession.clock_in), "hh:mm a")}`
            : "Start your work session"
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ClockInOutButton;
