import { useState, useMemo } from "react";

export type DateRangeType = "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "all" | "custom";

interface DateFilterState {
  dateRange: DateRangeType;
  customStart: string;
  customEnd: string;
}

// IST is UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Helper to get current time in IST
const getISTNow = (): Date => {
  const now = new Date();
  // Convert UTC to IST by adding offset
  return new Date(now.getTime() + IST_OFFSET_MS);
};

// Helper to format date as YYYY-MM-DD using IST timezone
const formatISTDate = (date: Date): string => {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to format date as YYYY-MM-DD using local timezone (kept for backward compat)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to create start of day in IST and return as UTC Date
const startOfDayIST = (dateStr: string): Date => {
  // dateStr is YYYY-MM-DD in IST
  // Start of day in IST is 00:00:00 IST = previous day 18:30:00 UTC
  const [year, month, day] = dateStr.split("-").map(Number);
  // Create date at midnight IST, then subtract IST offset to get UTC
  const istMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return new Date(istMidnight - IST_OFFSET_MS);
};

// Helper to create end of day in IST and return as UTC Date
const endOfDayIST = (dateStr: string): Date => {
  // dateStr is YYYY-MM-DD in IST
  // End of day in IST is 23:59:59.999 IST = same day 18:29:59.999 UTC
  const [year, month, day] = dateStr.split("-").map(Number);
  const istEndOfDay = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  return new Date(istEndOfDay - IST_OFFSET_MS);
};

// Helper to create start of day in local timezone (kept for backward compat)
const startOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

// Helper to create end of day in local timezone (kept for backward compat)
const endOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

interface DateFilterResult {
  dateRange: DateRangeType;
  customStart: string;
  customEnd: string;
  setDateRange: (range: DateRangeType) => void;
  setCustomStart: (date: string) => void;
  setCustomEnd: (date: string) => void;
  startDate: Date;
  endDate: Date;
  startDateISO: string;
  endDateISO: string;
  startDateLocal: string;
  endDateLocal: string;
  dateLabel: string;
}

export const useDateFilter = (defaultRange: DateRangeType = "today"): DateFilterResult => {
  const [state, setState] = useState<DateFilterState>({
    dateRange: defaultRange,
    customStart: "",
    customEnd: "",
  });

  const setDateRange = (range: DateRangeType) => {
    setState(prev => ({ ...prev, dateRange: range }));
  };

  const setCustomStart = (date: string) => {
    setState(prev => ({ ...prev, customStart: date }));
  };

  const setCustomEnd = (date: string) => {
    setState(prev => ({ ...prev, customEnd: date }));
  };

  const { startDate, endDate, dateLabel } = useMemo(() => {
    const now = new Date();
    // Get today's date in IST format (YYYY-MM-DD)
    const todayIST = formatISTDate(now);
    
    let start = new Date();
    let end = new Date();
    let label = "";

    // Helper to get IST date string for N days ago
    const getISTDateNDaysAgo = (daysAgo: number): string => {
      const pastDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      return formatISTDate(pastDate);
    };

    switch (state.dateRange) {
      case "today":
        start = startOfDayIST(todayIST);
        end = endOfDayIST(todayIST);
        label = "Today";
        break;
      case "yesterday":
        const yesterdayIST = getISTDateNDaysAgo(1);
        start = startOfDayIST(yesterdayIST);
        end = endOfDayIST(yesterdayIST);
        label = "Yesterday";
        break;
      case "week":
        const weekAgoIST = getISTDateNDaysAgo(7);
        start = startOfDayIST(weekAgoIST);
        end = endOfDayIST(todayIST);
        label = "Last 7 Days";
        break;
      case "month":
        const monthAgoIST = getISTDateNDaysAgo(30);
        start = startOfDayIST(monthAgoIST);
        end = endOfDayIST(todayIST);
        label = "Last 30 Days";
        break;
      case "quarter":
        const quarterAgoIST = getISTDateNDaysAgo(90);
        start = startOfDayIST(quarterAgoIST);
        end = endOfDayIST(todayIST);
        label = "Last 3 Months";
        break;
      case "year":
        const yearAgoIST = getISTDateNDaysAgo(365);
        start = startOfDayIST(yearAgoIST);
        end = endOfDayIST(todayIST);
        label = "Last Year";
        break;
      case "custom":
        if (state.customStart) {
          start = startOfDayIST(state.customStart);
        }
        if (state.customEnd) {
          end = endOfDayIST(state.customEnd);
        }
        label = state.customStart && state.customEnd 
          ? `${new Date(state.customStart + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${new Date(state.customEnd + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
          : "Custom";
        break;
      case "all":
      default:
        start = new Date("2020-01-01T00:00:00Z");
        end = endOfDayIST(todayIST);
        label = "All Time";
        break;
    }

    return { startDate: start, endDate: end, dateLabel: label };
  }, [state.dateRange, state.customStart, state.customEnd]);

  return {
    dateRange: state.dateRange,
    customStart: state.customStart,
    customEnd: state.customEnd,
    setDateRange,
    setCustomStart,
    setCustomEnd,
    startDate,
    endDate,
    startDateISO: startDate.toISOString(),
    endDateISO: endDate.toISOString(),
    startDateLocal: formatLocalDate(startDate),
    endDateLocal: formatLocalDate(endDate),
    dateLabel,
  };
};

// Reusable DateFilter UI Component Props
export interface DateFilterSelectProps {
  dateRange: DateRangeType;
  setDateRange: (range: DateRangeType) => void;
  customStart?: string;
  customEnd?: string;
  setCustomStart?: (date: string) => void;
  setCustomEnd?: (date: string) => void;
  showCustom?: boolean;
  showYesterday?: boolean;
  showQuarter?: boolean;
  showYear?: boolean;
  className?: string;
}
