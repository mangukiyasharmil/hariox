import { useState, useEffect } from "react";
import { ArrowRightLeft, Loader2, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead } from "@/types/database";

interface StaffMember {
  user_id: string;
  full_name: string;
  role: string;
}

interface LeadTransferDialogProps {
  lead?: Lead | null;
  leadIds?: string[]; // For bulk transfer
  staffList?: { id: string; full_name: string; role: string }[]; // Optional pre-fetched staff
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred: () => void;
}

const LeadTransferDialog = ({ lead, leadIds, staffList: externalStaffList, open, onOpenChange, onTransferred }: LeadTransferDialogProps) => {
  const [internalStaffList, setInternalStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isBulkTransfer = leadIds && leadIds.length > 0;
  const leadsCount = isBulkTransfer ? leadIds.length : 1;

  // Convert external staff list format if provided
  const staffList = externalStaffList 
    ? externalStaffList.map(s => ({ user_id: s.id, full_name: s.full_name, role: s.role }))
    : internalStaffList;

  useEffect(() => {
    if (open) {
      if (!externalStaffList) {
        fetchStaff();
      } else {
        setIsLoading(false);
      }
      setSelectedStaff("");
      setReason("");
    }
  }, [open, externalStaffList]);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (roles) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const staff = roles.map(r => ({
          user_id: r.user_id,
          role: r.role,
          full_name: profiles?.find(p => p.user_id === r.user_id)?.full_name || "Unknown",
        })).filter(s => !lead || s.user_id !== lead.assigned_to);

        setInternalStaffList(staff);
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedStaff) {
      toast.error("Please select a staff member");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newStaff = staffList.find(s => s.user_id === selectedStaff);

      if (isBulkTransfer && leadIds) {
        // Bulk transfer
        for (const leadId of leadIds) {
          // Get current lead data
          const { data: currentLead } = await supabase
            .from("leads")
            .select("assigned_to, full_name, loan_type, loan_amount")
            .eq("id", leadId)
            .single();

          // Update lead
          await supabase
            .from("leads")
            .update({
              assigned_to: selectedStaff,
              transferred_from: currentLead?.assigned_to || null,
              transferred_at: new Date().toISOString(),
              transfer_reason: reason || null,
            })
            .eq("id", leadId);

          // Log activity
          await supabase.from("activity_logs").insert({
            lead_id: leadId,
            user_id: session?.user?.id,
            action: "lead_transferred",
            details: {
              from_user_id: currentLead?.assigned_to,
              to_user_id: selectedStaff,
              reason: reason || "Bulk transfer",
            },
          });
        }

        // Create single notification for bulk transfer
        await supabase.from("staff_notifications").insert({
          user_id: selectedStaff,
          title: `${leadIds.length} Leads Assigned to You`,
          message: `You have been assigned ${leadIds.length} leads via bulk transfer.${reason ? ` Reason: ${reason}` : ""}`,
          type: "lead_assigned",
          link: "/admin/dashboard/telecaller",
          metadata: { lead_ids: leadIds },
        });

        toast.success(`${leadIds.length} leads transferred to ${newStaff?.full_name}`);
      } else if (lead) {
        // Single transfer
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            assigned_to: selectedStaff,
            transferred_from: lead.assigned_to,
            transferred_at: new Date().toISOString(),
            transfer_reason: reason || null,
          })
          .eq("id", lead.id);

        if (updateError) throw updateError;

        await supabase.from("activity_logs").insert({
          lead_id: lead.id,
          user_id: session?.user?.id,
          action: "lead_transferred",
          details: {
            from_user_id: lead.assigned_to,
            to_user_id: selectedStaff,
            reason: reason || "No reason provided",
          },
        });

        await supabase.from("staff_notifications").insert({
          user_id: selectedStaff,
          title: "Lead Assigned to You",
          message: `${lead.full_name} (${lead.loan_type} loan - ₹${lead.loan_amount.toLocaleString()}) has been transferred to you.${reason ? ` Reason: ${reason}` : ""}`,
          type: "lead_assigned",
          link: "/admin/dashboard/telecaller",
          metadata: { lead_id: lead.id },
        });

        toast.success(`Lead transferred to ${newStaff?.full_name}`);
      }

      onTransferred();
      onOpenChange(false);
    } catch (err) {
      console.error("Error transferring lead:", err);
      toast.error("Failed to transfer lead(s)");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!lead && !isBulkTransfer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBulkTransfer ? <Users className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
            {isBulkTransfer ? `Transfer ${leadsCount} Leads` : "Transfer Lead"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lead Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            {isBulkTransfer ? (
              <>
                <p className="font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {leadsCount} leads selected
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  All selected leads will be transferred to the chosen staff member.
                </p>
              </>
            ) : lead && (
              <>
                <p className="font-medium">{lead.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {lead.loan_type} loan • ₹{lead.loan_amount.toLocaleString("en-IN")}
                </p>
                {lead.assigned_to && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Currently assigned to: {staffList.find(s => s.user_id === lead.assigned_to)?.full_name || "Loading..."}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Staff Selection */}
          <div className="space-y-2">
            <Label>Transfer to</Label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading staff..." : "Select staff member"} />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((staff) => (
                  <SelectItem key={staff.user_id} value={staff.user_id}>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{staff.full_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        ({staff.role.replace(/_/g, " ")})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transfer Reason */}
          <div className="space-y-2">
            <Label>Reason for transfer (optional)</Label>
            <Textarea
              placeholder="e.g., Specializes in business loans, location preference, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedStaff || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer {isBulkTransfer ? `${leadsCount} Leads` : "Lead"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadTransferDialog;
