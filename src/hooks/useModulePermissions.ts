import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/database";

export interface ModulePermission {
  module_key: string;
  can_view: boolean;
  can_edit: boolean;
}

// Default module access per role template
const ROLE_DEFAULTS: Record<string, ModulePermission[]> = {
  admin: [
    { module_key: "dashboard", can_view: true, can_edit: true },
    { module_key: "inbox", can_view: true, can_edit: true },
    { module_key: "leads", can_view: true, can_edit: true },
    { module_key: "telecaller", can_view: true, can_edit: true },
    { module_key: "payments", can_view: true, can_edit: true },
    { module_key: "verification", can_view: true, can_edit: true },
    { module_key: "login-team", can_view: true, can_edit: true },
    { module_key: "whatsapp", can_view: true, can_edit: true },
    { module_key: "sms", can_view: true, can_edit: true },
    { module_key: "reports", can_view: true, can_edit: true },
    { module_key: "workflows", can_view: true, can_edit: true },
    { module_key: "hr", can_view: true, can_edit: true },
    { module_key: "support", can_view: true, can_edit: true },
    { module_key: "companies", can_view: true, can_edit: true },
    { module_key: "settings", can_view: true, can_edit: true },
  ],
  manager: [
    { module_key: "dashboard", can_view: true, can_edit: false },
    { module_key: "inbox", can_view: true, can_edit: true },
    { module_key: "leads", can_view: true, can_edit: true },
    { module_key: "telecaller", can_view: true, can_edit: true },
    { module_key: "payments", can_view: true, can_edit: true },
    { module_key: "verification", can_view: true, can_edit: true },
    { module_key: "login-team", can_view: true, can_edit: true },
    { module_key: "whatsapp", can_view: true, can_edit: false },
    { module_key: "sms", can_view: true, can_edit: false },
    { module_key: "reports", can_view: true, can_edit: false },
    { module_key: "workflows", can_view: false, can_edit: false },
    { module_key: "hr", can_view: true, can_edit: false },
    { module_key: "support", can_view: true, can_edit: true },
    { module_key: "companies", can_view: false, can_edit: false },
    { module_key: "settings", can_view: false, can_edit: false },
  ],
  telecaller: [
    { module_key: "dashboard", can_view: true, can_edit: false },
    { module_key: "inbox", can_view: true, can_edit: true },
    { module_key: "telecaller", can_view: true, can_edit: true },
    { module_key: "payments", can_view: true, can_edit: true },
    { module_key: "hr", can_view: true, can_edit: false },
    { module_key: "support", can_view: true, can_edit: true },
  ],
  verification: [
    { module_key: "dashboard", can_view: true, can_edit: false },
    { module_key: "verification", can_view: true, can_edit: true },
    { module_key: "hr", can_view: true, can_edit: false },
  ],
  login_team: [
    { module_key: "dashboard", can_view: true, can_edit: false },
    { module_key: "login-team", can_view: true, can_edit: true },
    { module_key: "hr", can_view: true, can_edit: false },
  ],
  ads: [
    { module_key: "dashboard", can_view: true, can_edit: false },
    { module_key: "reports", can_view: true, can_edit: false },
    { module_key: "hr", can_view: true, can_edit: false },
  ],
  finance: [
    { module_key: "dashboard", can_view: true, can_edit: false },
    { module_key: "payments", can_view: true, can_edit: true },
    { module_key: "reports", can_view: true, can_edit: false },
    { module_key: "hr", can_view: true, can_edit: false },
  ],
  gst: [
    { module_key: "dashboard", can_view: true, can_edit: false },
    { module_key: "payments", can_view: true, can_edit: false },
    { module_key: "reports", can_view: true, can_edit: false },
    { module_key: "hr", can_view: true, can_edit: false },
  ],
};

export const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inbox", label: "Inbox" },
  { key: "leads", label: "Leads" },
  { key: "telecaller", label: "Telecaller" },
  { key: "payments", label: "Payments" },
  { key: "verification", label: "Verification" },
  { key: "login-team", label: "Login Dept" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "sms", label: "SMS" },
  { key: "ads", label: "Ads" },
  { key: "blog", label: "Blog" },
  { key: "reports", label: "Reports" },
  { key: "finance", label: "Finance & GST" },
  { key: "workflows", label: "Workflows" },
  { key: "hr", label: "HR" },
  { key: "support", label: "Support" },
  { key: "companies", label: "Companies" },
  { key: "settings", label: "Settings" },
];

export const getDefaultPermissions = (role: string): ModulePermission[] => {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.telecaller;
};

export const useModulePermissions = (userId?: string) => {
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      const { data } = await supabase
        .from("staff_module_permissions")
        .select("module_key, can_view, can_edit")
        .eq("user_id", userId);

      if (data && data.length > 0) {
        setPermissions(data);
      }
      setIsLoading(false);
    };

    fetchPermissions();
  }, [userId]);

  const canView = (moduleKey: string): boolean => {
    const perm = permissions.find(p => p.module_key === moduleKey);
    return perm ? perm.can_view : false;
  };

  const canEdit = (moduleKey: string): boolean => {
    const perm = permissions.find(p => p.module_key === moduleKey);
    return perm ? perm.can_edit : false;
  };

  return { permissions, isLoading, canView, canEdit };
};

export const saveModulePermissions = async (
  userId: string,
  permissions: ModulePermission[]
): Promise<boolean> => {
  // Delete existing then insert new
  await supabase
    .from("staff_module_permissions")
    .delete()
    .eq("user_id", userId);

  if (permissions.length === 0) return true;

  const rows = permissions.map(p => ({
    user_id: userId,
    module_key: p.module_key,
    can_view: p.can_view,
    can_edit: p.can_edit,
  }));

  const { error } = await supabase
    .from("staff_module_permissions")
    .insert(rows);

  return !error;
};
