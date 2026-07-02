import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { formatISTDate, startOfDayIST, endOfDayIST } from "@/lib/dateUtils";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import FinancialReport from "./FinancialReport";

interface DayWisePnL {
  date: string;
  day: string;
  income: number;
  expense: number;
  profit: number;
  expenseByCategory: Record<string, number>;
  incomeBySource: Record<string, number>;
}

interface Props {
  startISO: string;
  endISO: string;
  dateLabel: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FinancialReportTab = ({ startISO, endISO, dateLabel }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<"parent" | "month">("parent");

  // Compute effective date range based on view mode
  const effectiveDates = useMemo(() => {
    if (viewMode === "parent") {
      return { start: startISO, end: endISO };
    }
    // Month mode: first and last day of selected month in IST
    const firstDay = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const lastDayDate = new Date(selectedYear, selectedMonth + 1, 0);
    const lastDay = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
    return {
      start: startOfDayIST(firstDay).toISOString(),
      end: endOfDayIST(lastDay).toISOString(),
    };
  }, [viewMode, startISO, endISO, selectedMonth, selectedYear]);

  const effectiveLabel = useMemo(() => {
    if (viewMode === "parent") return dateLabel;
    return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
  }, [viewMode, dateLabel, selectedMonth, selectedYear]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-financial", effectiveDates.start, effectiveDates.end, companyId],
    queryFn: async () => {
      const startDate = new Date(effectiveDates.start);
      const endDate = new Date(effectiveDates.end);
      const startDateIST = formatISTDate(startDate);
      const endDateIST = formatISTDate(endDate);

      let rangeEntriesQuery = supabase.from("accounting_entries")
        .select("amount, entry_type, category, entry_date, gst_included, gst_rate")
        .gte("entry_date", startDateIST).lte("entry_date", endDateIST);

      if (companyId) {
        rangeEntriesQuery = rangeEntriesQuery.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const [rangePaymentsRes, rangeEntriesRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from("payments").select("total_amount, payment_source, created_at")
            .in("status", ["completed", "captured"])
            .gte("created_at", effectiveDates.start).lte("created_at", effectiveDates.end)
        ).limit(5000),
        rangeEntriesQuery.limit(5000),
      ]);

      const rangePayments = rangePaymentsRes.data || [];
      const rangeEntries = rangeEntriesRes.data || [];

      // Total income = payments + accounting income entries
      const paymentIncome = rangePayments.reduce((sum, p) => sum + Number(p.total_amount), 0);
      const accountingIncome = rangeEntries.filter(e => e.entry_type === "income").reduce((sum, e) => sum + Number(e.amount), 0);
      const totalIncome = paymentIncome + accountingIncome;

      const totalExpense = rangeEntries.filter(e => e.entry_type === "expense").reduce((sum, e) => sum + Number(e.amount), 0);
      const totalProfit = totalIncome - totalExpense;

      const outputGST = rangePayments.reduce((sum, p) => sum + (Number(p.total_amount) * 18 / 118), 0);
      const inputGST = rangeEntries
        .filter(e => e.entry_type === "expense" && e.gst_included)
        .reduce((sum, e) => {
          const rate = Number(e.gst_rate || 18);
          return sum + (Number(e.amount) * rate / (100 + rate));
        }, 0);
      const gstNetAmount = outputGST - inputGST;
      const gstPayable = gstNetAmount;
      const netProfitAfterGST = totalProfit - gstPayable;

      // Build daily P&L
      const dayWisePnL: DayWisePnL[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayDateStr = formatISTDate(currentDate);
        const dayStart = startOfDayIST(dayDateStr);
        const dayEnd = endOfDayIST(dayDateStr);

        const dayPayments = rangePayments.filter(p => {
          const pDate = new Date(p.created_at);
          return pDate >= dayStart && pDate <= dayEnd;
        });
        const dayEntries = rangeEntries.filter(e => e.entry_date === dayDateStr);

        const dayPaymentIncome = dayPayments.reduce((sum, p) => sum + Number(p.total_amount), 0);
        const dayAccountingIncome = dayEntries.filter(e => e.entry_type === "income").reduce((sum, e) => sum + Number(e.amount), 0);
        const income = dayPaymentIncome + dayAccountingIncome;

        // Sum ALL expense entries for the day
        const expense = dayEntries
          .filter(e => e.entry_type === "expense")
          .reduce((sum, e) => sum + Number(e.amount), 0);

        const expenseByCategory: Record<string, number> = {};
        dayEntries.forEach(e => {
          if (e.entry_type === "expense") {
            expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
          }
        });

        const incomeBySource: Record<string, number> = {};
        dayPayments.forEach(p => {
          const source = (p as any).payment_source || "direct";
          incomeBySource[source] = (incomeBySource[source] || 0) + Number(p.total_amount);
        });

        const [year, month, day] = dayDateStr.split("-").map(Number);
        const displayDate = new Date(year, month - 1, day);
        dayWisePnL.push({
          date: displayDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          day: displayDate.toLocaleDateString("en-IN", { weekday: "short" }),
          income, expense, profit: income - expense,
          expenseByCategory, incomeBySource,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return { dayWisePnL, totalIncome, totalExpense, totalProfit, gstPayable, netProfitAfterGST, outputGST, inputGST, gstNetAmount };
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  // Generate quick month pills for last 6 months
  const recentMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) });
    }
    return months;
  }, []);

  return (
    <div className="space-y-4">
      {/* Date Selection Inside */}
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode("parent")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "parent"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Range
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "month"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Month Navigation (only in month mode) */}
          {viewMode === "month" && (
            <>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-semibold min-w-[120px] text-center">
                  {MONTH_NAMES[selectedMonth]} {selectedYear}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextMonth} disabled={isCurrentMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Quick month pills */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto">
                {recentMonths.map((m) => (
                  <button
                    key={`${m.year}-${m.month}`}
                    onClick={() => { setSelectedMonth(m.month); setSelectedYear(m.year); }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap ${
                      selectedMonth === m.month && selectedYear === m.year
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {viewMode === "parent" && (
            <span className="text-xs text-muted-foreground">Using: {dateLabel}</span>
          )}
        </div>
      </div>

      {/* Report Content */}
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <FinancialReport
          dayWisePnL={data.dayWisePnL}
          totalIncome={data.totalIncome}
          totalExpense={data.totalExpense}
          totalProfit={data.totalProfit}
          gstPayable={data.gstPayable}
          netProfitAfterGST={data.netProfitAfterGST}
          outputGST={data.outputGST}
          inputGST={data.inputGST}
          gstNetAmount={data.gstNetAmount}
          dateLabel={effectiveLabel}
        />
      )}
    </div>
  );
};

export default FinancialReportTab;
