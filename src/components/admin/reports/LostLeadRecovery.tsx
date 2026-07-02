import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, MessageSquare, Phone, IndianRupee, TrendingUp, Search, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  startISO: string;
  endISO: string;
}

interface RecoverableLead {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  loan_amount: number;
  monthly_income: number;
  cibil_score_range: string | null;
  source: string | null;
  created_at: string;
  status: string;
  call_count: number;
  recovery_score: number;
}

const LostLeadRecovery = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [revivedIds, setRevivedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["lost-lead-recovery", startISO, endISO, companyId],
    queryFn: async () => {
      const lostLeadsRes = await applyCompanyFilter(
        supabase
          .from("leads")
          .select("id, full_name, phone, email, city, loan_amount, monthly_income, cibil_score_range, source, created_at, status, follow_up_notes")
          .in("status", ["lost", "rejected"])
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .order("created_at", { ascending: false })
      ).limit(2000);

      const lost = lostLeadsRes.data || [];
      if (lost.length === 0) return { recoverable: [], total: 0, totalLost: 0, potentialValue: 0 };

      const leadIds = lost.map(l => l.id);
      const callsRes = await supabase
        .from("call_logs")
        .select("lead_id, outcome")
        .in("lead_id", leadIds);

      const callsByLead = new Map<string, { count: number; outcomes: string[] }>();
      (callsRes.data || []).forEach(c => {
        const entry = callsByLead.get(c.lead_id) || { count: 0, outcomes: [] };
        entry.count++;
        entry.outcomes.push(c.outcome || "unknown");
        callsByLead.set(c.lead_id, entry);
      });

      // Build recovery scoring — higher = better recovery candidate
      const recoverable: RecoverableLead[] = lost
        .map(l => {
          const calls = callsByLead.get(l.id) || { count: 0, outcomes: [] };
          const income = Number(l.monthly_income) || 0;
          const loanAmt = Number(l.loan_amount) || 0;
          const notes = (l.follow_up_notes || "").toLowerCase();

          // Disqualify obvious dead leads
          if (notes.includes("not interested") || notes.includes("dnd") || notes.includes("wrong number")) return null;
          if (l.cibil_score_range === "below-550") return null;
          if (income < 15000) return null;

          // Score
          let score = 0;
          if (income >= 50000) score += 30;
          else if (income >= 25000) score += 20;
          else if (income >= 15000) score += 10;

          if (loanAmt >= 500000) score += 25;
          else if (loanAmt >= 100000) score += 15;
          else score += 5;

          if (calls.count === 0) score += 25; // never called = highest priority
          else if (calls.count === 1) score += 15;
          else if (calls.count <= 3) score += 5;
          else score -= 10;

          if (calls.outcomes.some(o => ["no_answer", "busy", "switched_off"].includes(o)) && !calls.outcomes.includes("connected")) {
            score += 15; // unreachable but never refused
          }

          if (l.cibil_score_range === "750-plus" || l.cibil_score_range === "650-750") score += 15;

          return {
            id: l.id,
            full_name: l.full_name,
            phone: l.phone,
            email: l.email,
            city: l.city,
            loan_amount: loanAmt,
            monthly_income: income,
            cibil_score_range: l.cibil_score_range,
            source: l.source,
            created_at: l.created_at,
            status: l.status,
            call_count: calls.count,
            recovery_score: score,
          } as RecoverableLead;
        })
        .filter((x): x is RecoverableLead => x !== null && x.recovery_score >= 30)
        .sort((a, b) => b.recovery_score - a.recovery_score);

      const potentialValue = recoverable.reduce((sum, l) => sum + l.loan_amount, 0);

      return {
        recoverable,
        total: recoverable.length,
        totalLost: lost.length,
        potentialValue,
      };
    },
    staleTime: 60_000,
  });

  const filtered = (data?.recoverable || []).filter(l => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      l.full_name.toLowerCase().includes(s) ||
      l.phone.includes(s) ||
      l.city.toLowerCase().includes(s)
    );
  });

  const sendRecoveryMessage = async (lead: RecoverableLead, channel: "whatsapp" | "sms") => {
    setSendingId(lead.id + channel);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        toast.error("Session expired");
        return;
      }

      if (channel === "sms") {
        const { data: result, error } = await supabase.functions.invoke("send-sms", {
          body: {
            type: "remarketing",
            phone: lead.phone,
            leadId: lead.id,
            variables: {
              var1: String(lead.loan_amount).replace(/,/g, ""),
              val: String(lead.loan_amount).replace(/,/g, ""),
            },
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (error) throw error;
        if (result?.success) {
          toast.success(`SMS sent to ${lead.full_name}`);
          setRevivedIds(prev => new Set(prev).add(lead.id));
        } else {
          toast.error(result?.error || "Failed to send SMS");
        }
      } else {
        // WhatsApp — get default account
        const { data: accounts } = await supabase
          .from("whatsapp_accounts")
          .select("id")
          .eq("status", "active")
          .limit(1);
        const accountId = accounts?.[0]?.id;
        if (!accountId) {
          toast.error("No active WhatsApp account configured");
          return;
        }
        const message = `Hi ${lead.full_name}, you applied for ₹${lead.loan_amount.toLocaleString("en-IN")} loan with us. We've reviewed your profile and you may be eligible! Would you like to continue your application? Reply YES to proceed.`;
        const { data: result, error } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            account_id: accountId,
            phone_number: lead.phone.replace(/\D/g, "").slice(-10),
            message,
            lead_id: lead.id,
            message_source: "lost_lead_recovery",
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (error) throw error;
        if (result?.success || result?.wamid) {
          toast.success(`WhatsApp sent to ${lead.full_name}`);
          setRevivedIds(prev => new Set(prev).add(lead.id));
        } else {
          toast.error(result?.error || "Failed to send WhatsApp");
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Failed: ${msg}`);
    } finally {
      setSendingId(null);
    }
  };

  const reviveLead = async (lead: RecoverableLead) => {
    setSendingId(lead.id + "revive");
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: "unpaid", follow_up_notes: `Revived from lost on ${new Date().toLocaleDateString("en-IN")}` })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success(`${lead.full_name} moved back to active pipeline`);
      setRevivedIds(prev => new Set(prev).add(lead.id));
      queryClient.invalidateQueries({ queryKey: ["lost-lead-recovery"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Failed: ${msg}`);
    } finally {
      setSendingId(null);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-orange-500/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Recoverable</span>
            </div>
            <p className="text-xl font-bold text-orange-600">{data.total}</p>
            <p className="text-[10px] text-muted-foreground">of {data.totalLost} lost leads</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <IndianRupee className="w-4 h-4" />
              <span className="text-xs">Potential Value</span>
            </div>
            <p className="text-xl font-bold text-green-600">
              ₹{(data.potentialValue / 100000).toFixed(1)}L
            </p>
            <p className="text-[10px] text-muted-foreground">Total loan amount</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs">Actioned Today</span>
            </div>
            <p className="text-xl font-bold">{revivedIds.size}</p>
            <p className="text-[10px] text-muted-foreground">Re-engaged this session</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-xs">Recovery Rate Target</span>
            </div>
            <p className="text-xl font-bold">5-15%</p>
            <p className="text-[10px] text-muted-foreground">Industry benchmark</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Refresh */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">Recovery Pipeline ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone, city…"
                  className="pl-7 h-8 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No recoverable leads in this period. 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Score</TableHead>
                    <TableHead className="text-xs">Lead</TableHead>
                    <TableHead className="text-xs">Loan / Income</TableHead>
                    <TableHead className="text-xs">Calls</TableHead>
                    <TableHead className="text-xs">Lost On</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map(lead => {
                    const isRevived = revivedIds.has(lead.id);
                    return (
                      <TableRow key={lead.id} className={isRevived ? "opacity-60 bg-green-500/5" : ""}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              lead.recovery_score >= 70
                                ? "border-green-500/40 text-green-600"
                                : lead.recovery_score >= 50
                                ? "border-orange-500/40 text-orange-600"
                                : "border-muted-foreground/40"
                            }
                          >
                            {lead.recovery_score}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">{lead.full_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {lead.phone} · {lead.city}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">₹{(lead.loan_amount / 1000).toFixed(0)}K</div>
                          <div className="text-[10px] text-muted-foreground">
                            ₹{(lead.monthly_income / 1000).toFixed(0)}K/mo
                            {lead.cibil_score_range && ` · ${lead.cibil_score_range}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={lead.call_count === 0 ? "destructive" : "secondary"} className="text-[10px]">
                            {lead.call_count} call{lead.call_count !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {format(new Date(lead.created_at), "dd MMM")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled={isRevived || sendingId === lead.id + "whatsapp"}
                              onClick={() => sendRecoveryMessage(lead, "whatsapp")}
                              title="Send WhatsApp recovery message"
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />
                              WA
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled={isRevived || sendingId === lead.id + "sms"}
                              onClick={() => sendRecoveryMessage(lead, "sms")}
                              title="Send SMS recovery message"
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              SMS
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              disabled={isRevived || sendingId === lead.id + "revive"}
                              onClick={() => reviveLead(lead)}
                              title="Move back to active pipeline"
                            >
                              Revive
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filtered.length > 100 && (
                <div className="text-center text-xs text-muted-foreground py-2 border-t">
                  Showing top 100 of {filtered.length}. Refine with search.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LostLeadRecovery;
