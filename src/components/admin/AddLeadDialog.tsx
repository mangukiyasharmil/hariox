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
    product_category: "personal" as LoanType, // Map to loan_type enum
    order_value: "129",                       // Map to loan_amount numeric
    shopify_order_id: "",                     // Map to application_id text
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
          loan_type: formData.product_category,
          loan_amount: Number(formData.order_value) || 129,
          application_id: formData.shopify_order_id || null, // Shopify Order ID
          employment_type: "salaried", // default dummy
          monthly_income: 0,           // default dummy
          source: formData.source || "manual",
          company_id: currentCompany?.id,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Failed to create customer");
      
      toast.success("Customer created successfully");
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        city: "",
        product_category: "personal",
        order_value: "129",
        shopify_order_id: "",
        status: "unpaid",
        source: "manual",
      });
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Failed to create customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Customer Manually</DialogTitle>
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
              <Label>Product Category</Label>
              <Select value={formData.product_category} onValueChange={(v) => setFormData({ ...formData, product_category: v as LoanType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Hariox Light Blue ($129)</SelectItem>
                  <SelectItem value="business">Pro Bundle ($129)</SelectItem>
                  <SelectItem value="marriage">Custom Branding ($129)</SelectItem>
                  <SelectItem value="home">Starter Pack ($129)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Order Value ($) *</Label>
              <Input 
                required
                type="number"
                value={formData.order_value}
                onChange={(e) => setFormData({ ...formData, order_value: e.target.value })}
                placeholder="$129"
              />
            </div>
            
            <div>
              <Label>Shopify Order ID</Label>
              <Input 
                value={formData.shopify_order_id}
                onChange={(e) => setFormData({ ...formData, shopify_order_id: e.target.value })}
                placeholder="e.g. #1024"
              />
            </div>
            
            <div>
              <Label>Initial Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">New Enquiry</SelectItem>
                  <SelectItem value="paid">Order Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2">
              <Label>Source</Label>
              <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="shopify">Shopify Store</SelectItem>
                  <SelectItem value="marketing">Marketing Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
