import { useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  IndianRupee, 
  CreditCard, 
  Receipt, 
  FileText, 
  Globe, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Coins,
  ArrowUpRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const FranchiseBillingPanel = () => {
  const { currentCompany, isLoading: isCompanyLoading } = useCompany();

  // 1. Fetch Royalties list
  const { data: royalties, isLoading: isRoyaltiesLoading } = useQuery({
    queryKey: ["franchise-royalties", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalty_transactions")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // 1b. Fetch Completed Payments for client-side fallback
  const { data: payments, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ["franchise-payments", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("company_id, amount, total_amount, created_at, status")
        .eq("company_id", currentCompany?.id)
        .in("status", ["captured", "completed", "paid"]);
      if (error) throw error;
      return data || [];
    }
  });

  // 2. Fetch Monthly Summary
  const { data: monthlySummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["franchise-monthly-summary", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalty_monthly_summary")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("month_year", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // 3. Fetch Company Stats (total leads, paid leads, pending/collected royalties)
  const { data: companyStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["franchise-company-stats", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_agency_company_stats");
      if (error) throw error;
      const stats = (data || []).find((s: any) => s.company_id === currentCompany?.id);
      return stats || { total_leads: 0, paid_leads: 0, total_revenue: 0, pending_royalty: 0, collected_royalty: 0 };
    }
  });

  const isLoading = isCompanyLoading || isRoyaltiesLoading || isPaymentsLoading || isSummaryLoading || isStatsLoading;

  // ── All hooks MUST be called before any conditional returns ────────────────

  // Process monthly invoices using live company settings so royalty % / per-lead always reflects latest admin config
  const processedRoyalties = useMemo(() => {
    // Prefer aggregated monthly summary (new schema)
    const source = (monthlySummary && monthlySummary.length > 0)
      ? monthlySummary
      : (royalties || []);

    if (!source || source.length === 0) return [];

    return source.map(r => {
      const platformFee  = Number((r as any).monthly_fee ?? currentCompany?.monthly_fee ?? 0);
      const smsCharges   = Number((r as any).sms_charges ?? 0);
      const waCharges    = Number((r as any).whatsapp_charges ?? 0);
      const otherCharges = Number((r as any).other_charges ?? 0);

      const isPercentage = currentCompany?.royalty_type === 'percentage';
      let royaltyAmt = 0;
      let revenueAmt = 0;

      if (isPercentage) {
        // Use stored revenue_amount or sum from payments
        revenueAmt = Number((r as any).revenue_amount ?? 0);
        if (!revenueAmt) {
          revenueAmt = (payments || [])
            .filter(p => p.created_at && p.created_at.startsWith((r as any).month_year))
            .reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
        }
        royaltyAmt = revenueAmt * (Number(currentCompany?.royalty_percentage ?? 0) / 100);
      } else {
        const leadCount = Number((r as any).transaction_count ?? (r as any).lead_count ?? 0);
        royaltyAmt = leadCount * Number(currentCompany?.royalty_per_lead ?? 0);
      }

      const gstRate  = Number(currentCompany?.gst_rate ?? 18);
      const subtotal = platformFee + royaltyAmt + smsCharges + waCharges + otherCharges;
      const gstAmt   = Math.round(subtotal * (gstRate / 100) * 100) / 100;
      const total    = subtotal + gstAmt;

      return {
        ...r,
        lead_count:       Number((r as any).transaction_count ?? (r as any).lead_count ?? 0),
        monthly_fee:      platformFee,
        sms_charges:      smsCharges,
        whatsapp_charges: waCharges,
        other_charges:    otherCharges,
        royalty_amount:   royaltyAmt,
        revenue_amount:   revenueAmt || Number((r as any).revenue_amount ?? 0),
        gst_amount:       gstAmt,
        total_amount:     total,
        collected:        (r as any).status === 'collected' ? total : 0,
        pending:          (r as any).status === 'pending'   ? total : 0,
      };
    });
  }, [monthlySummary, royalties, currentCompany, payments]);

  // ── Early returns after hooks ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-xl">
        <AlertCircle className="w-12 h-12 text-destructive mb-3" />
        <h2 className="text-lg font-bold">No active franchise found</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">
          Make sure your account is mapped to a franchise owner role and assigned to a company.
        </p>
      </div>
    );
  }

  // Sum up pending and collected amounts dynamically on the client side from processed invoices
  const pendingRoyalties = processedRoyalties
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + r.total_amount, 0);

  const collectedRoyalties = processedRoyalties
    .filter(r => r.status === 'collected')
    .reduce((sum, r) => sum + r.total_amount, 0);

  const accruedRoyalties = pendingRoyalties + collectedRoyalties;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
            Royalty & Fees Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor pricing terms, accrued royalties, monthly platform fees, and view invoice history for {currentCompany.name}.
          </p>
        </div>
        {currentCompany.custom_domain && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border border-border/80 rounded-lg text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-muted-foreground">Domain: </span>
            <span className="text-foreground">{currentCompany.custom_domain}</span>
          </div>
        )}
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-b from-card to-muted/20 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Setup Fee Status
            </CardTitle>
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-bold">
              {currentCompany.setup_fee_paid ? (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>Paid</span>
                </div>
              ) : (
                <span className="text-amber-600 dark:text-amber-500">
                  ₹{(currentCompany.setup_fee || 0).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {currentCompany.setup_fee_paid ? "One-time franchise setup fee cleared" : "Setup fee payment pending"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-b from-card to-muted/20 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Platform Fee
            </CardTitle>
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-bold">
              ₹{(currentCompany.monthly_fee || 0).toLocaleString()}
              <span className="text-xs font-medium text-muted-foreground">/mo</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Fixed recurring platform subscription
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-b from-card to-muted/20 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {currentCompany.royalty_type === "percentage" ? "Royalty Rev Share" : "Royalty Per Lead"}
            </CardTitle>
            <div className="p-1.5 bg-amber-500/10 rounded-lg">
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
              {currentCompany.royalty_type === "percentage" ? (
                <>
                  {currentCompany.royalty_percentage || 0}%
                  <span className="text-xs font-medium text-muted-foreground"> of rev</span>
                </>
              ) : (
                <>
                  ₹{(currentCompany.royalty_per_lead || 0).toLocaleString()}
                  <span className="text-xs font-medium text-muted-foreground">/lead</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {currentCompany.royalty_type === "percentage" 
                ? `GST of ${currentCompany.gst_rate || 18.0}% applies to royalty` 
                : "Applicable on paid/converted leads"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-b from-card to-muted/20 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Accrued Royalties
            </CardTitle>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
              ₹{accruedRoyalties.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
              <span>Paid: ₹{collectedRoyalties.toLocaleString()}</span>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-500 font-semibold">Due: ₹{pendingRoyalties.toLocaleString()}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Columns: Ledger & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" /> Royalty Ledger & Invoices
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed list of invoices and payment statuses generated for lead conversions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Royalty</TableHead>
                    <TableHead>Extra Fees</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {!processedRoyalties || processedRoyalties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                        No monthly invoices found for this franchise.
                      </TableCell>
                    </TableRow>
                  ) : (
                    processedRoyalties.slice(0, 50).map((r) => {
                      const extraCharges = Number((r as any).sms_charges || 0) + Number((r as any).whatsapp_charges || 0) + Number((r as any).other_charges || 0);
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-[10px] font-medium text-foreground">
                            {r.invoice_number || "INV-PENDING"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.month_year ? new Date(r.month_year + '-02').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}
                          </TableCell>
                          <TableCell>{(r as any).lead_count || 0}</TableCell>
                          <TableCell>₹{Number((r as any).revenue_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{Number((r as any).monthly_fee || 0).toLocaleString()}</TableCell>
                          <TableCell>₹{Number(r.royalty_amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {extraCharges > 0 ? `₹${extraCharges.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell>₹{Number((r as any).gst_amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">
                            ₹{Number((r as any).total_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={r.status === 'collected' ? 'default' : 'secondary'} 
                              className={`text-[9px] py-0 px-2 font-medium capitalize ${
                                r.status === 'collected' 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}
                            >
                              {r.status === 'collected' ? 'Collected' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.due_date 
                              ? new Date(r.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                              : 'N/A'
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Monthly Summary & Terms Info */}
        <div className="space-y-6">
          {/* Monthly Aggregation Card */}
          {/* Monthly Aggregation Card */}
          <Card className="border-border/60 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Monthly Summaries
              </CardTitle>
              <CardDescription className="text-xs">
                Accrued lead volumes and invoices grouped by month.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!processedRoyalties || processedRoyalties.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No monthly summaries calculated yet.
                </div>
              ) : (
                processedRoyalties.map((m) => (
                  <div 
                    key={m.month_year} 
                    className="flex flex-col p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                        {m.month_year ? new Date(m.month_year + '-02').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A'}
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {m.lead_count || 0} leads
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Total Invoice Amt:</span>
                      <span className="font-bold text-foreground">₹{Number(m.total_amount).toLocaleString()}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] mt-1 pt-1.5 border-t border-border/30">
                      <div>
                        <span className="text-muted-foreground">Paid: </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-500">₹{Number(m.collected).toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">Due: </span>
                        <span className="font-semibold text-amber-600 dark:text-amber-500">₹{Number(m.pending).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pricing Terms Reference */}
          <Card className="border-border/60 bg-gradient-to-b from-card to-muted/20 shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Pricing & Platform Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <span className="text-muted-foreground">Setup Fee</span>
                <span className="font-semibold text-foreground">₹{(currentCompany.setup_fee || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <span className="text-muted-foreground">Platform Access Fee</span>
                <span className="font-semibold text-foreground">₹{(currentCompany.monthly_fee || 0).toLocaleString()}/mo</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <span className="text-muted-foreground">Royalty Model</span>
                <span className="font-semibold text-foreground capitalize">
                  {currentCompany.royalty_type === "percentage" ? "Revenue Share" : "Per Lead Flat Fee"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <span className="text-muted-foreground">Royalty Rate</span>
                <span className="font-semibold text-foreground">
                  {currentCompany.royalty_type === "percentage" 
                    ? `${currentCompany.royalty_percentage || 0}% of revenue` 
                    : `₹${(currentCompany.royalty_per_lead || 0).toLocaleString()} per lead`}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <span className="text-muted-foreground">GST Rate</span>
                <span className="font-semibold text-foreground">
                  {currentCompany.gst_rate || 18.0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Billing Contact</span>
                <span className="font-semibold text-foreground">billing@hariox.com</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FranchiseBillingPanel;
