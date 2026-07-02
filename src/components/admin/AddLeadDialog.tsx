import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LoanType, EmploymentType, LeadStatus } from "@/types/database";

interface AddLeadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddLeadDialog = ({ isOpen, onClose, onSuccess }: AddLeadDialogProps) => {
  const { currentCompany } = useCompany();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    loan_type: "personal" as LoanType,
    loan_amount: "",
    employment_type: "salaried" as EmploymentType,
    monthly_income: "",
    status: "unpaid" as LeadStatus,
    source: "manual",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Use edge function to bypass RLS restrictions
      const { data, error } = await supabase.functions.invoke("upsert-lead", {
        body: {
          phone: formData.phone,
          full_name: formData.full_name,
          email: formData.email,
          city: formData.city || "N/A",
          loan_type: formData.loan_type,
          loan_amount: Number(formData.loan_amount) || 1,
          employment_type: formData.employment_type,
          monthly_income: Number(formData.monthly_income) || 1,
          source: formData.source || "manual",
          company_id: currentCompany?.id,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Failed to create lead");
      
      toast.success("Lead created successfully");
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        city: "",
        loan_type: "personal",
        loan_amount: "",
        employment_type: "salaried",
        monthly_income: "",
        status: "unpaid",
        source: "manual",
      });
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error("Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Lead Manually</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Full Name *</Label>
              <Input 
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            
            <div>
              <Label>Phone *</Label>
              <Input 
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="10-digit mobile"
                maxLength={10}
              />
            </div>
            
            <div>
              <Label>Email *</Label>
              <Input 
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            
            <div>
              <Label>City *</Label>
              <Input 
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="City name"
              />
            </div>
            
            <div>
              <Label>Loan Type</Label>
              <Select value={formData.loan_type} onValueChange={(v) => setFormData({ ...formData, loan_type: v as LoanType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="marriage">Marriage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Loan Amount *</Label>
              <Input 
                required
                type="number"
                value={formData.loan_amount}
                onChange={(e) => setFormData({ ...formData, loan_amount: e.target.value })}
                placeholder="₹0"
              />
            </div>
            
            <div>
              <Label>Monthly Income *</Label>
              <Input 
                required
                type="number"
                value={formData.monthly_income}
                onChange={(e) => setFormData({ ...formData, monthly_income: e.target.value })}
                placeholder="₹0"
              />
            </div>
            
            <div>
              <Label>Employment</Label>
              <Select value={formData.employment_type} onValueChange={(v) => setFormData({ ...formData, employment_type: v as EmploymentType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="self_employed">Self Employed</SelectItem>
                  <SelectItem value="business_owner">Business Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Initial Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="verification">Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Source</Label>
              <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
