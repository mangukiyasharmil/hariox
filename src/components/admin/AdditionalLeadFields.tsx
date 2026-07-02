import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead } from "@/types/database";

const indianStates = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"
];

const cibilRanges = [
  { value: "below-550", label: "Below 550" },
  { value: "550-600", label: "550 - 600" },
  { value: "600-650", label: "600 - 650" },
  { value: "650-700", label: "650 - 700" },
  { value: "700-750", label: "700 - 750" },
  { value: "750-plus", label: "750+" },
  { value: "no-score", label: "No Score / New" },
];

interface AdditionalLeadFieldsProps {
  lead: Lead;
  onSaved?: () => void;
}

const AdditionalLeadFields = ({ lead, onSaved }: AdditionalLeadFieldsProps) => {
  const [state, setState] = useState((lead as any).state || "");
  const [currentEmi, setCurrentEmi] = useState(
    (lead as any).current_monthly_emi ? String((lead as any).current_monthly_emi) : ""
  );
  const [emiBounce, setEmiBounce] = useState((lead as any).emi_bounce_last_6_months || false);
  const [cibil, setCibil] = useState((lead as any).cibil_score_range || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setState((lead as any).state || "");
    setCurrentEmi((lead as any).current_monthly_emi ? String((lead as any).current_monthly_emi) : "");
    setEmiBounce((lead as any).emi_bounce_last_6_months || false);
    setCibil((lead as any).cibil_score_range || "");
    setSaved(true);
  }, [lead.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("leads").update({
        state: state || null,
        current_monthly_emi: currentEmi ? Number(currentEmi) : null,
        emi_bounce_last_6_months: emiBounce,
        cibil_score_range: cibil || null,
      }).eq("id", lead.id);

      if (error) throw error;
      setSaved(true);
      toast.success("Lead info updated");
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const markDirty = () => setSaved(false);

  return (
    <div className="bg-muted/50 rounded-xl border border-border p-4 my-4">
      <h4 className="text-sm font-semibold mb-3">Bank Submission Details</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">State</Label>
          <Select value={state} onValueChange={(v) => { setState(v); markDirty(); }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {indianStates.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CIBIL Score</Label>
          <Select value={cibil} onValueChange={(v) => { setCibil(v); markDirty(); }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {cibilRanges.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Current Monthly EMI</Label>
          <Input
            type="number"
            placeholder="e.g., 15000"
            className="h-8 text-xs"
            value={currentEmi}
            onChange={(e) => { setCurrentEmi(e.target.value); markDirty(); }}
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={emiBounce}
              onChange={(e) => { setEmiBounce(e.target.checked); markDirty(); }}
              className="rounded border-border"
            />
            EMI bounce (6 months)
          </label>
        </div>
      </div>
      <Button
        size="sm"
        className="mt-3 w-full"
        onClick={handleSave}
        disabled={saving || saved}
      >
        {saving ? (
          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle className="w-3 h-3 mr-1" /> Saved</>
        ) : (
          <><Save className="w-3 h-3 mr-1" /> Save Changes</>
        )}
      </Button>
    </div>
  );
};

export default AdditionalLeadFields;
