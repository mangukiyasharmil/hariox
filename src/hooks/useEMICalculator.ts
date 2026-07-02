import { useMemo } from "react";
import type { EMICalculation } from "@/types/database";

export function calculateEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number
): EMICalculation {
  // Convert annual rate to monthly rate (in decimal)
  const monthlyRate = annualRate / 12 / 100;
  
  // EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
  let emi: number;
  
  if (monthlyRate === 0) {
    emi = principal / tenureMonths;
  } else {
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    emi = (principal * monthlyRate * factor) / (factor - 1);
  }
  
  const totalPayment = emi * tenureMonths;
  const totalInterest = totalPayment - principal;
  
  return {
    principal,
    interestRate: annualRate,
    tenureMonths,
    emi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalPayment: Math.round(totalPayment),
  };
}

export function useEMICalculator(
  principal: number,
  annualRate: number,
  tenureMonths: number
): EMICalculation {
  return useMemo(
    () => calculateEMI(principal, annualRate, tenureMonths),
    [principal, annualRate, tenureMonths]
  );
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-IN").format(amount);
}
