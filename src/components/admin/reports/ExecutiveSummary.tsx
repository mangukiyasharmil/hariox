import { TrendingUp, Users, IndianRupee, Target, ArrowDownRight, ArrowRight, Calculator } from "lucide-react";
import UnifiedTelecallerReport from "./UnifiedTelecallerReport";

interface ExecutiveSummaryProps {
  totalLeads: number;
  paidLeads: number;
  verified: number;
  disbursed: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  gstPayable: number;
  conversionRate: number;
  startDate: Date;
  endDate: Date;
}

const ExecutiveSummary = ({
  totalLeads,
  paidLeads,
  verified,
  disbursed,
  totalIncome,
  totalExpense,
  netProfit,
  gstPayable,
  conversionRate,
  startDate,
  endDate,
}: ExecutiveSummaryProps) => {
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
  const verificationRate = paidLeads > 0 ? Math.round((verified / paidLeads) * 100) : 0;
  const disbursementRate = verified > 0 ? Math.round((disbursed / verified) * 100) : 0;
  
  // Calculate per-paid-lead metrics
  const revenuePerPaidLead = paidLeads > 0 ? Math.round(totalIncome / paidLeads) : 0;
  const expensePerPaidLead = paidLeads > 0 ? Math.round(totalExpense / paidLeads) : 0;
  const profitPerPaidLead = paidLeads > 0 ? Math.round(netProfit / paidLeads) : 0;
  
  // Calculate per-total-lead metrics (Revenue/Lead based on ALL leads)
  const revenuePerLead = totalLeads > 0 ? Math.round(totalIncome / totalLeads) : 0;
  const expensePerLead = totalLeads > 0 ? Math.round(totalExpense / totalLeads) : 0;

  return (
    <div className="space-y-6">
      {/* Key Financial Metrics - Compact Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">Revenue</span>
          </div>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">
            ₹{totalIncome.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Expenses</span>
          </div>
          <p className="text-xl font-bold text-red-700 dark:text-red-400">
            ₹{totalExpense.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">GST Payable</span>
          </div>
          <p className={`text-xl font-bold ${gstPayable >= 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
            {gstPayable >= 0 ? "" : "-"}₹{Math.abs(Math.round(gstPayable)).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-muted-foreground">{gstPayable >= 0 ? "To pay govt" : "ITC Credit"}</p>
        </div>

        <div className={`rounded-xl p-4 border ${
          netProfit >= 0 
            ? "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800" 
            : "bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-200 dark:border-rose-800"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`w-4 h-4 ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
            <span className={`text-xs font-medium ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              Net Profit
            </span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              netProfit >= 0 ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"
            }`}>
              {profitMargin}%
            </span>
          </div>
          <p className={`text-xl font-bold ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {netProfit >= 0 ? "" : "-"}₹{Math.abs(netProfit).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Compact Lead Funnel - Horizontal Flow */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Lead Funnel</h3>
        </div>
        <div className="flex items-center justify-between gap-2">
          {/* Stage 1: Total Leads */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-2 border-blue-300 dark:border-blue-700">
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalLeads}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Total</p>
          </div>

          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

          {/* Stage 2: Paid */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center border-2 border-green-300 dark:border-green-700">
              <span className="text-lg font-bold text-green-700 dark:text-green-300">{paidLeads}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Paid</p>
            <p className="text-[9px] text-green-600">{conversionRate}%</p>
          </div>

          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

          {/* Stage 3: Verified */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border-2 border-purple-300 dark:border-purple-700">
              <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{verified}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Verified</p>
            <p className="text-[9px] text-purple-600">{verificationRate}%</p>
          </div>

          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

          {/* Stage 4: Disbursed */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center border-2 border-teal-300 dark:border-teal-700">
              <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{disbursed}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Disbursed</p>
            <p className="text-[9px] text-teal-600">{disbursementRate}%</p>
          </div>
        </div>

        {/* Quick Stats Row - Per Lead Metrics */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-border">
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <p className="text-sm font-bold text-primary">{conversionRate}%</p>
            <p className="text-[9px] text-muted-foreground">Lead→Paid</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <p className="text-sm font-bold text-purple-600">{verificationRate}%</p>
            <p className="text-[9px] text-muted-foreground">Paid→Verified</p>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <p className="text-sm font-bold text-teal-600">{disbursementRate}%</p>
            <p className="text-[9px] text-muted-foreground">Verified→Disbursed</p>
          </div>
          <div className="text-center p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-bold text-green-600">
              ₹{revenuePerLead.toLocaleString("en-IN")}
            </p>
            <p className="text-[9px] text-muted-foreground">Revenue/Lead</p>
          </div>
        </div>
        
        {/* Per Paid Lead Metrics */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <div className="text-center p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-bold text-orange-600">
              ₹{expensePerLead.toLocaleString("en-IN")}
            </p>
            <p className="text-[9px] text-muted-foreground">Expense/Lead</p>
          </div>
          <div className="text-center p-2 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-bold text-green-600">
              ₹{revenuePerPaidLead.toLocaleString("en-IN")}
            </p>
            <p className="text-[9px] text-muted-foreground">Revenue/Paid</p>
          </div>
          <div className="text-center p-2 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-bold text-red-600">
              ₹{expensePerPaidLead.toLocaleString("en-IN")}
            </p>
            <p className="text-[9px] text-muted-foreground">Expense/Paid</p>
          </div>
          <div className="text-center p-2 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className={`text-sm font-bold ${profitPerPaidLead >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              ₹{profitPerPaidLead.toLocaleString("en-IN")}
            </p>
            <p className="text-[9px] text-muted-foreground">Profit/Paid</p>
          </div>
        </div>
      </div>

      {/* Telecaller Performance */}
      <UnifiedTelecallerReport startDate={startDate} endDate={endDate} />
    </div>
  );
};

export default ExecutiveSummary;
