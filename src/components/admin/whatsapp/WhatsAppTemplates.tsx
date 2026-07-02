import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Copy, Save, RefreshCw, CloudDownload, Send, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  account_id: string | null;
  name: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  category?: string;
  meta_status?: string;
  meta_template_id?: string;
  language?: string;
  header_type?: string | null;
  header_url?: string | null;
  stable_header_image_url?: string | null;
}

interface WhatsAppTemplatesProps {
  accountId: string | null;
}

const WhatsAppTemplates = ({ accountId }: WhatsAppTemplatesProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [createMode, setCreateMode] = useState<"local" | "meta">("meta");
  
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [headerFormat, setHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE">("NONE");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [footerText, setFooterText] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("en");
  const [buttons, setButtons] = useState<Array<{ type: string; text: string; url?: string; phone_number?: string }>>([]);

  // Proxy WhatsApp/Meta CDN URLs so the browser can render them reliably
  const mediaSrc = (url: string) => {
    if (!url) return url;
    if (/(whatsapp|fbcdn|facebook)\.(net|com)/i.test(url)) {
      const base = (import.meta as any).env.VITE_SUPABASE_URL;
      return `${base}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `whatsapp-templates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("public-assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("public-assets").getPublicUrl(path);
      setHeaderImageUrl(pub.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Per-template stable header image upload — ensures customers receive the same image as approved.
  const handleStableImageUpload = async (templateId: string, file: File) => {
    if (!file) return;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `whatsapp-templates/${templateId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("public-assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("public-assets").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("whatsapp_templates")
        .update({ stable_header_image_url: pub.publicUrl, header_url: pub.publicUrl, header_type: "IMAGE" })
        .eq("id", templateId);
      if (updErr) throw updErr;
      toast.success("Header image updated — customers will now receive this image");
      fetchTemplates();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  };

  useEffect(() => {
    if (accountId) fetchTemplates();
  }, [accountId]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncFromMeta = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-templates", {
        body: { account_id: accountId }
      });

      if (error) throw error;
      if (data.success) {
        toast.success(`Synced ${data.synced_count} templates from Meta`);
        fetchTemplates();
      } else {
        toast.error(data.error || "Failed to sync templates");
      }
    } catch (error) {
      console.error("Error syncing templates:", error);
      toast.error("Failed to sync templates from Meta");
    } finally {
      setIsSyncing(false);
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "")))];
  };

  const handleSave = async () => {
    if (!name || !content) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (createMode === "meta" && !editingTemplate) {
        // Submit to Meta API
        const { data, error } = await supabase.functions.invoke("create-meta-template", {
          body: {
            account_id: accountId,
            name,
            category,
            language,
            header_text: headerFormat === "TEXT" && headerText ? headerText : undefined,
            header_format: headerFormat === "NONE" ? undefined : headerFormat,
            header_image_url: headerFormat === "IMAGE" ? headerImageUrl : undefined,
            body_text: content,
            footer_text: footerText || undefined,
            buttons: buttons.length > 0 ? buttons : undefined,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        toast.success(`Template "${data.template_name}" submitted to Meta for review`);
      } else {
        // Save locally only
        const variables = extractVariables(content);
        const { data: { session } } = await supabase.auth.getSession();

        if (editingTemplate) {
          const { error } = await supabase
            .from("whatsapp_templates")
            .update({ name, content, variables })
            .eq("id", editingTemplate.id);
          if (error) throw error;
          toast.success("Template updated");
        } else {
          const { error } = await supabase
            .from("whatsapp_templates")
            .insert({
              account_id: accountId,
              name,
              content,
              variables,
              created_by: session?.user.id,
              meta_status: "LOCAL",
            });
          if (error) throw error;
          toast.success("Template saved locally");
        }
      }

      fetchTemplates();
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
      setTemplates(templates.map(t => t.id === id ? { ...t, is_active: isActive } : t));
    } catch (error) {
      console.error("Error toggling template:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setTemplates(templates.filter(t => t.id !== id));
      toast.success("Template deleted");
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setName(template.name);
    setContent(template.content);
    setCreateMode("local");
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setName("");
    setContent("");
    setHeaderText("");
    setHeaderFormat("NONE");
    setHeaderImageUrl("");
    setFooterText("");
    setCategory("UTILITY");
    setLanguage("en");
    setButtons([]);
    setEditingTemplate(null);
    setCreateMode("meta");
  };

  const copyTemplate = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Template copied");
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "APPROVED": return <Badge className="bg-emerald-600 text-white text-[10px]">Approved</Badge>;
      case "PENDING": return <Badge className="bg-amber-500 text-white text-[10px]">Pending Review</Badge>;
      case "REJECTED": return <Badge variant="destructive" className="text-[10px]">Rejected</Badge>;
      case "LOCAL": return <Badge variant="secondary" className="text-[10px]">Local Only</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status || "Unknown"}</Badge>;
    }
  };

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case "MARKETING": return <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600">Marketing</Badge>;
      case "UTILITY": return <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">Utility</Badge>;
      case "AUTHENTICATION": return <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">Authentication</Badge>;
      default: return null;
    }
  };

  if (!accountId) {
    return <div className="text-center py-8 text-muted-foreground">Select a WhatsApp account to manage templates</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-semibold">Message Templates</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncFromMeta} disabled={isSyncing}>
            {isSyncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CloudDownload className="w-4 h-4 mr-2" />}
            Sync from Meta
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!editingTemplate && (
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <Button
                      variant={createMode === "meta" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCreateMode("meta")}
                    >
                      <Send className="w-3 h-3 mr-1" /> Submit to Meta
                    </Button>
                    <Button
                      variant={createMode === "local" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCreateMode("local")}
                    >
                      <Save className="w-3 h-3 mr-1" /> Save Locally
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    placeholder="e.g., welcome_message"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {createMode === "meta" && !editingTemplate && (
                    <p className="text-xs text-muted-foreground">Lowercase with underscores only (auto-formatted)</p>
                  )}
                </div>

                {createMode === "meta" && !editingTemplate && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UTILITY">Utility</SelectItem>
                            <SelectItem value="MARKETING">Marketing</SelectItem>
                            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="en_US">English (US)</SelectItem>
                            <SelectItem value="hi">Hindi</SelectItem>
                            <SelectItem value="ta">Tamil</SelectItem>
                            <SelectItem value="te">Telugu</SelectItem>
                            <SelectItem value="kn">Kannada</SelectItem>
                            <SelectItem value="mr">Marathi</SelectItem>
                            <SelectItem value="gu">Gujarati</SelectItem>
                            <SelectItem value="bn">Bengali</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Header</Label>
                      <Select value={headerFormat} onValueChange={(v) => setHeaderFormat(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="TEXT">Text</SelectItem>
                          <SelectItem value="IMAGE">Image</SelectItem>
                        </SelectContent>
                      </Select>
                      {headerFormat === "TEXT" && (
                        <Input
                          placeholder="e.g., Welcome to Hariox!"
                          value={headerText}
                          onChange={(e) => setHeaderText(e.target.value)}
                        />
                      )}
                      {headerFormat === "IMAGE" && (
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="image/jpeg,image/png"
                            disabled={isUploadingImage}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageUpload(f);
                            }}
                          />
                          {isUploadingImage && <p className="text-xs text-muted-foreground">Uploading…</p>}
                          {headerImageUrl && (
                            <img src={headerImageUrl} alt="Header preview" className="max-h-32 rounded-md border object-cover" />
                          )}
                          <p className="text-xs text-muted-foreground">JPG/PNG, recommended &lt; 5MB. The public URL is sent to Meta.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}



                <div className="space-y-2">
                  <Label>Body Text *</Label>
                  <Textarea
                    placeholder="Hello {{1}}, your loan application for ₹{{2}} has been received. We will process it within 24 hours."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    {createMode === "meta" 
                      ? "Use {{1}}, {{2}}, etc. for dynamic variables (Meta format)" 
                      : "Use {{name}}, {{amount}}, etc. for dynamic content"}
                  </p>
                </div>

                {createMode === "meta" && !editingTemplate && (
                  <>
                    <div className="space-y-2">
                      <Label>Footer Text (optional)</Label>
                      <Input
                        placeholder="e.g., Reply STOP to unsubscribe"
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Buttons (optional, max 3)</Label>
                        {buttons.length < 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setButtons([...buttons, { type: "QUICK_REPLY", text: "" }])}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Button
                          </Button>
                        )}
                      </div>
                      {buttons.map((btn, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Select
                                value={btn.type}
                                onValueChange={(val) => {
                                  const updated = [...buttons];
                                  updated[idx] = { type: val, text: btn.text };
                                  setButtons(updated);
                                }}
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                                  <SelectItem value="URL">URL</SelectItem>
                                  <SelectItem value="PHONE_NUMBER">Call</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                            <Input
                              placeholder="Button text"
                              value={btn.text}
                              onChange={(e) => {
                                const updated = [...buttons];
                                updated[idx] = { ...updated[idx], text: e.target.value };
                                setButtons(updated);
                              }}
                            />
                            {btn.type === "URL" && (
                              <Input
                                placeholder="https://example.com/page/{{1}}"
                                value={btn.url || ""}
                                onChange={(e) => {
                                  const updated = [...buttons];
                                  updated[idx] = { ...updated[idx], url: e.target.value };
                                  setButtons(updated);
                                }}
                              />
                            )}
                            {btn.type === "PHONE_NUMBER" && (
                              <Input
                                placeholder="+919876543210"
                                value={btn.phone_number || ""}
                                onChange={(e) => {
                                  const updated = [...buttons];
                                  updated[idx] = { ...updated[idx], phone_number: e.target.value };
                                  setButtons(updated);
                                }}
                              />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                {content && (
                  <div className="flex flex-wrap gap-1">
                    {extractVariables(content).map(v => (
                      <Badge key={v} variant="secondary">{`{{${v}}}`}</Badge>
                    ))}
                  </div>
                )}

                {createMode === "meta" && !editingTemplate && (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      ⚠️ Templates submitted to Meta require approval (usually takes 1-24 hours). 
                      Only approved templates can be used to send messages outside the 24-hour window.
                    </p>
                  </div>
                )}

                <Button onClick={handleSave} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : createMode === "meta" && !editingTemplate ? (
                    <Send className="w-4 h-4 mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {editingTemplate 
                    ? "Update Template" 
                    : createMode === "meta" 
                      ? "Submit to Meta for Review" 
                      : "Save Locally"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isSyncing && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">Fetching templates from Meta Business API...</span>
        </div>
      )}

      <div className="grid gap-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="font-medium">{template.name}</h4>
                    {getStatusBadge(template.meta_status)}
                    {getCategoryBadge(template.category)}
                    {template.header_type && template.header_type !== "TEXT" && (
                      <Badge variant="outline" className="text-[10px]">{template.header_type}</Badge>
                    )}
                    {template.language && template.language !== "en" && (
                      <Badge variant="outline" className="text-[10px]">
                        <Globe className="w-3 h-3 mr-1" />{template.language}
                      </Badge>
                    )}
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={(checked) => handleToggle(template.id, checked)}
                    />
                  </div>
                  {(template.stable_header_image_url || template.header_url) && template.header_type === "IMAGE" && (
                    <img
                      src={mediaSrc(template.stable_header_image_url || template.header_url || "")}
                      alt={`${template.name} header`}
                      className="mb-2 max-h-32 rounded-md border object-cover"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  {template.header_type === "IMAGE" && (
                    <div className="mb-2">
                      <label className="inline-flex items-center gap-1 cursor-pointer text-xs text-primary underline">
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleStableImageUpload(template.id, f);
                            e.target.value = "";
                          }}
                        />
                        {template.stable_header_image_url ? "Replace stable header image" : "Upload stable header image (sent to customers)"}
                      </label>
                    </div>
                  )}
                  {template.header_url && template.header_type === "VIDEO" && (
                    <video
                      src={mediaSrc(template.header_url)}
                      controls
                      className="mb-2 max-h-32 rounded-md border"
                    />
                  )}
                  {template.header_url && template.header_type === "DOCUMENT" && (
                    <a
                      href={mediaSrc(template.header_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 inline-block text-xs text-primary underline"
                    >
                      View attached document
                    </a>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {template.content}
                  </p>
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.variables.map(v => {
                        const displayVar = v.match(/^\{\{.*\}\}$/) ? v : `{{${v}}}`;
                        return <Badge key={v} variant="outline" className="text-xs">{displayVar}</Badge>;
                      })}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyTemplate(template.content)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No templates yet.</p>
            <p className="text-sm mt-1">Click "Sync from Meta" to import approved templates or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
