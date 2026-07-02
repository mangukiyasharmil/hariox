import { useState, useEffect } from "react";
import { Clock, Phone, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";

interface FollowUpRemindersProps {
  currentUserId: string | null;
  isAdmin: boolean;
}

interface FollowUpLead {
  id: string;
  full_name: string;
  phone: string;
  loan_type: string;
  loan_amount: number;
  follow_up_date: string;
  follow_up_notes: string | null;
}

const FollowUpReminders = ({ currentUserId, isAdmin }: FollowUpRemindersProps) => {
  const [leads, setLeads] = useState<FollowUpLead[]>([]);
  const { currentCompany } = useCompany();

  useEffect(() => {
    if (!currentUserId) return;
    fetchDueFollowUps();
  }, [currentUserId, currentCompany?.id]);

  const fetchDueFollowUps = async () => {
    let query = supabase
      .from("leads")
      .select("id, full_name, phone, loan_type, loan_amount, follow_up_date, follow_up_notes")
      .eq("is_interested", true)
      .lte("follow_up_date", new Date().toISOString())
      .neq("status", "lost")
      .order("follow_up_date", { ascending: true })
      .limit(5);

    if (!isAdmin && currentUserId) {
      query = query.eq("assigned_to", currentUserId);
    }
    if (currentCompany?.id) {
      query = query.eq("company_id", currentCompany.id);
    }

    const { data } = await query;
    setLeads((data as FollowUpLead[]) || []);
  };

  if (leads.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-red-50 dark:from-amber-950/20 dark:to-red-950/20 rounded-xl border border-amber-200 dark:border-amber-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            Follow-ups Due ({leads.length})
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        {leads.map((lead) => {
          const overdueMins = Math.round((Date.now() - new Date(lead.follow_up_date).getTime()) / 60000);
          const overdueLabel = overdueMins > 60
            ? `${Math.round(overdueMins / 60)}h overdue`
            : `${overdueMins}m overdue`;

          return (
            <div key={lead.id} className="flex items-center justify-between bg-white/60 dark:bg-card/60 rounded-lg px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{lead.full_name}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="capitalize">{lead.loan_type}</span>
                  <span>•</span>
                  <span className="text-red-600 font-medium">{overdueLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`tel:+91${lead.phone}`}
                  className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <Phone className="w-3 h-3 text-primary" />
                </a>
                <a
                  href={`https://wa.me/91${lead.phone}?text=${encodeURIComponent(`Hi ${lead.full_name}, following up on your loan application.`)}`}
                  target="_blank"
                  className="p-1.5 rounded-md bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors"
                >
                  <WhatsAppIcon size="xs" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FollowUpReminders;
