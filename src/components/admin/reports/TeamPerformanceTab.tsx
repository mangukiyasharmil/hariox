import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyFilter } from "@/hooks/useCompanyFilter";
import TeamPerformanceReport from "./TeamPerformanceReport";

interface Props {
  startISO: string;
  endISO: string;
}

const TeamPerformanceTab = ({ startISO, endISO }: Props) => {
  const { companyId, applyCompanyFilter } = useCompanyFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["report-team-perf", startISO, endISO, companyId],
    queryFn: async () => {
      const [staffRolesResult, profilesResult] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("user_id, full_name"),
      ]);

      const staffRoles = staffRolesResult.data || [];
      const profiles = profilesResult.data || [];
      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

      const verifiers = staffRoles.filter(s => s.role === "verification");
      const loginTeam = staffRoles.filter(s => s.role === "login_team");

      // Fetch all in parallel instead of sequential per-user
      const [vResults, ltResults] = await Promise.all([
        Promise.all(verifiers.map(async (v) => {
          const { data: assignedLeads } = await applyCompanyFilter(
            supabase.from("leads").select("status").eq("assigned_to", v.user_id)
          );
          return {
            name: profileMap.get(v.user_id) || "Unknown",
            paid: assignedLeads?.filter(l => ["paid", "verification", "documents_pending", "documents_uploaded"].includes(l.status)).length || 0,
            verified: assignedLeads?.filter(l => ["verified", "processing", "approved", "disbursed"].includes(l.status)).length || 0,
            rejected: assignedLeads?.filter(l => ["rejected", "lost"].includes(l.status)).length || 0,
          };
        })),
        Promise.all(loginTeam.map(async (lt) => {
          const { data: submissions } = await supabase
            .from("bank_submissions").select("status").eq("submitted_by", lt.user_id);
          return {
            name: profileMap.get(lt.user_id) || "Unknown",
            approved: submissions?.filter(s => s.status === "approved").length || 0,
            processing: submissions?.filter(s => ["processing", "submitted"].includes(s.status)).length || 0,
            disbursed: submissions?.filter(s => s.status === "disbursed").length || 0,
          };
        })),
      ]);

      return { verificationPerformance: vResults, loginTeamPerformance: ltResults };
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <TeamPerformanceReport
      verificationPerformance={data.verificationPerformance}
      loginTeamPerformance={data.loginTeamPerformance}
      startDate={new Date(startISO)}
      endDate={new Date(endISO)}
    />
  );
};

export default TeamPerformanceTab;
