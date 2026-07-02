import { useState, useEffect, forwardRef } from "react";
import { Plus, Edit2, Trash2, Building2, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  website_url: string | null;
  meta_pixel_id: string | null;
  is_active: boolean;
}

const CompanyManagement = forwardRef<HTMLDivElement>((_, ref) => {
  const { refetchCompanies } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logo_url: "",
    primary_color: "#1e3a5f",
    secondary_color: "#f59e0b",
    phone: "",
    email: "",
    whatsapp_number: "",
    address: "",
    website_url: "",
    meta_pixel_id: "",
    is_active: true,
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies((data || []) as Company[]);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: editingCompany ? formData.slug : generateSlug(name),
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast.error("Name and slug are required");
      return;
    }

    try {
      if (editingCompany) {
        const { error } = await supabase
          .from("companies")
          .update({
            name: formData.name,
            slug: formData.slug,
            logo_url: formData.logo_url || null,
            primary_color: formData.primary_color,
            secondary_color: formData.secondary_color,
            phone: formData.phone || null,
            email: formData.email || null,
            whatsapp_number: formData.whatsapp_number || null,
            address: formData.address || null,
            website_url: formData.website_url || null,
            meta_pixel_id: formData.meta_pixel_id || null,
            is_active: formData.is_active,
          })
          .eq("id", editingCompany.id);

        if (error) throw error;
        toast.success("Company updated successfully");
      } else {
        const { error } = await supabase.from("companies").insert({
          name: formData.name,
          slug: formData.slug,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          phone: formData.phone || null,
          email: formData.email || null,
          whatsapp_number: formData.whatsapp_number || null,
          address: formData.address || null,
          website_url: formData.website_url || null,
          meta_pixel_id: formData.meta_pixel_id || null,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success("Company created successfully");
      }

      fetchCompanies();
      refetchCompanies();
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast.error(error.message || "Failed to save company");
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      slug: company.slug,
      logo_url: company.logo_url || "",
      primary_color: company.primary_color || "#1e3a5f",
      secondary_color: company.secondary_color || "#f59e0b",
      phone: company.phone || "",
      email: company.email || "",
      whatsapp_number: company.whatsapp_number || "",
      address: company.address || "",
      website_url: company.website_url || "",
      meta_pixel_id: company.meta_pixel_id || "",
      is_active: company.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company? This cannot be undone.")) return;

    try {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
      toast.success("Company deleted");
      fetchCompanies();
      refetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error("Failed to delete company");
    }
  };

  const resetForm = () => {
    setEditingCompany(null);
    setFormData({
      name: "",
      slug: "",
      logo_url: "",
      primary_color: "#1e3a5f",
      secondary_color: "#f59e0b",
      phone: "",
      email: "",
      whatsapp_number: "",
      address: "",
      website_url: "",
      meta_pixel_id: "",
      is_active: true,
    });
  };

  if (isLoading) {
    return <div className="p-6">Loading companies...</div>;
  }

  return (
    <div ref={ref} className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Company Management</h1>
          <p className="text-muted-foreground">Manage multiple companies from one dashboard</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCompany ? "Edit Company" : "Add New Company"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    placeholder="My Finance Company"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL) *</Label>
                  <Input
                    placeholder="my-finance-company"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  placeholder="https://example.com/logo.png"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="+91 1234567890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="contact@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WhatsApp Number</Label>
                  <Input
                    placeholder="911234567890"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Without + symbol</p>
                </div>
                <div className="space-y-2">
                  <Label>Website URL</Label>
                  <Input
                    placeholder="https://company.com"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  placeholder="Full business address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Meta Pixel ID</Label>
                <Input
                  placeholder="123456789012345"
                  value={formData.meta_pixel_id}
                  onChange={(e) => setFormData({ ...formData, meta_pixel_id: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>

              <Button onClick={handleSave} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {editingCompany ? "Update Company" : "Create Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <Card key={company.id} className={!company.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="w-12 h-12 object-contain rounded" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded flex items-center justify-center"
                      style={{ backgroundColor: company.primary_color }}
                    >
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">/{company.slug}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(company)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(company.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {company.phone && <p>📞 {company.phone}</p>}
              {company.email && <p>✉️ {company.email}</p>}
              {company.website_url && <p>🌐 {company.website_url}</p>}
              <div className="flex gap-2 mt-3">
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: company.primary_color }}
                  title="Primary"
                />
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: company.secondary_color }}
                  title="Secondary"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {companies.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No companies yet. Add your first company to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
});

CompanyManagement.displayName = "CompanyManagement";

export default CompanyManagement;
