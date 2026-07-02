import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface SLATimerProps {
  /** ISO date string when the agent request was created */
  requestTime: string;
  /** SLA in minutes (default: 15 minutes) */
  slaMinutes?: number;
}

const SLATimer = ({ requestTime, slaMinutes = 15 }: SLATimerProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = new Date(requestTime).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [requestTime]);

  const totalSlaSeconds = slaMinutes * 60;
  const isBreached = elapsed > totalSlaSeconds;
  const remaining = Math.max(0, totalSlaSeconds - elapsed);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium ${
        isBreached
          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 animate-pulse"
          : remaining < 300
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
          : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
      }`}
    >
      {isBreached ? (
        <>
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>SLA breached +{formatTime(elapsed - totalSlaSeconds)}</span>
        </>
      ) : (
        <>
          <Clock className="w-2.5 h-2.5" />
          <span>{formatTime(remaining)} left</span>
        </>
      )}
    </div>
  );
};

export default SLATimer;
