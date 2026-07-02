import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DateRangeType, DateFilterSelectProps } from "@/hooks/useDateFilter";

const quickOptions: { value: DateRangeType; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "7 Days" },
  { value: "month", label: "30 Days" },
];

const DateFilterSelect = ({
  dateRange,
  setDateRange,
  customStart = "",
  customEnd = "",
  setCustomStart,
  setCustomEnd,
  showCustom = true,
  showYesterday = true,
  showQuarter = false,
  showYear = false,
  className = "",
}: DateFilterSelectProps) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Quick Pills - Simplified */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        {quickOptions.map((opt) => {
          if (opt.value === "yesterday" && !showYesterday) return null;
          return (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dateRange === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        {showQuarter && (
          <button
            onClick={() => setDateRange("quarter")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              dateRange === "quarter"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            3M
          </button>
        )}
        {showYear && (
          <button
            onClick={() => setDateRange("year")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              dateRange === "year"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            1Y
          </button>
        )}
        <button
          onClick={() => setDateRange("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            dateRange === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All
        </button>
        {showCustom && (
          <button
            onClick={() => setDateRange("custom")}
            className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              dateRange === "custom"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Custom Date Inputs */}
      {showCustom && dateRange === "custom" && setCustomStart && setCustomEnd && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="w-32 h-8 text-xs"
            placeholder="Start"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="w-32 h-8 text-xs"
            placeholder="End"
          />
        </div>
      )}
    </div>
  );
};

export default DateFilterSelect;
