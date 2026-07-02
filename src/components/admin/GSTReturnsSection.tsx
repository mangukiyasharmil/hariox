 import { useState, useMemo } from "react";
 import { Download, Calendar } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 
 interface AccountingEntry {
   id: string;
   entry_type: "income" | "expense";
   category: string;
   amount: number;
   description: string | null;
   entry_date: string;
   created_at: string;
   lead_id: string | null;
   gst_included?: boolean;
   gst_rate?: number;
   lead?: { full_name: string; phone: string } | null;
   customer_name?: string;
   customer_phone?: string;
 }
 
 interface GSTInvoice {
   id: string;
   invoice_number: string;
   customer_name: string;
   customer_email: string;
   customer_phone: string;
   amount: number;
   gst_amount: number;
   total_amount: number;
   invoice_date: string;
   status: string;
   lead_id: string | null;
 }
 
 interface GSTReturnsSectionProps {
   entries: AccountingEntry[];
   invoices: GSTInvoice[];
   exportGSTR1: () => void;
   exportGSTR2: () => void;
   exportGSTR3B: () => void;
 }
 
 // Generate month options for the last 12 months
 const getMonthOptions = () => {
   const options: { value: string; label: string }[] = [];
   const now = new Date();
   
   for (let i = 0; i < 12; i++) {
     const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
     const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
     const label = date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
     options.push({ value, label });
   }
   
   return options;
 };
 
 const GSTReturnsSection = ({
   entries,
   invoices,
   exportGSTR1,
   exportGSTR2,
   exportGSTR3B,
 }: GSTReturnsSectionProps) => {
   const now = new Date();
   const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
   const [selectedMonth, setSelectedMonth] = useState(currentMonth);
   
   const monthOptions = useMemo(() => getMonthOptions(), []);
   
   // Filter entries and invoices by selected month
   const filteredData = useMemo(() => {
     const [year, month] = selectedMonth.split("-").map(Number);
     const monthStart = new Date(year, month - 1, 1);
     const monthEnd = new Date(year, month, 0); // Last day of month
     
     const filteredEntries = entries.filter(e => {
       const entryDate = new Date(e.entry_date + "T00:00:00");
       return entryDate >= monthStart && entryDate <= monthEnd;
     });
     
     const filteredInvoices = invoices.filter(inv => {
       const invDate = new Date(inv.invoice_date);
       return invDate >= monthStart && invDate <= monthEnd;
     });
     
     return { entries: filteredEntries, invoices: filteredInvoices };
   }, [entries, invoices, selectedMonth]);
   
   // Calculate GST for filtered data
   const gstData = useMemo(() => {
     const income = filteredData.entries.filter(e => e.entry_type === "income");
     const expenses = filteredData.entries.filter(e => e.entry_type === "expense");
     
     const outputGST = income
       .filter(e => e.gst_included)
       .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
     
     const inputGST = expenses
       .filter(e => e.gst_included)
       .reduce((sum, e) => sum + (Number(e.amount) * (e.gst_rate || 18) / (100 + (e.gst_rate || 18))), 0);
     
     return { outputGST, inputGST, netGST: outputGST - inputGST };
   }, [filteredData.entries]);
   
  // Helper to extract sequence number from invoice_number for proper sorting
  const getInvoiceSequence = (invoiceNumber: string): number => {
    // Invoice format: PREFIX/YYYY-YY/NNNN - extract the last numeric part
    const match = invoiceNumber.match(/\/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Export functions that use filtered data
  const exportMonthlyGSTR1 = () => {
    const salesInvoices = filteredData.invoices
      .filter(i => i.status !== 'cancelled')
      .sort((a, b) => getInvoiceSequence(a.invoice_number) - getInvoiceSequence(b.invoice_number));
    const [year, month] = selectedMonth.split("-");
    const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    
    let csv = `GSTR-1 Report - Outward Supplies (${monthLabel})\n\n`;
    csv += "Invoice No.,Invoice Date,Customer Name,Customer Mobile,GSTIN,Taxable Value,CGST (9%),SGST (9%),Total GST,Total Value\n";
    
    salesInvoices.forEach(inv => {
      const cgst = Number(inv.gst_amount) / 2;
      const sgst = Number(inv.gst_amount) / 2;
      csv += `${inv.invoice_number},${new Date(inv.invoice_date).toLocaleDateString("en-IN")},${inv.customer_name},${inv.customer_phone},-,${Number(inv.amount).toFixed(2)},${cgst.toFixed(2)},${sgst.toFixed(2)},${Number(inv.gst_amount).toFixed(2)},${Number(inv.total_amount).toFixed(2)}\n`;
    });
     
     const totalTaxable = salesInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
     const totalGST = salesInvoices.reduce((sum, i) => sum + Number(i.gst_amount), 0);
     const totalCGST = totalGST / 2;
     const totalSGST = totalGST / 2;
     const totalValue = salesInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
     
     csv += `\nTOTAL,-,-,-,-,${totalTaxable.toFixed(2)},${totalCGST.toFixed(2)},${totalSGST.toFixed(2)},${totalGST.toFixed(2)},${totalValue.toFixed(2)}\n`;
 
     const blob = new Blob([csv], { type: "text/csv" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `GSTR1_${selectedMonth}.csv`;
     a.click();
   };
   
   const exportMonthlyGSTR2 = () => {
     const purchases = filteredData.entries.filter(e => e.entry_type === "expense" && e.gst_included);
     const [year, month] = selectedMonth.split("-");
     const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
     
     let csv = `GSTR-2 Report - Inward Supplies (${monthLabel})\n\n`;
     csv += "Date,Category,Description,Taxable Value,GST Rate,CGST,SGST,Total GST,Total Value\n";
     
     purchases.forEach(e => {
       const rate = e.gst_rate || 18;
       const taxable = Number(e.amount) * 100 / (100 + rate);
       const gstAmt = Number(e.amount) - taxable;
       const cgst = gstAmt / 2;
       const sgst = gstAmt / 2;
       csv += `${new Date(e.entry_date).toLocaleDateString("en-IN")},${e.category},"${e.description || ''}",${taxable.toFixed(2)},${rate}%,${cgst.toFixed(2)},${sgst.toFixed(2)},${gstAmt.toFixed(2)},${Number(e.amount).toFixed(2)}\n`;
     });
     
     const totalAmount = purchases.reduce((sum, e) => sum + Number(e.amount), 0);
     const totalGST = purchases.reduce((sum, e) => {
       const rate = e.gst_rate || 18;
       return sum + (Number(e.amount) * rate / (100 + rate));
     }, 0);
     const totalCGST = totalGST / 2;
     const totalSGST = totalGST / 2;
     const totalTaxable = totalAmount - totalGST;
     
     csv += `\nTOTAL,,,${totalTaxable.toFixed(2)},,${totalCGST.toFixed(2)},${totalSGST.toFixed(2)},${totalGST.toFixed(2)},${totalAmount.toFixed(2)}\n`;
 
     const blob = new Blob([csv], { type: "text/csv" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `GSTR2_${selectedMonth}.csv`;
     a.click();
   };
   
   const exportMonthlyGSTR3B = () => {
     const income = filteredData.entries.filter(e => e.entry_type === "income");
     const expenses = filteredData.entries.filter(e => e.entry_type === "expense");
     const totalIncome = income.reduce((sum, e) => sum + Number(e.amount), 0);
     const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
     
     const outputCGST = gstData.outputGST / 2;
     const outputSGST = gstData.outputGST / 2;
     const inputCGST = gstData.inputGST / 2;
     const inputSGST = gstData.inputGST / 2;
     const netCGST = outputCGST - inputCGST;
     const netSGST = outputSGST - inputSGST;
     
     const [year, month] = selectedMonth.split("-");
     const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
     
     let csv = `GSTR-3B Summary Report (${monthLabel})\n\n`;
     csv += "Section,Description,CGST,SGST,Total\n";
     csv += `3.1,Output Tax (Collected),${outputCGST.toFixed(2)},${outputSGST.toFixed(2)},${gstData.outputGST.toFixed(2)}\n`;
     csv += `4,Input Tax Credit (Paid),${inputCGST.toFixed(2)},${inputSGST.toFixed(2)},${gstData.inputGST.toFixed(2)}\n`;
     csv += `6.1,Net Tax Payable,${netCGST.toFixed(2)},${netSGST.toFixed(2)},${gstData.netGST.toFixed(2)}\n\n`;
     csv += `Financial Summary\n`;
     csv += `Total Revenue,${totalIncome.toFixed(2)}\n`;
     csv += `Total Expenses,${totalExpense.toFixed(2)}\n`;
     csv += `Net Profit/Loss,${(totalIncome - totalExpense).toFixed(2)}\n`;
     csv += `GST Liability (CGST),${netCGST.toFixed(2)}\n`;
     csv += `GST Liability (SGST),${netSGST.toFixed(2)}\n`;
     csv += `Total GST Liability,${gstData.netGST.toFixed(2)}\n`;
 
     const blob = new Blob([csv], { type: "text/csv" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `GSTR3B_${selectedMonth}.csv`;
     a.click();
   };
   
   const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
 
   return (
     <div className="bg-card rounded-xl border border-border p-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
         <div>
           <h2 className="text-xl font-semibold">GST Returns</h2>
           <p className="text-muted-foreground">Download GST reports for filing</p>
         </div>
         <div className="flex items-center gap-2">
           <Calendar className="w-4 h-4 text-muted-foreground" />
           <Select value={selectedMonth} onValueChange={setSelectedMonth}>
             <SelectTrigger className="w-[180px]">
               <SelectValue placeholder="Select month" />
             </SelectTrigger>
             <SelectContent>
               {monthOptions.map(option => (
                 <SelectItem key={option.value} value={option.value}>
                   {option.label}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
       </div>
       
       {/* Month Summary */}
       <div className="mb-6 p-4 bg-muted/50 rounded-lg">
         <p className="text-sm font-medium text-muted-foreground mb-1">Showing data for</p>
         <p className="text-lg font-semibold">{selectedMonthLabel}</p>
         <div className="flex flex-wrap gap-4 mt-2 text-sm">
           <span>Invoices: <strong>{filteredData.invoices.length}</strong></span>
           <span>Transactions: <strong>{filteredData.entries.length}</strong></span>
         </div>
       </div>
       
       <div className="grid md:grid-cols-3 gap-4">
         <div className="border rounded-xl p-4">
           <h3 className="font-semibold mb-2">GSTR-1</h3>
           <p className="text-sm text-muted-foreground mb-4">Outward supplies (sales invoices)</p>
           <Button variant="outline" className="w-full" onClick={exportMonthlyGSTR1}>
             <Download className="w-4 h-4 mr-2" />
             Download GSTR-1
           </Button>
         </div>
         <div className="border rounded-xl p-4">
           <h3 className="font-semibold mb-2">GSTR-2</h3>
           <p className="text-sm text-muted-foreground mb-4">Inward supplies (purchase invoices)</p>
           <Button variant="outline" className="w-full" onClick={exportMonthlyGSTR2}>
             <Download className="w-4 h-4 mr-2" />
             Download GSTR-2
           </Button>
         </div>
         <div className="border rounded-xl p-4">
           <h3 className="font-semibold mb-2">GSTR-3B</h3>
           <p className="text-sm text-muted-foreground mb-4">Monthly summary return</p>
           <Button variant="outline" className="w-full" onClick={exportMonthlyGSTR3B}>
             <Download className="w-4 h-4 mr-2" />
             Download GSTR-3B
           </Button>
         </div>
       </div>
 
       {/* GST Summary */}
       <div className="mt-6 grid md:grid-cols-3 gap-4">
         <div className="bg-green-50 rounded-xl p-4 border border-green-200">
           <p className="text-sm text-muted-foreground">Output GST (Collected)</p>
           <p className="text-2xl font-bold text-green-700">₹{gstData.outputGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
         </div>
         <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
           <p className="text-sm text-muted-foreground">Input GST (Paid)</p>
           <p className="text-2xl font-bold text-blue-700">₹{gstData.inputGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
         </div>
         <div className={`rounded-xl p-4 border ${gstData.netGST >= 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
           <p className="text-sm text-muted-foreground">{gstData.netGST >= 0 ? "GST Payable" : "GST Refundable"}</p>
           <p className={`text-2xl font-bold ${gstData.netGST >= 0 ? "text-amber-700" : "text-green-700"}`}>
             ₹{Math.abs(gstData.netGST).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
           </p>
         </div>
       </div>
     </div>
   );
 };
 
 export default GSTReturnsSection;