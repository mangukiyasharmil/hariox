import { motion } from "framer-motion";
import { Users, IndianRupee, FileCheck, Target, ArrowDown, TrendingUp, TrendingDown } from "lucide-react";

interface LeadFunnelVisualizationProps {
  totalLeads: number;
  paidLeads: number;
  verifiedLeads: number;
  disbursedLeads: number;
  totalRevenue?: number;
  totalExpenses?: number;
}

const LeadFunnelVisualization = ({
  totalLeads,
  paidLeads,
  verifiedLeads,
  disbursedLeads,
  totalRevenue = 0,
  totalExpenses = 0,
}: LeadFunnelVisualizationProps) => {
  const leadToPayRate = totalLeads > 0 ? Math.round((paidLeads / totalLeads) * 100) : 0;
  const payToVerifyRate = paidLeads > 0 ? Math.round((verifiedLeads / paidLeads) * 100) : 0;
  const verifyToDisburseRate = verifiedLeads > 0 ? Math.round((disbursedLeads / verifiedLeads) * 100) : 0;
  const overallRate = totalLeads > 0 ? Math.round((disbursedLeads / totalLeads) * 100) : 0;
  
  // Per Paid Lead calculations
  const revenuePerPaid = paidLeads > 0 ? Math.round(totalRevenue / paidLeads) : 0;
  const expensePerPaid = paidLeads > 0 ? Math.round(totalExpenses / paidLeads) : 0;
  const profitPerPaid = revenuePerPaid - expensePerPaid;
  
  // Per Total Lead calculations (for per-lead expense insight)
  const revenuePerLead = totalLeads > 0 ? Math.round(totalRevenue / totalLeads) : 0;
  const expensePerLead = totalLeads > 0 ? Math.round(totalExpenses / totalLeads) : 0;

  const stages = [
    { 
      label: "Leads", 
      value: totalLeads, 
      icon: Users, 
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      dropOff: null,
      dropOffLabel: null,
    },
    { 
      label: "Paid", 
      value: paidLeads, 
      icon: IndianRupee, 
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      dropOff: totalLeads - paidLeads,
      dropOffLabel: `${100 - leadToPayRate}% dropped`,
    },
    { 
      label: "Verified", 
      value: verifiedLeads, 
      icon: FileCheck, 
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      dropOff: paidLeads - verifiedLeads,
      dropOffLabel: `${100 - payToVerifyRate}% dropped`,
    },
    { 
      label: "Disbursed", 
      value: disbursedLeads, 
      icon: Target, 
      color: "from-teal-500 to-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950/30",
      dropOff: verifiedLeads - disbursedLeads,
      dropOffLabel: `${100 - verifyToDisburseRate}% dropped`,
    },
  ];

  // Calculate widths for funnel effect
  const getWidth = (index: number) => {
    const widths = [100, 75, 55, 40];
    return widths[index] || 40;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Lead Funnel
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Overall:</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            overallRate >= 5 
              ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400" 
              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400"
          }`}>
            {overallRate}%
          </span>
        </div>
      </div>

      {/* Funnel */}
      <div className="flex flex-col items-center space-y-1">
        {stages.map((stage, index) => (
          <div key={stage.label} className="w-full">
            {/* Stage Bar */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: index * 0.1 }}
              className="relative mx-auto"
              style={{ width: `${getWidth(index)}%` }}
            >
              <div className={`${stage.bgColor} rounded-lg p-3 flex items-center justify-between border border-border/50`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stage.color} flex items-center justify-center`}>
                    <stage.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-medium">{stage.label}</span>
                </div>
                <span className="text-lg font-bold">{stage.value}</span>
              </div>
            </motion.div>

            {/* Drop-off indicator */}
            {index < stages.length - 1 && (
              <div className="flex items-center justify-center my-1">
                <div className="flex flex-col items-center">
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                  {stage.dropOff !== null && stage.dropOff > 0 && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.1 + 0.2 }}
                      className="text-[10px] text-red-500 font-medium"
                    >
                      -{stage.dropOff} ({stages[index + 1].dropOffLabel?.split('%')[0]}%)
                    </motion.span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Conversion Summary */}
      <div className="mt-4 pt-3 border-t border-border">
        {/* Row 1: Conversion Rates */}
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <p className="text-lg font-bold text-blue-600">{leadToPayRate}%</p>
            <p className="text-[10px] text-muted-foreground">Lead→Paid</p>
          </div>
          <div>
            <p className="text-lg font-bold text-purple-600">{payToVerifyRate}%</p>
            <p className="text-[10px] text-muted-foreground">Paid→Verified</p>
          </div>
          <div>
            <p className="text-lg font-bold text-teal-600">{verifyToDisburseRate}%</p>
            <p className="text-[10px] text-muted-foreground">Verified→Disbursed</p>
          </div>
        </div>
        
        {/* Row 2: Per Total Lead Metrics (Revenue & Expense per ALL leads) */}
        <div className="grid grid-cols-2 gap-2 text-center mb-3 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div>
            <p className="text-base font-bold text-green-600">₹{revenuePerLead.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">Revenue/Lead</p>
          </div>
          <div>
            <p className="text-base font-bold text-orange-600">₹{expensePerLead.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">Expense/Lead</p>
          </div>
        </div>
        
        {/* Row 3: Per Paid Lead Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center p-2 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
          <div>
            <p className="text-base font-bold text-green-600">₹{revenuePerPaid.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">Revenue/Paid</p>
          </div>
          <div>
            <p className="text-base font-bold text-red-600">₹{expensePerPaid.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">Expense/Paid</p>
          </div>
          <div>
            <p className={`text-base font-bold ${profitPerPaid >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              ₹{profitPerPaid.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-muted-foreground">Profit/Paid</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LeadFunnelVisualization;
