import { useState, useEffect } from "react";
import { FileCheck, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface TeamPerformanceReportProps {
  verificationPerformance: { name: string; paid: number; verified: number; rejected: number }[];
  loginTeamPerformance: { name: string; approved: number; processing: number; disbursed: number }[];
  startDate: Date;
  endDate: Date;
}

interface DateFilteredVerification {
  name: string;
  paidToday: number;
  paidQueue: number;
  verified: number;
  rejected: number;
}

interface DateFilteredLogin {
  name: string;
  approved: number;
  processing: number;
  disbursed: number;
}

const TeamPerformanceReport = ({
  verificationPerformance: allTimeVerification,
  loginTeamPerformance: allTimeLogin,
  startDate,
  endDate,
}: TeamPerformanceReportProps) => {
  const [verificationData, setVerificationData] = useState<DateFilteredVerification[]>([]);
  const [loginData, setLoginData] = useState<DateFilteredLogin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDateFilteredData();
  }, [startDate, endDate]);

  const fetchDateFilteredData = async () => {
    try {
      setIsLoading(true);

      const [staffRolesRes, profilesRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("user_id, full_name"),
      ]);

      const staffRoles = staffRolesRes.data || [];
      const profiles = profilesRes.data || [];
      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

      // Verification team - find leads paid within date range assigned to verification staff
      const verifiers = staffRoles.filter(s => s.role === "verification");
      const verificationResults = await Promise.all(verifiers.map(async (v) => {
        // Get ALL leads assigned to this verifier
        const { data: assignedLeads } = await supabase
          .from("leads")
          .select("id, status")
          .eq("assigned_to", v.user_id);

        if (!assignedLeads || assignedLeads.length === 0) {
          return { name: profileMap.get(v.user_id) || "Unknown", paidToday: 0, paidQueue: 0, verified: 0, rejected: 0 };
        }

        const leadIds = assignedLeads.map(l => l.id);

        // Paid Today: leads paid within the selected date range
        const { data: paidInRange } = await supabase
          .from("payments")
          .select("lead_id")
          .in("lead_id", leadIds.slice(0, 500))
          .in("status", ["completed", "captured"])
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        const paidTodayCount = new Set(paidInRange?.map(p => p.lead_id) || []).size;

        // Paid Queue: all leads in pending verification statuses (total queue)
        const paidQueueCount = assignedLeads.filter(l => 
          ["paid", "verification", "documents_pending", "documents_uploaded"].includes(l.status)
        ).length;

        return {
          name: profileMap.get(v.user_id) || "Unknown",
          paidToday: paidTodayCount,
          paidQueue: paidQueueCount,
          verified: assignedLeads.filter(l => ["verified", "processing", "approved", "disbursed"].includes(l.status)).length,
          rejected: assignedLeads.filter(l => ["rejected", "lost"].includes(l.status)).length,
        };
      }));

      setVerificationData(verificationResults);

      // Login team
      const loginTeam = staffRoles.filter(s => s.role === "login_team");
      const loginResults = await Promise.all(loginTeam.map(async (lt) => {
        const { data: submissions } = await supabase
          .from("bank_submissions")
          .select("status")
          .eq("submitted_by", lt.user_id)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        return {
          name: profileMap.get(lt.user_id) || "Unknown",
          approved: submissions?.filter(s => s.status === "approved").length || 0,
          processing: submissions?.filter(s => ["processing", "submitted"].includes(s.status)).length || 0,
          disbursed: submissions?.filter(s => s.status === "disbursed").length || 0,
        };
      }));

      setLoginData(loginResults);
    } catch (error) {
      console.error("Error fetching team data:", error);
      setVerificationData(allTimeVerification.map(v => ({ 
        name: v.name, paidToday: 0, paidQueue: v.paid, verified: v.verified, rejected: v.rejected 
      })));
      setLoginData(allTimeLogin);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTable = (type: "verification" | "login") => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      );
    }

    if (type === "verification") {
      return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm">Verification Team</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Paid Today</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Paid Queue</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Verified</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Rejected</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Rate</th>
                </tr>
              </thead>
              <tbody>
                {verificationData.map((member) => {
                  const total = member.verified + member.rejected;
                  const successRate = total > 0 ? Math.round((member.verified / total) * 100) : 0;
                  return (
                    <tr key={member.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{member.name}</td>
                      <td className="p-3 text-right text-orange-600 font-bold">{member.paidToday}</td>
                      <td className="p-3 text-right text-blue-600 font-medium">{member.paidQueue}</td>
                      <td className="p-3 text-right text-green-600 font-semibold">{member.verified}</td>
                      <td className="p-3 text-right text-red-600">{member.rejected}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          successRate >= 80 ? "bg-green-100 text-green-800" :
                          successRate >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                        }`}>
                          {successRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {verificationData.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No verification data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-600" />
          <h3 className="font-semibold text-sm">Login Team</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Approved</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Processing</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Disbursed</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {loginData.map((member) => (
                <tr key={member.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{member.name}</td>
                  <td className="p-3 text-right text-green-600 font-semibold">{member.approved}</td>
                  <td className="p-3 text-right text-blue-600">{member.processing}</td>
                  <td className="p-3 text-right text-teal-600 font-semibold">{member.disbursed}</td>
                  <td className="p-3 text-right font-bold">{member.approved + member.processing + member.disbursed}</td>
                </tr>
              ))}
              {loginData.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No login team data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="verification" className="space-y-4">
        <TabsList className="bg-muted grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="verification" className="text-xs">
            <FileCheck className="w-3 h-3 mr-1" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="login" className="text-xs">
            <Building2 className="w-3 h-3 mr-1" />
            Login Team
          </TabsTrigger>
        </TabsList>
        <TabsContent value="verification" className="mt-4">
          {renderTable("verification")}
        </TabsContent>
        <TabsContent value="login" className="mt-4">
          {renderTable("login")}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamPerformanceReport;
