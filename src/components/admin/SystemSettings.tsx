import { useState, useEffect, lazy, Suspense } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import LeadAssignmentSettings from "./LeadAssignmentSettings";
import { Save, RefreshCw, Facebook, Phone, Mail, CreditCard, Building, Hash, MessageSquare, Send, BarChart3, ExternalLink, Settings, Smartphone, Globe, Youtube, Linkedin, Instagram, FileText as BlogIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SystemSettings as SystemSettingsType } from "@/types/database";

const BlogManager = lazy(() => import("./BlogManager"));

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface PaymentGatewayConfig {
  company_id: string;
  gateway: "razorpay" | "phonepe" | "paytm";
  enabled_for_website: boolean;
  enabled_for_telecaller: boolean;
  enabled_for_marketing: boolean;
}

const SystemSettings = () => {
  const { currentCompany } = useCompany();
  const [settings, setSettings] = useState<SystemSettingsType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [companyMetaPixelId, setCompanyMetaPixelId] = useState("");
  const [companyGoogleAnalyticsId, setCompanyGoogleAnalyticsId] = useState("");
  
  // Payment gateway config per company
  const [paymentConfigs, setPaymentConfigs] = useState<Record<string, PaymentGatewayConfig[]>>({});
  
  // Master settings
  const [masterSettings, setMasterSettings] = useState({
    mobile_number: "",
    whatsapp_number: "",
    email: "",
    gst_sequence_prefix: "FC",
    sms_sender_id: "FUNCER",
    sms_enabled: true,
    sms_otp_template: "Hello, Hariox Services OTP for your mobile number registration is {#var#} Kindly do not share it with anyone. Thanks, HARIOX CORPORATE SERVICES",
    social_facebook: "",
    social_instagram: "",
    social_youtube: "",
    social_linkedin: "",
    social_google: "",
  });

  useEffect(() => {
    fetchSettings();
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("id, name, slug").eq("is_active", true).order("name");
    if (data) {
      setCompanies(data);
      
      // Load payment configs from system_settings
      const { data: allSettings } = await supabase.from("system_settings").select("key, value").like("key", "pg_%");
      const savedConfigs: Record<string, string> = {};
      allSettings?.forEach(s => { savedConfigs[s.key] = s.value; });
      
      const configs: Record<string, PaymentGatewayConfig[]> = {};
      data.forEach(company => {
        const getVal = (gw: string, field: string) => {
          const key = `pg_${gw}_${field}_${company.id}`;
          if (savedConfigs[key] !== undefined) return savedConfigs[key] === "true";
          // Defaults based on company slug
          if (field === "enabled_for_website") {
            if (gw === "razorpay") return company.slug === "hariox";
            if (gw === "phonepe") return company.slug === "finance";
            if (gw === "paytm") return company.slug === "capital";
          }
          return false;
        };
        configs[company.id] = [
          { company_id: company.id, gateway: "razorpay", enabled_for_website: getVal("razorpay", "enabled_for_website"), enabled_for_telecaller: getVal("razorpay", "enabled_for_telecaller"), enabled_for_marketing: getVal("razorpay", "enabled_for_marketing") },
          { company_id: company.id, gateway: "phonepe", enabled_for_website: getVal("phonepe", "enabled_for_website"), enabled_for_telecaller: getVal("phonepe", "enabled_for_telecaller"), enabled_for_marketing: getVal("phonepe", "enabled_for_marketing") },
          { company_id: company.id, gateway: "paytm", enabled_for_website: getVal("paytm", "enabled_for_website"), enabled_for_telecaller: getVal("paytm", "enabled_for_telecaller"), enabled_for_marketing: getVal("paytm", "enabled_for_marketing") },
        ];
      });
      setPaymentConfigs(configs);
    }
  };

  // Load company-specific pixel/GA IDs when company changes
  useEffect(() => {
    if (currentCompany) {
      setCompanyMetaPixelId(currentCompany.meta_pixel_id || "");
      setCompanyGoogleAnalyticsId(currentCompany.google_analytics_id || "");
    }
  }, [currentCompany]);

  const saveCompanyAnalytics = async (field: "meta_pixel_id" | "google_analytics_id", value: string) => {
    if (!currentCompany?.id) return;
    try {
      const { error } = await supabase
        .from("companies")
        .update({ [field]: value || null })
        .eq("id", currentCompany.id);
      if (error) throw error;
      toast.success("Saved successfully");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save");
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("*")
        .order("key");
      
      if (data) {
        setSettings(data);
        const values: Record<string, string> = {};
        data.forEach(s => { 
          values[s.key] = s.value;
          // meta_pixel_id and google_analytics_id now come from companies table
          if (s.key === "mobile_number") setMasterSettings(prev => ({ ...prev, mobile_number: s.value }));
          if (s.key === "whatsapp_number") setMasterSettings(prev => ({ ...prev, whatsapp_number: s.value }));
          if (s.key === "email") setMasterSettings(prev => ({ ...prev, email: s.value }));
          if (s.key === "gst_sequence_prefix") setMasterSettings(prev => ({ ...prev, gst_sequence_prefix: s.value }));
          if (s.key === "sms_sender_id") setMasterSettings(prev => ({ ...prev, sms_sender_id: s.value }));
          if (s.key === "sms_enabled") setMasterSettings(prev => ({ ...prev, sms_enabled: s.value === "true" }));
          if (s.key === "sms_otp_template") setMasterSettings(prev => ({ ...prev, sms_otp_template: s.value }));
          if (s.key === "social_facebook") setMasterSettings(prev => ({ ...prev, social_facebook: s.value }));
          if (s.key === "social_instagram") setMasterSettings(prev => ({ ...prev, social_instagram: s.value }));
          if (s.key === "social_youtube") setMasterSettings(prev => ({ ...prev, social_youtube: s.value }));
          if (s.key === "social_linkedin") setMasterSettings(prev => ({ ...prev, social_linkedin: s.value }));
          if (s.key === "social_google") setMasterSettings(prev => ({ ...prev, social_google: s.value }));
        });
        setEditedValues(values);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast.error("Not authenticated. Please log in again.");
        setIsSaving(false);
        return;
      }
      
      let savedCount = 0;
      for (const setting of settings) {
        if (editedValues[setting.key] !== setting.value) {
          const { error } = await supabase
            .from("system_settings")
            .update({
              value: editedValues[setting.key],
              updated_by: session.user.id,
            })
            .eq("key", setting.key);
          if (error) {
            console.error(`Error saving ${setting.key}:`, error);
            toast.error(`Failed to save ${setting.key}: ${error.message}`);
          } else {
            savedCount++;
          }
        }
      }
      
      fetchSettings();
      if (savedCount > 0) {
        toast.success(`${savedCount} setting(s) saved successfully!`);
      } else {
        toast.info("No changes to save");
      }
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error(`Failed to save settings: ${error?.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveMasterSetting = async (key: string, value: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast.error("Not authenticated. Please log in again.");
        return;
      }
      
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("system_settings").update({ value, updated_by: session.user.id }).eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert({ key, value, updated_by: session.user.id });
        if (error) throw error;
      }
      
      toast.success("Setting saved!");
      fetchSettings();
    } catch (error: any) {
      console.error("Error saving setting:", key, error);
      toast.error(`Failed to save: ${error?.message || "Unknown error"}`);
    }
  };

  const settingsConfig: Record<string, { label: string; description: string; type: string; suffix?: string }> = {
    consulting_fee: {
      label: "Consulting Fee",
      description: "Base consulting fee charged to customers (before GST)",
      type: "number",
      suffix: "₹",
    },
    gst_percentage: {
      label: "GST Percentage",
      description: "Goods and Services Tax percentage applied to consulting fee",
      type: "number",
      suffix: "%",
    },
    min_interest_rate: {
      label: "Minimum Interest Rate",
      description: "Starting interest rate shown in EMI calculator",
      type: "number",
      suffix: "%",
    },
    min_tenure_months: {
      label: "Minimum Tenure",
      description: "Minimum loan tenure in months for EMI calculator",
      type: "number",
      suffix: "months",
    },
  };

  const updatePaymentConfig = async (companyId: string, gateway: "razorpay" | "phonepe" | "paytm", field: keyof PaymentGatewayConfig, value: boolean) => {
    setPaymentConfigs(prev => {
      const configs = [...(prev[companyId] || [])];
      const idx = configs.findIndex(c => c.gateway === gateway);
      if (idx >= 0) {
        configs[idx] = { ...configs[idx], [field]: value };
      }
      return { ...prev, [companyId]: configs };
    });
    
    // Persist to system_settings
    const settingKey = `pg_${gateway}_${field}_${companyId}`;
    await saveMasterSetting(settingKey, String(value));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const consultingFee = Number(editedValues.consulting_fee || 500);
  const gstPercentage = Number(editedValues.gst_percentage || 18);
  const gstAmount = Math.round(consultingFee * gstPercentage / 100);
  const totalAmount = consultingFee + gstAmount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">System Settings</h2>
          <p className="text-muted-foreground">Configure system-wide settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-flex">
          <TabsTrigger value="general" className="gap-2">
            <Building className="w-4 h-4 hidden sm:block" />
            General
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="w-4 h-4 hidden sm:block" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="w-4 h-4 hidden sm:block" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-2">
            <Hash className="w-4 h-4 hidden sm:block" />
            Fees
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Globe className="w-4 h-4 hidden sm:block" />
            Social
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4 hidden sm:block" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="blog" className="gap-2">
            <BlogIcon className="w-4 h-4 hidden sm:block" />
            Blog
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-6 mt-6">
          {/* Lead Assignment Weights */}
          <LeadAssignmentSettings />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Global contact details used across all websites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Mobile Number
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., 9876543210"
                      value={masterSettings.mobile_number}
                      onChange={(e) => setMasterSettings(prev => ({ ...prev, mobile_number: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => saveMasterSetting("mobile_number", masterSettings.mobile_number)}>
                      Save
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-600" />
                    WhatsApp Number
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., 9876543210"
                      value={masterSettings.whatsapp_number}
                      onChange={(e) => setMasterSettings(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => saveMasterSetting("whatsapp_number", masterSettings.whatsapp_number)}>
                      Save
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="e.g., support@company.com"
                      value={masterSettings.email}
                      onChange={(e) => setMasterSettings(prev => ({ ...prev, email: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => saveMasterSetting("email", masterSettings.email)}>
                      Save
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    GST Invoice Prefix
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., FC"
                      value={masterSettings.gst_sequence_prefix}
                      onChange={(e) => setMasterSettings(prev => ({ ...prev, gst_sequence_prefix: e.target.value }))}
                      className="w-32"
                    />
                    <Button size="sm" variant="outline" onClick={() => saveMasterSetting("gst_sequence_prefix", masterSettings.gst_sequence_prefix)}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Gateways Tab */}
        <TabsContent value="payment" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Payment Gateway Configuration
              </CardTitle>
              <CardDescription>
                Configure which payment gateway is used for each company and source
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {companies.map(company => (
                <div key={company.id} className="border rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold">{company.name}</h4>
                    <Badge variant="outline" className="text-xs">{company.slug}</Badge>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Gateway</th>
                          <th className="text-center py-2 font-medium">Website</th>
                          <th className="text-center py-2 font-medium">Telecaller</th>
                          <th className="text-center py-2 font-medium">Marketing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Razorpay */}
                        <tr className="border-b">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-700 font-bold text-xs">RZ</span>
                              </div>
                              <span>Razorpay</span>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "razorpay")?.enabled_for_website || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "razorpay", "enabled_for_website", v)}
                            />
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "razorpay")?.enabled_for_telecaller || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "razorpay", "enabled_for_telecaller", v)}
                            />
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "razorpay")?.enabled_for_marketing || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "razorpay", "enabled_for_marketing", v)}
                            />
                          </td>
                        </tr>
                        
                        {/* PhonePe */}
                        <tr className="border-b">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                <span className="text-purple-700 font-bold text-xs">PP</span>
                              </div>
                              <span>PhonePe</span>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "phonepe")?.enabled_for_website || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "phonepe", "enabled_for_website", v)}
                            />
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "phonepe")?.enabled_for_telecaller || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "phonepe", "enabled_for_telecaller", v)}
                            />
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "phonepe")?.enabled_for_marketing || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "phonepe", "enabled_for_marketing", v)}
                            />
                          </td>
                        </tr>
                        
                        {/* Paytm */}
                        <tr>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                                <span className="text-sky-700 font-bold text-xs">PT</span>
                              </div>
                              <span>Paytm</span>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "paytm")?.enabled_for_website || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "paytm", "enabled_for_website", v)}
                            />
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "paytm")?.enabled_for_telecaller || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "paytm", "enabled_for_telecaller", v)}
                            />
                          </td>
                          <td className="text-center py-3">
                            <Switch 
                              checked={paymentConfigs[company.id]?.find(c => c.gateway === "paytm")?.enabled_for_marketing || false}
                              onCheckedChange={(v) => updatePaymentConfig(company.id, "paytm", "enabled_for_marketing", v)}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Settings Tab */}
        <TabsContent value="sms" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                SMS Configuration
              </CardTitle>
              <CardDescription>
                Configure SMS gateway and OTP template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Send className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-medium">SMS Gateway</p>
                    <p className="text-sm text-muted-foreground">Enable/disable all SMS notifications</p>
                  </div>
                </div>
                <Switch
                  checked={masterSettings.sms_enabled}
                  onCheckedChange={(checked) => {
                    setMasterSettings(prev => ({ ...prev, sms_enabled: checked }));
                    saveMasterSetting("sms_enabled", String(checked));
                  }}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Sender ID</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., FUNCER"
                      value={masterSettings.sms_sender_id}
                      onChange={(e) => setMasterSettings(prev => ({ ...prev, sms_sender_id: e.target.value.toUpperCase() }))}
                      maxLength={6}
                      className="uppercase"
                    />
                    <Button size="sm" variant="outline" onClick={() => saveMasterSetting("sms_sender_id", masterSettings.sms_sender_id)}>
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">6-character sender ID registered with your SMS provider</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">OTP Template</h4>
                <p className="text-xs text-muted-foreground">
                  Use {"{#var#}"} placeholder for OTP value (DLT compliant)
                </p>

                <div className="space-y-2">
                  <Label>OTP SMS Template</Label>
                  <Textarea
                    placeholder="OTP SMS sent for phone verification"
                    value={masterSettings.sms_otp_template}
                    onChange={(e) => setMasterSettings(prev => ({ ...prev, sms_otp_template: e.target.value }))}
                    rows={3}
                  />
                  <Button size="sm" variant="outline" onClick={() => saveMasterSetting("sms_otp_template", masterSettings.sms_otp_template)}>
                    Save Template
                  </Button>
                </div>
              </div>

              {masterSettings.sms_enabled && masterSettings.sms_sender_id && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    SMS Gateway is active
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Sender ID: {masterSettings.sms_sender_id} • Provider: GreenSMS
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fees Tab */}
        <TabsContent value="fees" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-primary" />
                Fee Configuration
              </CardTitle>
              <CardDescription>
                Configure consulting fees and GST settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.map((setting) => {
                const config = settingsConfig[setting.key];
                if (!config) return null;

                return (
                  <div key={setting.key} className="space-y-2">
                    <Label htmlFor={setting.key} className="text-base">
                      {config.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                    <div className="flex items-center gap-2 max-w-xs">
                      <Input
                        id={setting.key}
                        type={config.type}
                        value={editedValues[setting.key] || ""}
                        onChange={(e) => setEditedValues({ ...editedValues, [setting.key]: e.target.value })}
                      />
                      {config.suffix && (
                        <span className="text-muted-foreground">{config.suffix}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Fee Preview */}
              <div className="pt-6 border-t border-border">
                <h4 className="font-medium mb-4">Fee Preview</h4>
                <div className="bg-muted/50 rounded-xl p-4 max-w-xs">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Base Fee</span>
                    <span>₹{consultingFee}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">GST ({gstPercentage}%)</span>
                    <span>₹{gstAmount}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border font-semibold">
                    <span>Total</span>
                    <span className="text-primary">₹{totalAmount}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Social Media Links
              </CardTitle>
              <CardDescription>
                Configure social media profile links displayed on all websites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { key: "social_facebook", label: "Facebook", icon: Facebook, placeholder: "https://www.facebook.com/yourpage", color: "text-[#1877F2]" },
                { key: "social_instagram", label: "Instagram", icon: Instagram, placeholder: "https://www.instagram.com/yourprofile", color: "text-[#E4405F]" },
                { key: "social_youtube", label: "YouTube", icon: Youtube, placeholder: "https://www.youtube.com/@yourchannel", color: "text-[#FF0000]" },
                { key: "social_linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://www.linkedin.com/company/yourcompany", color: "text-[#0A66C2]" },
                { key: "social_google", label: "Google Business", icon: Globe, placeholder: "https://g.page/yourbusiness", color: "text-[#4285F4]" },
              ].map(({ key, label, icon: Icon, placeholder, color }) => (
                <div key={key} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    {label}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={placeholder}
                      value={(masterSettings as any)[key] || ""}
                      onChange={(e) => setMasterSettings(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => saveMasterSetting(key, (masterSettings as any)[key] || "")}>
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Google Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#F9AB00]" />
                  Google Analytics
                </CardTitle>
                <CardDescription>
                  Track website traffic and user behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="google_analytics_id">GA4 Measurement ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="google_analytics_id"
                      placeholder="e.g., G-XXXXXXXXXX"
                      value={companyGoogleAnalyticsId}
                      onChange={(e) => setCompanyGoogleAnalyticsId(e.target.value)}
                    />
                    <Button 
                      onClick={async () => {
                        setIsSaving(true);
                        await saveCompanyAnalytics("google_analytics_id", companyGoogleAnalyticsId);
                        setIsSaving(false);
                      }} 
                      disabled={isSaving} 
                      variant="outline"
                      size="icon"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Find in GA4 → Admin → Data Streams
                  </p>
                </div>
                
                {companyGoogleAnalyticsId && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Active: {companyGoogleAnalyticsId}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meta Pixel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Facebook className="w-5 h-5 text-[#1877F2]" />
                  Meta Pixel
                </CardTitle>
                <CardDescription>
                  Track conversions for Facebook/Instagram ads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meta_pixel_id">Pixel ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="meta_pixel_id"
                      placeholder="e.g., 1234567890123456"
                      value={companyMetaPixelId}
                      onChange={(e) => setCompanyMetaPixelId(e.target.value)}
                    />
                    <Button 
                      onClick={async () => {
                        setIsSaving(true);
                        await saveCompanyAnalytics("meta_pixel_id", companyMetaPixelId);
                        setIsSaving(false);
                      }} 
                      disabled={isSaving} 
                      variant="outline"
                      size="icon"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Find in Meta Events Manager
                  </p>
                </div>

                {companyMetaPixelId && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Active: {companyMetaPixelId}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Blog Manager Tab */}
        <TabsContent value="blog" className="space-y-6 mt-6">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>}>
            <BlogManager />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemSettings;
