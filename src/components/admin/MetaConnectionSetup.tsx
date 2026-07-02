import { useState, useEffect } from "react";
import { Facebook, Instagram, Check, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MetaPage {
  id: string;
  page_id: string;
  page_name: string | null;
  platform: "facebook" | "instagram" | "whatsapp";
  is_active: boolean;
  webhook_subscribed: boolean;
  created_at: string;
}

const MetaConnectionSetup = () => {
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  
  // Form state
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [igAccountId, setIgAccountId] = useState("");

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("meta_pages")
        .select("*")
        .in("platform", ["facebook", "instagram"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPages((data as MetaPage[]) || []);
    } catch (error) {
      console.error("Error fetching pages:", error);
      toast.error("Failed to load connected pages");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!pageId || !accessToken) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsConnecting(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      const insertData: any = {
        page_id: pageId,
        page_name: pageName || `${platform} Page`,
        platform,
        page_access_token: accessToken,
        is_active: true,
        webhook_subscribed: false,
        created_by: user.user?.id,
      };

      if (platform === "instagram" && igAccountId) {
        insertData.instagram_account_id = igAccountId;
      }

      const { error } = await supabase
        .from("meta_pages")
        .insert(insertData);

      if (error) throw error;

      toast.success(`${platform === "facebook" ? "Facebook" : "Instagram"} page connected!`);
      setShowDialog(false);
      resetForm();
      fetchPages();
    } catch (error) {
      console.error("Error connecting page:", error);
      toast.error("Failed to connect page");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      const { error } = await supabase
        .from("meta_pages")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Page disconnected");
      fetchPages();
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect page");
    }
  };

  const resetForm = () => {
    setPageId("");
    setPageName("");
    setAccessToken("");
    setIgAccountId("");
  };

  const fbPages = pages.filter(p => p.platform === "facebook");
  const igPages = pages.filter(p => p.platform === "instagram");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Meta Connections</h2>
          <p className="text-sm text-muted-foreground">
            Connect Facebook Pages and Instagram accounts to receive messages
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPages}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Setup Instructions */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-primary underline">Meta Developer Portal</a></p>
          <p>2. Create an app with "Business" type</p>
          <p>3. Add "Messenger" and "Instagram Graph API" products</p>
          <p>4. Generate a Page Access Token with messaging permissions</p>
          <p>5. Set webhook URL: <code className="bg-muted px-1 rounded text-xs">https://uzfccftfizleiyqzqoki.supabase.co/functions/v1/meta-webhook</code></p>
          <p>6. Verify Token: <code className="bg-muted px-1 rounded text-xs">hariox_meta_verify</code></p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Facebook Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" />
              Facebook Pages
            </CardTitle>
            <CardDescription>
              Connect pages to receive Messenger messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : fbPages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Facebook pages connected
              </p>
            ) : (
              <div className="space-y-2">
                {fbPages.map(page => (
                  <div key={page.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Facebook className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">{page.page_name}</p>
                        <p className="text-xs text-muted-foreground">ID: {page.page_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={page.is_active ? "default" : "secondary"}>
                        {page.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect Page?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will stop receiving messages from this page.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDisconnect(page.id)}>
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={showDialog && platform === "facebook"} onOpenChange={(open) => {
              setShowDialog(open);
              if (open) setPlatform("facebook");
            }}>
              <DialogTrigger asChild>
                <Button className="w-full" onClick={() => setPlatform("facebook")}>
                  <Facebook className="w-4 h-4 mr-2" />
                  Connect Facebook Page
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect Facebook Page</DialogTitle>
                  <DialogDescription>
                    Enter your Facebook Page details from Meta Developer Portal
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Page ID *</Label>
                    <Input
                      placeholder="123456789012345"
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Name</Label>
                    <Input
                      placeholder="My Business Page"
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Access Token *</Label>
                    <Input
                      type="password"
                      placeholder="EAAxxxxxxx..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Connect Page
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Instagram Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" />
              Instagram Accounts
            </CardTitle>
            <CardDescription>
              Connect Instagram Business accounts for DMs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : igPages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Instagram accounts connected
              </p>
            ) : (
              <div className="space-y-2">
                {igPages.map(page => (
                  <div key={page.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Instagram className="w-5 h-5 text-pink-600" />
                      <div>
                        <p className="font-medium text-sm">{page.page_name}</p>
                        <p className="text-xs text-muted-foreground">ID: {page.page_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={page.is_active ? "default" : "secondary"}>
                        {page.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will stop receiving DMs from this account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDisconnect(page.id)}>
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Dialog open={showDialog && platform === "instagram"} onOpenChange={(open) => {
              setShowDialog(open);
              if (open) setPlatform("instagram");
            }}>
              <DialogTrigger asChild>
                <Button className="w-full" variant="outline" onClick={() => setPlatform("instagram")}>
                  <Instagram className="w-4 h-4 mr-2" />
                  Connect Instagram Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect Instagram Account</DialogTitle>
                  <DialogDescription>
                    Enter your Instagram Business account details
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Facebook Page ID *</Label>
                    <Input
                      placeholder="123456789012345"
                      value={pageId}
                      onChange={(e) => setPageId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The Facebook Page linked to your Instagram Business account
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram Account ID</Label>
                    <Input
                      placeholder="17841400000000000"
                      value={igAccountId}
                      onChange={(e) => setIgAccountId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name</Label>
                    <Input
                      placeholder="@mybusiness"
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Access Token *</Label>
                    <Input
                      type="password"
                      placeholder="EAAxxxxxxx..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Connect Account
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Webhook Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Callback URL</p>
              <code className="text-xs text-muted-foreground">
                https://uzfccftfizleiyqzqoki.supabase.co/functions/v1/meta-webhook
              </code>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText("https://uzfccftfizleiyqzqoki.supabase.co/functions/v1/meta-webhook");
                toast.success("Copied to clipboard");
              }}
            >
              Copy
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Verify Token</p>
              <code className="text-xs text-muted-foreground">hariox_meta_verify</code>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText("hariox_meta_verify");
                toast.success("Copied to clipboard");
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Subscribe to: <strong>messages</strong>, <strong>messaging_postbacks</strong> webhooks
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaConnectionSetup;
