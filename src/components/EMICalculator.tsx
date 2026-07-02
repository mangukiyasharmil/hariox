import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, IndianRupee, Calendar, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useEMICalculator, formatCurrency, formatNumber } from "@/hooks/useEMICalculator";

const consultingBenefits = [
  "Expert guidance on loan selection",
  "Document verification support",
  "Higher approval chances",
  "Faster processing time",
  "Dedicated relationship manager",
  "Post-disbursement support",
];

interface EMICalculatorProps {
  onApplyNow: (loanAmount: number, interestRate: number, tenure: number, emi: number) => void;
}

const EMICalculator = ({ onApplyNow }: EMICalculatorProps) => {
  const [loanAmount, setLoanAmount] = useState(500000);
  const [interestRate, setInterestRate] = useState(10);
  const [tenure, setTenure] = useState(36);

  const calculation = useEMICalculator(loanAmount, interestRate, tenure);

  // Calculate progress for pie chart visualization
  const principalPercentage = (calculation.principal / calculation.totalPayment) * 100;

  return (
    <section id="calculator" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Calculator className="w-4 h-4" />
            Loan Calculator
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Check Your <span className="text-gradient-brand">Loan Eligibility</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Calculate your monthly EMI and see how much loan you can afford based on your income
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Calculator */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-card rounded-3xl p-8 shadow-card border border-border"
          >
            <div className="space-y-8">
              {/* Loan Amount */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-primary" />
                    Loan Amount
                  </Label>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(loanAmount)}
                  </span>
                </div>
                <Slider
                  value={[loanAmount]}
                  onValueChange={([value]) => setLoanAmount(value)}
                  min={100000}
                  max={10000000}
                  step={50000}
                  className="py-2"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>₹1 Lakh</span>
                  <span>₹1 Crore</span>
                </div>
              </div>

              {/* Interest Rate */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Interest Rate (p.a.)
                  </Label>
                  <span className="text-2xl font-bold text-primary">{interestRate}%</span>
                </div>
                <Slider
                  value={[interestRate]}
                  onValueChange={([value]) => setInterestRate(value)}
                  min={10}
                  max={24}
                  step={0.5}
                  className="py-2"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>10%</span>
                  <span>24%</span>
                </div>
              </div>

              {/* Tenure */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Loan Tenure
                  </Label>
                  <span className="text-2xl font-bold text-primary">{tenure} Months</span>
                </div>
                <Slider
                  value={[tenure]}
                  onValueChange={([value]) => setTenure(value)}
                  min={36}
                  max={360}
                  step={12}
                  className="py-2"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>3 Years</span>
                  <span>30 Years</span>
                </div>
              </div>

              {/* EMI Result */}
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-6 mt-8">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">Your Monthly EMI</p>
                  <p className="text-4xl lg:text-5xl font-extrabold text-gradient-brand">
                    {formatCurrency(calculation.emi)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border/50">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Interest</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(calculation.totalInterest)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Payment</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(calculation.totalPayment)}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="hero"
                size="xl"
                className="w-full group"
                onClick={() => onApplyNow(loanAmount, interestRate, tenure, calculation.emi)}
              >
                Apply for This Loan
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          {/* Benefits Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            {/* Consulting Fee Card */}
            <div className="bg-card rounded-3xl p-8 shadow-card border border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center">
                  <IndianRupee className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Consulting Fee</h3>
                  <p className="text-muted-foreground">One-time processing fee</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-2xl p-6 mb-6">
                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="font-bold text-lg">Total (incl. GST)</span>
                  <span className="font-extrabold text-2xl text-primary">₹799</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                *Fee is refundable if loan is not approved
              </p>
            </div>

            {/* Benefits List */}
            <div className="bg-card rounded-3xl p-8 shadow-card border border-border">
              <h3 className="text-xl font-bold mb-6">What You Get</h3>
              <ul className="space-y-4">
                {consultingBenefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-success" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Visual Chart */}
            <div className="bg-card rounded-3xl p-8 shadow-card border border-border">
              <h3 className="text-xl font-bold mb-6 text-center">Payment Breakdown</h3>
              <div className="relative w-48 h-48 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="12"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="12"
                    strokeDasharray={`${principalPercentage * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm text-muted-foreground">Principal</span>
                  <span className="text-lg font-bold">{principalPercentage.toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex justify-center gap-8 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">Principal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span className="text-sm text-muted-foreground">Interest</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default EMICalculator;
