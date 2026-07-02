import { IndianRupee, TrendingUp, BarChart3, ArrowUpRight, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface DayWisePnL {
  date: string;
  day: string;
  income: number;
  expense: number;
  profit: number;
  expenseByCategory?: Record<string, number>;
  incomeBySource?: Record<string, number>;
}

interface FinancialReportProps {
  dayWisePnL: DayWisePnL[];
  totalIncome: number;
  totalExpense: number;
  totalProfit: number;
  gstPayable: number;
  netProfitAfterGST: number;
  outputGST?: number;
  inputGST?: number;
  gstNetAmount?: number;
  dateLabel?: string;
}

const FinancialReport = ({
  dayWisePnL,
  totalIncome,
  totalExpense,
  totalProfit,
  gstPayable,
  netProfitAfterGST,
  outputGST = 0,
  inputGST = 0,
  gstNetAmount,
  dateLabel,
}: FinancialReportProps) => {
  const netGST = gstNetAmount !== undefined ? gstNetAmount : (outputGST - inputGST);
  const rangeIncome = dayWisePnL.reduce((sum, d) => sum + d.income, 0);
  const rangeExpense = dayWisePnL.reduce((sum, d) => sum + d.expense, 0);
  const rangeProfit = rangeIncome - rangeExpense;

  const expensePercent = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;
  const profitPercent = totalIncome > 0 ? Math.round((netProfitAfterGST / totalIncome) * 100) : 0;

  // Running total for cumulative view
  let runningProfit = 0;
  const cumulativeData = dayWisePnL.map(d => {
    runningProfit += d.profit;
    return { ...d, cumProfit: runningProfit };
  });

  return (
    <div className="space-y-6">
      {/* Period Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Revenue</span>
          </div>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">
            ₹{totalIncome.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/40 dark:to-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Expenses</span>
            <span className="ml-auto text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded">
              {expensePercent}%
            </span>
          </div>
          <p className="text-xl font-bold text-red-700 dark:text-red-400">
            ₹{totalExpense.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">GST</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-amber-600">Output</span>
              <span className="font-medium text-amber-700">₹{Math.round(outputGST).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-green-600">Input</span>
              <span className="font-medium text-green-700">₹{Math.round(inputGST).toLocaleString("en-IN")}</span>
            </div>
            <div className="border-t border-amber-300 dark:border-amber-700 pt-0.5 flex justify-between text-xs font-bold">
              <span className={netGST >= 0 ? "text-amber-800" : "text-green-700"}>
                {netGST >= 0 ? "Payable" : "ITC Credit"}
              </span>
              <span className={netGST >= 0 ? "text-amber-800" : "text-green-700"}>
                {netGST >= 0 ? "" : "-"}₹{Math.abs(Math.round(netGST)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-4 border ${
          netProfitAfterGST >= 0 
            ? "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800"
            : "bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/20 border-rose-200 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className={`w-4 h-4 ${netProfitAfterGST >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
            <span className={`text-xs font-medium ${netProfitAfterGST >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              Net Profit
            </span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium ${
              netProfitAfterGST >= 0 ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"
            }`}>
              {profitPercent}%
            </span>
          </div>
          <p className={`text-xl font-bold ${netProfitAfterGST >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {netProfitAfterGST >= 0 ? "" : "-"}₹{Math.abs(Math.round(netProfitAfterGST)).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Revenue vs Expenses Chart */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4 text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {dateLabel ? `${dateLabel} — Revenue vs Expenses` : "Revenue vs Expenses"}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayWisePnL} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cumulative Profit Trend */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4 text-sm">Cumulative Profit Trend</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="colorCumProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Area type="monotone" dataKey="cumProfit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCumProfit)" name="Cumulative Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm">Daily P&L Breakdown ({dayWisePnL.length} days)</h3>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Income</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Expense</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Profit/Loss</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Margin</th>
              </tr>
            </thead>
            <tbody>
              {dayWisePnL.map((day) => {
                const margin = day.income > 0 ? Math.round((day.profit / day.income) * 100) : 0;
                const hasActivity = day.income > 0 || day.expense > 0;
                return (
                  <tr key={day.date} className={`border-t border-border hover:bg-muted/30 transition-colors ${!hasActivity ? "opacity-50" : ""}`}>
                    <td className="p-3">
                      <span className="font-medium">{day.date}</span>
                      <span className="text-xs text-muted-foreground ml-2">({day.day})</span>
                    </td>
                    <td className="p-3 text-right font-medium text-green-600">
                      {day.income > 0 ? `₹${day.income.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {day.expense > 0 ? (
                        <span title={day.expenseByCategory ? Object.entries(day.expenseByCategory).map(([k,v]) => `${k}: ₹${v.toLocaleString("en-IN")}`).join("\n") : ""}>
                          ₹{day.expense.toLocaleString("en-IN")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className={`p-3 text-right font-bold ${day.profit > 0 ? "text-green-600" : day.profit < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {hasActivity ? (
                        <>{day.profit >= 0 ? "+" : ""}₹{day.profit.toLocaleString("en-IN")}</>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {hasActivity && day.income > 0 ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          margin >= 50 ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" :
                          margin >= 25 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" :
                          margin >= 0 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" : 
                          "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                        }`}>
                          {margin}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30 sticky bottom-0">
              <tr className="border-t-2 border-border font-semibold">
                <td className="p-3">Total ({dayWisePnL.length} days)</td>
                <td className="p-3 text-right text-green-600">₹{rangeIncome.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right text-red-600">₹{rangeExpense.toLocaleString("en-IN")}</td>
                <td className={`p-3 text-right ${rangeProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {rangeProfit >= 0 ? "+" : ""}₹{rangeProfit.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    rangeIncome > 0 && (rangeProfit / rangeIncome) >= 0.5 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {rangeIncome > 0 ? Math.round((rangeProfit / rangeIncome) * 100) : 0}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancialReport;
