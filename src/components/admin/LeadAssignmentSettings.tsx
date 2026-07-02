import { useState, useEffect } from "react";
import { Users, Save, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StaffWeight {
  userId: string;
  name: string;
  percentage: number;
}

const LeadAssignmentSettings = () => {
  const [staffWeights, setStaffWeights] = useState<StaffWeight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingRes, rolesRes, profilesRes] = await Promise.all([
        supabase.from("system_settings").select("value").eq("key", "lead_assignment_weights").single(),
        supabase.from("user_roles").select("user_id").eq("role", "telecaller"),
        supabase.from("profiles").select("user_id, full_name"),
      ]);

      const weights: Record<string, number> = settingRes.data ? JSON.parse(settingRes.data.value) : {};
      const telecallers = rolesRes.data || [];
      const profiles = profilesRes.data || [];
      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

      const list: StaffWeight[] = telecallers.map(tc => ({
        userId: tc.user_id,
        name: profileMap.get(tc.user_id) || "Unknown",
        percentage: weights[tc.user_id] || 0,
      }));

      // Sort: those with weights first
      list.sort((a, b) => b.percentage - a.percentage);
      setStaffWeights(list);
    } catch (err) {
      console.error("Error loading assignment weights:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateWeight = (userId: string, value: number) => {
    setStaffWeights(prev => prev.map(s => s.userId === userId ? { ...s, percentage: Math.max(0, Math.min(100, value)) } : s));
  };

  const totalPercent = staffWeights.reduce((s, w) => s + w.percentage, 0);

  const handleSave = async () => {
    if (totalPercent !== 100 && totalPercent !== 0) {
      toast.error(`Percentages must sum to 100 (currently ${totalPercent}%)`);
      return;
    }

    setIsSaving(true);
    try {
      const weights: Record<string, number> = {};
      staffWeights.forEach(s => {
        if (s.percentage > 0) weights[s.userId] = s.percentage;
      });

      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: "lead_assignment_weights", value: JSON.stringify(weights) }, { onConflict: "key" });

      if (error) throw error;
      toast.success("Lead assignment weights saved!");
    } catch (err) {
      console.error("Error saving weights:", err);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Lead Assignment Weights
        </CardTitle>
        <CardDescription>
          Set percentage distribution for auto-assigning new leads to telecallers. Must total 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {staffWeights.map(staff => (
          <div key={staff.userId} className="flex items-center gap-3">
            <Label className="w-40 truncate text-sm font-medium">{staff.name}</Label>
            <div className="flex items-center gap-1 flex-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={staff.percentage}
                onChange={(e) => updateWeight(staff.userId, parseInt(e.target.value) || 0)}
                className="w-20 h-8 text-sm"
              />
              <Percent className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="w-24 bg-muted rounded-full h-2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${staff.percentage}%` }}
              />
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className={`text-sm font-bold ${totalPercent === 100 ? "text-green-600" : "text-red-600"}`}>
              {totalPercent}%
            </span>
            {totalPercent !== 100 && totalPercent !== 0 && (
              <span className="text-[10px] text-red-500">Must be 100%</span>
            )}
          </div>
          <Button onClick={handleSave} disabled={isSaving || (totalPercent !== 100 && totalPercent !== 0)} size="sm">
            <Save className="w-3.5 h-3.5 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadAssignmentSettings;
