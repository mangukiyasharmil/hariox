import { useState, useEffect } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeLeads";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Download, ExternalLink, IndianRupee, Clock, CreditCard, Smartphone, Banknote, Plus, Megaphone, Globe, Filter, X, Trash2, MessageCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import PasswordConfirmDialog from "./PasswordConfirmDialog";
import { useDateFilter } from "@/hooks/useDateFilter";
import DateFilterSelect from "./DateFilterSelect";

// Use inline type to accommodate new payment sources from Supabase
interface PaymentWithLead {
  id: string;
  lead_id: string;
  amount: number;
  gst_amount: number;
  total_amount: number;
  payment_source: string; // Accept any string to handle new enum values
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status: string;
  collected_by: string | null;
  payment_date: string | null;
  created_at: string;
  company_id?: string | null;
  lead?: { full_name: string; phone: string } | null;
}

type SourceFilter = "all" | "direct" | "marketing" | "telecaller" | "manual" | "whatsapp";
type StatusFilter = "all" | "completed" | "pending";
type GatewayFilter = "all" | "razorpay" | "phonepe" | "paytm" | "cash";

const PaymentsManagement = () => {
  const { currentCompany, showAllCompanies, getCompanyFilter } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const { dateRange, setDateRange, customStart, customEnd, setCustomStart, setCustomEnd, startDateISO, endDateISO } = useDateFilter("today");
  
  // New filters
  const [selectedSource, setSelectedSource] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [gatewayFilter, setGatewayFilter] = useState<GatewayFilter>("all");
  
  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  
  // Bulk import state
  const [isImporting, setIsImporting] = useState(false);

  // Check if current user is telecaller (non-admin) to filter payments
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(true); // default true to show all until loaded

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", session.user.id);
        setIsAdmin(roles?.some(r => r.role === "admin") || false);
      }
    });
  }, []);

  // Realtime sync — auto-refresh across devices
  useRealtimeSync([["payments"]]);

  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", dateRange, customStart, customEnd, currentCompany?.id, showAllCompanies, userId, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select("*, lead:leads(full_name, phone)")
        .order("created_at", { ascending: false });

      const companyId = getCompanyFilter();
      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      // Telecallers see all payments (no date filter) — they only search by phone
      // Admins use date filters
      if (isAdmin && dateRange !== "all") {
        query = query.gte("created_at", startDateISO);
        if (dateRange === "yesterday" || dateRange === "today" || dateRange === "custom") {
          query = query.lte("created_at", endDateISO);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PaymentWithLead[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  // Apply all filters
  const filtered = payments.filter((p) => {
    const name = p.lead?.full_name?.toLowerCase() || "";
    const phone = p.lead?.phone || "";
    const txn = p.razorpay_payment_id || "";
    const term = searchTerm.toLowerCase();
    const matchesSearch = name.includes(term) || phone.includes(term) || txn.includes(term);
    
    const matchesSource = selectedSource === "all" || p.payment_source === selectedSource;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    
    // Gateway filter based on order_id patterns (order_id stored in razorpay_order_id field)
    let matchesGateway = true;
    if (gatewayFilter !== "all") {
      const orderId = p.razorpay_order_id?.toLowerCase() || "";
      const paymentId = p.razorpay_payment_id?.toLowerCase() || "";
      if (gatewayFilter === "razorpay") {
        matchesGateway = orderId.startsWith("order_") || paymentId.startsWith("pay_");
      } else if (gatewayFilter === "phonepe") {
        matchesGateway = orderId.startsWith("txn_") && !orderId.includes("paytm");
      } else if (gatewayFilter === "paytm") {
        matchesGateway = orderId.includes("paytm") || paymentId.includes("paytm");
      } else if (gatewayFilter === "cash") {
        matchesGateway = orderId.startsWith("cash_") || paymentId.startsWith("cash_") || orderId.includes("manual");
      }
    }
    
    return matchesSearch && matchesSource && matchesStatus && matchesGateway;
  });

  // Stats
  const completedPayments = payments.filter((p) => p.status === "completed" || p.status === "captured");
  const totalCollected = completedPayments.reduce((sum, p) => sum + Number(p.total_amount), 0);
  
  const directPayments = completedPayments.filter((p) => p.payment_source === "direct");
  const directCount = directPayments.length;
  const directAmount = directPayments.reduce((s, p) => s + Number(p.total_amount), 0);
  
  const marketingPayments = completedPayments.filter((p) => p.payment_source === "marketing");
  const marketingCount = marketingPayments.length;
  const marketingAmount = marketingPayments.reduce((s, p) => s + Number(p.total_amount), 0);
  
  const whatsappPayments = completedPayments.filter((p) => p.payment_source === "whatsapp");
  const whatsappCount = whatsappPayments.length;
  const whatsappAmount = whatsappPayments.reduce((s, p) => s + Number(p.total_amount), 0);
  
  const telecallerPayments = completedPayments.filter((p) => p.payment_source === "telecaller");
  const telecallerCount = telecallerPayments.length;
  const telecallerAmount = telecallerPayments.reduce((s, p) => s + Number(p.total_amount), 0);
  
  const manualPayments = completedPayments.filter((p) => p.payment_source === "manual");
  const manualCount = manualPayments.length;
  const manualAmount = manualPayments.reduce((s, p) => s + Number(p.total_amount), 0);
  
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  const sourceCards = [
    { key: "direct" as SourceFilter, label: "Website", count: directCount, amount: directAmount, icon: Globe, color: "blue" },
    { key: "marketing" as SourceFilter, label: "SMS", count: marketingCount, amount: marketingAmount, icon: Megaphone, color: "green" },
    { key: "whatsapp" as SourceFilter, label: "WhatsApp", count: whatsappCount, amount: whatsappAmount, icon: MessageCircle, color: "emerald" },
    { key: "telecaller" as SourceFilter, label: "Telecaller", count: telecallerCount, amount: telecallerAmount, icon: Smartphone, color: "purple" },
    { key: "manual" as SourceFilter, label: "Manual", count: manualCount, amount: manualAmount, icon: Banknote, color: "orange" },
  ];

  const getSourceBadge = (source: string) => {
    if (source === "direct") return { label: "Website", className: "bg-blue-100 text-blue-800" };
    if (source === "marketing") return { label: "SMS", className: "bg-green-100 text-green-800" };
    if (source === "whatsapp") return { label: "WhatsApp", className: "bg-emerald-100 text-emerald-800" };
    if (source === "telecaller") return { label: "Telecaller", className: "bg-purple-100 text-purple-800" };
    return { label: "Manual", className: "bg-orange-100 text-orange-800" };
  };

  // Detect payment gateway from order/payment IDs
  const getPaymentGateway = (orderId: string | null, paymentId: string | null) => {
    const oid = (orderId || "").toLowerCase();
    const pid = (paymentId || "").toLowerCase();
    
    if (oid.startsWith("order_") || pid.startsWith("pay_")) {
      return { label: "Razorpay", className: "bg-indigo-100 text-indigo-800", icon: "💳" };
    }
    if (oid.includes("paytm") || pid.includes("paytm")) {
      return { label: "Paytm", className: "bg-sky-100 text-sky-800", icon: "📱" };
    }
    if (oid.startsWith("txn_") || oid.includes("phonepe")) {
      return { label: "PhonePe", className: "bg-purple-100 text-purple-800", icon: "📲" };
    }
    if (oid.startsWith("cash_") || oid.includes("manual") || pid.startsWith("cash_")) {
      return { label: "Cash", className: "bg-amber-100 text-amber-800", icon: "💵" };
    }
    // Default for older payments or unknown
    return { label: "Gateway", className: "bg-gray-100 text-gray-800", icon: "💰" };
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed" || status === "captured") return { label: "Completed", className: "bg-green-100 text-green-800" };
    if (status === "pending") return { label: "Pending", className: "bg-yellow-100 text-yellow-800" };
    if (status === "failed") return { label: "Failed", className: "bg-red-100 text-red-800" };
    return { label: status, className: "bg-gray-100 text-gray-800" };
  };

  const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", iconBg: "bg-blue-100" },
    green: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200", iconBg: "bg-green-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", iconBg: "bg-emerald-100" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", iconBg: "bg-purple-100" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", iconBg: "bg-orange-100" },
  };

  const clearFilters = () => {
    setSelectedSource("all");
    setStatusFilter("all");
    setGatewayFilter("all");
  };

  const hasActiveFilters = selectedSource !== "all" || statusFilter !== "all" || gatewayFilter !== "all";

  const handleDelete = (paymentId: string) => {
    setPaymentToDelete(paymentId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    
    try {
      // Get the payment to find lead_id
      const payment = payments.find(p => p.id === paymentToDelete);
      
      // Delete the payment
      const { error } = await supabase.from("payments").delete().eq("id", paymentToDelete);
      if (error) throw error;
      
      // If payment was completed, revert lead status to unpaid
      if (payment && payment.status === "completed" && payment.lead_id) {
        await supabase.from("leads").update({ status: "unpaid" }).eq("id", payment.lead_id);
        
        // Create reversal accounting entry
        await supabase.from("accounting_entries").insert({
          entry_type: "expense",
          category: "Payment Reversal",
          amount: Number(payment.total_amount),
          description: `Reversed payment for ${payment.lead?.full_name || "Unknown"} - Payment deleted`,
          entry_date: new Date().toISOString().split("T")[0],
        });
      }
      
      toast.success("Payment deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast.error("Failed to delete payment");
    }
    
    setPaymentToDelete(null);
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) throw new Error("CSV must have header + data rows");
      
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const phoneIdx = headers.findIndex(h => h.includes("phone"));
      const amountIdx = headers.findIndex(h => h.includes("amount") && !h.includes("gst") && !h.includes("total"));
      const sourceIdx = headers.findIndex(h => h.includes("source"));
      const dateIdx = headers.findIndex(h => h.includes("date"));
      
      if (phoneIdx === -1 || amountIdx === -1) {
        throw new Error("CSV must have 'phone' and 'amount' columns");
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      let imported = 0;
      let skipped = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
        const phone = cols[phoneIdx]?.replace(/\D/g, "").slice(-10);
        const amount = parseFloat(cols[amountIdx]);
        
        if (!phone || isNaN(amount) || amount <= 0) { skipped++; continue; }
        
        // Find lead by phone
        const { data: lead } = await supabase
          .from("leads").select("id, company_id").eq("phone", phone).limit(1).single();
        
        if (!lead) { skipped++; continue; }
        
        const gstAmount = Math.round(amount * 0.18);
        const totalAmount = amount + gstAmount;
        const source = cols[sourceIdx] || "manual";
        
        const { error } = await supabase.from("payments").insert({
          lead_id: lead.id,
          amount,
          gst_amount: gstAmount,
          total_amount: totalAmount,
          payment_source: source as any,
          status: "completed",
          collected_by: session?.user.id,
          company_id: lead.company_id,
          razorpay_order_id: `bulk_${Date.now()}_${i}`,
          razorpay_payment_id: `bulk_import_${i}`,
          payment_date: cols[dateIdx] || new Date().toISOString(),
        });
        
        if (!error) {
          await supabase.from("leads").update({ status: "paid" }).eq("id", lead.id);
          imported++;
        } else { skipped++; }
      }
      
      toast.success(`Imported ${imported} payments, ${skipped} skipped`);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (error: any) {
      console.error("Bulk import error:", error);
      toast.error(error.message || "Failed to import CSV");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No payments to export");
      return;
    }

    const headers = ["Customer Name", "Phone", "Source", "Gateway", "Amount", "GST", "Total", "Date", "Status", "Transaction ID"];
    const rows = filtered.map((p) => {
      const gateway = getPaymentGateway(p.razorpay_order_id, p.razorpay_payment_id);
      return [
        p.lead?.full_name || "—",
        p.lead?.phone || "—",
        getSourceBadge(p.payment_source).label,
        gateway.label,
        p.amount,
        p.gst_amount,
        p.total_amount,
        new Date(p.created_at).toLocaleDateString("en-IN"),
        p.status,
        p.razorpay_payment_id || "—",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payments_${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} payments`);
  };

  

  return (
    <div className="space-y-4">
      {/* Total Summary Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-700">Total Collected</p>
            <p className="text-3xl font-bold text-green-600">₹{totalCollected.toLocaleString("en-IN")}</p>
            <p className="text-xs text-green-600 mt-1">{completedPayments.length} transactions • {pendingCount} pending</p>
          </div>
          <div className="p-3 rounded-2xl bg-green-100">
            <IndianRupee className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </motion.div>

      {/* Clickable Source Cards - Admin only */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {sourceCards.map((src) => {
            const c = colorMap[src.color];
            const isSelected = selectedSource === src.key;
            return (
              <motion.div
                key={src.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedSource(isSelected ? "all" : src.key)}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? `${c.bg} ${c.border} ring-2 ring-offset-1 ring-${src.color}-400` 
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{src.label}</p>
                    <p className={`text-xl font-bold ${c.text}`}>{src.count}</p>
                    <p className="text-sm font-medium text-muted-foreground">₹{src.amount.toLocaleString("en-IN")}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${c.iconBg}`}>
                    <src.icon className={`w-4 h-4 ${c.text}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isAdmin ? "Search by name, phone, or transaction ID..." : "Search by mobile number..."} 
              className="pl-9" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <DateFilterSelect
                dateRange={dateRange}
                setDateRange={setDateRange}
                customStart={customStart}
                customEnd={customEnd}
                setCustomStart={setCustomStart}
                setCustomEnd={setCustomEnd}
                showYesterday={true}
                showCustom={true}
              />
            )}
            
            {/* Source filter for telecallers */}
            <select 
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm"
              value={selectedSource} 
              onChange={(e) => setSelectedSource(e.target.value as SourceFilter)}
            >
              <option value="all">All Sources</option>
              <option value="direct">Website</option>
              <option value="marketing">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telecaller">Telecaller</option>
              <option value="manual">Manual</option>
            </select>

            {isAdmin && (
              <>
                <select 
                  className="px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
                
                <select 
                  className="px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  value={gatewayFilter} 
                  onChange={(e) => setGatewayFilter(e.target.value as GatewayFilter)}
                >
                  <option value="all">All Gateways</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="phonepe">PhonePe</option>
                  <option value="paytm">Paytm</option>
                  <option value="cash">Cash/Manual</option>
                </select>
              </>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
            
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
                
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="bulk-import-input"
                  onChange={handleBulkImport}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isImporting}
                  onClick={() => document.getElementById("bulk-import-input")?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {isImporting ? "Importing..." : "Import CSV"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Active filter indicator */}
        {selectedSource !== "all" && (
          <div className="mt-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{selectedSource}</span> payments ({filtered.length})
            </span>
          </div>
        )}
      </div>

      {/* Payments - Mobile Cards + Desktop Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {hasActiveFilters ? "No payments match the selected filters" : "No payments found"}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-border">
              {filtered.map((p) => {
                const source = getSourceBadge(p.payment_source);
                const gateway = getPaymentGateway(p.razorpay_order_id, p.razorpay_payment_id);
                const status = getStatusBadge(p.status);
                return (
                  <div key={p.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{p.lead?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.lead?.phone || "—"}</p>
                      </div>
                      <p className="font-bold text-green-600">₹{Number(p.total_amount).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${source.className}`}>{source.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${gateway.className}`}>{gateway.icon} {gateway.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${status.className}`}>{status.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(p.created_at).toLocaleDateString("en-IN")} {new Date(p.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Source</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Gateway</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date & Time</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Transaction ID</th>
                    {isAdmin && <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const source = getSourceBadge(p.payment_source);
                    const gateway = getPaymentGateway(p.razorpay_order_id, p.razorpay_payment_id);
                    const status = getStatusBadge(p.status);
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-4">
                          <p className="font-medium">{p.lead?.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{p.lead?.phone || "—"}</p>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${source.className}`}>{source.label}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${gateway.className}`}>{gateway.icon} {gateway.label}</span>
                        </td>
                        <td className="p-4 font-semibold text-green-600">₹{Number(p.total_amount).toLocaleString("en-IN")}</td>
                        <td className="p-4 text-muted-foreground">
                          <div className="text-sm">{new Date(p.created_at).toLocaleDateString("en-IN")}</div>
                          <div className="text-xs">{new Date(p.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${status.className}`}>{status.label}</span>
                        </td>
                        <td className="p-4 font-mono text-xs">{p.razorpay_payment_id?.slice(0, 18) || "—"}</td>
                        {isAdmin && (
                          <td className="p-4">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" title="View Details"><ExternalLink className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" title="Delete Payment" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog with Password */}
      <PasswordConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete Payment"
        description="Enter admin password to delete this payment. Lead status will be reverted to unpaid and a reversal entry will be created in accounting."
      />
    </div>
  );
};

export default PaymentsManagement;
