 import { useState, useEffect } from "react";
 import { Plus, Phone, Trash2, RefreshCw, Wifi, WifiOff, Copy, Check, Bot, ExternalLink } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent } from "@/components/ui/card";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Badge } from "@/components/ui/badge";
 import { Switch } from "@/components/ui/switch";
 import WhatsAppIcon from "@/components/ui/whatsapp-icon";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 
interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number: string | null;
  connection_type: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  meta_phone_id: string | null;
  meta_business_id?: string | null;
  last_connected_at: string | null;
  created_at: string;
  chatbot_enabled?: boolean;
  company_id?: string | null;
  verified_name?: string | null;
}
 
 interface WhatsAppAccountsProps {
   onAccountSelect: (account: WhatsAppAccount | null) => void;
   selectedAccount: WhatsAppAccount | null;
 }
 
 const WhatsAppAccounts = ({ onAccountSelect, selectedAccount }: WhatsAppAccountsProps) => {
   const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [copiedWebhook, setCopiedWebhook] = useState(false);
   
   const [name, setName] = useState("");
   const [phoneNumber, setPhoneNumber] = useState("");
   const [metaPhoneId, setMetaPhoneId] = useState("");
   const [metaBusinessId, setMetaBusinessId] = useState("");
   const [metaAccessToken, setMetaAccessToken] = useState("");
 
   useEffect(() => {
     fetchAccounts();
   }, []);
 
   const fetchAccounts = async () => {
     try {
        const { data, error } = await supabase
          .from("whatsapp_accounts")
          .select("*")
          .order("name", { ascending: true });
 
       if (error) throw error;
       const typedData = (data || []) as WhatsAppAccount[];
       setAccounts(typedData);
       
       if (typedData.length > 0 && !selectedAccount) {
         onAccountSelect(typedData[0]);
       }
     } catch (error) {
       console.error("Error fetching accounts:", error);
       toast.error("Failed to load WhatsApp accounts");
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleAddAccount = async () => {
     if (!name || !metaPhoneId) {
       toast.error("Please enter account name and Meta Phone ID");
       return;
     }
 
     try {
       const { data: { session } } = await supabase.auth.getSession();
       
       const { data, error } = await supabase
         .from("whatsapp_accounts")
         .insert({
           name,
           connection_type: "meta_api",
           status: "connected",
           created_by: session?.user.id,
           phone_number: phoneNumber,
           meta_phone_id: metaPhoneId,
           meta_business_id: metaBusinessId,
           meta_access_token: metaAccessToken || null,
         })
         .select()
         .single();
 
       if (error) throw error;
 
       toast.success("Account added successfully");
       setAccounts([data as WhatsAppAccount, ...accounts]);
       onAccountSelect(data as WhatsAppAccount);
       resetForm();
       setIsDialogOpen(false);
     } catch (error) {
       console.error("Error adding account:", error);
       toast.error("Failed to add account");
     }
   };
 
   const handleToggleChatbot = async (accountId: string, enabled: boolean) => {
     try {
       const { error } = await supabase
         .from("whatsapp_accounts")
         .update({ chatbot_enabled: enabled })
         .eq("id", accountId);
 
       if (error) throw error;
       setAccounts(accounts.map(a => a.id === accountId ? { ...a, chatbot_enabled: enabled } : a));
       toast.success(enabled ? "AI Chatbot enabled" : "AI Chatbot disabled");
     } catch (error) {
       console.error("Error toggling chatbot:", error);
     }
   };
 
  const handleRegisterNumber = async (accountId: string) => {
    try {
      toast.info("Registering phone number with Meta Cloud API...");
      const { data, error } = await supabase.functions.invoke("register-whatsapp-number", {
        body: { account_id: accountId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success("Phone number registered successfully! Messages can now be sent.");
      setAccounts(accounts.map(a => a.id === accountId ? { ...a, status: "connected" as const } : a));
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to register phone number");
    }
  };

  const handleDeleteAccount = async (id: string) => {
     if (!confirm("Delete this account?")) return;
     try {
       const { error } = await supabase.from("whatsapp_accounts").delete().eq("id", id);
       if (error) throw error;
       setAccounts(accounts.filter(a => a.id !== id));
       if (selectedAccount?.id === id) onAccountSelect(accounts.find(a => a.id !== id) || null);
       toast.success("Account deleted");
     } catch (error) {
       toast.error("Failed to delete account");
     }
   };
 
   const copyWebhookUrl = () => {
     navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`);
     setCopiedWebhook(true);
     setTimeout(() => setCopiedWebhook(false), 2000);
     toast.success("Webhook URL copied");
   };
 
   const resetForm = () => {
     setName("");
     setPhoneNumber("");
     setMetaPhoneId("");
     setMetaBusinessId("");
     setMetaAccessToken("");
   };
 
   const getStatusBadge = (status: string) => {
     if (status === "connected") return <Badge className="bg-emerald-600"><Wifi className="w-3 h-3 mr-1" /> Connected</Badge>;
     if (status === "connecting") return <Badge className="bg-amber-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Connecting</Badge>;
     if (status === "error") return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" /> Error</Badge>;
     return <Badge variant="secondary"><WifiOff className="w-3 h-3 mr-1" /> Disconnected</Badge>;
   };
 
   if (isLoading) {
     return <div className="flex items-center justify-center h-32"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
   }
 
   return (
     <div className="space-y-4">
       <div className="flex justify-between items-center">
         <h3 className="font-semibold">WhatsApp Accounts ({accounts.length}/5)</h3>
         <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
           <DialogTrigger asChild>
             <Button size="sm" disabled={accounts.length >= 5}><Plus className="w-4 h-4 mr-2" /> Add Account</Button>
           </DialogTrigger>
           <DialogContent className="max-w-lg">
             <DialogHeader><DialogTitle>Add WhatsApp Account (Meta API)</DialogTitle></DialogHeader>
             <div className="space-y-4">
               <div className="space-y-2"><Label>Account Name *</Label><Input placeholder="e.g., Sales Team" value={name} onChange={(e) => setName(e.target.value)} /></div>
               <div className="space-y-2"><Label>Phone Number</Label><Input placeholder="+91 98765 43210" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></div>
               <div className="space-y-2"><Label>Meta Phone Number ID *</Label><Input placeholder="Enter Phone Number ID" value={metaPhoneId} onChange={(e) => setMetaPhoneId(e.target.value)} /></div>
               <div className="space-y-2"><Label>Meta Business ID</Label><Input placeholder="For template sync" value={metaBusinessId} onChange={(e) => setMetaBusinessId(e.target.value)} /></div>
               <div className="space-y-2"><Label>Access Token (optional)</Label><Input type="password" placeholder="Uses secret if empty" value={metaAccessToken} onChange={(e) => setMetaAccessToken(e.target.value)} /></div>
               <div className="space-y-2 border-t pt-4"><Label>Webhook URL</Label><div className="flex gap-2"><Input readOnly value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`} className="text-xs" /><Button variant="outline" size="sm" onClick={copyWebhookUrl}>{copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button></div></div>
               <Button onClick={handleAddAccount} className="w-full bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" /> Connect Account</Button>
             </div>
           </DialogContent>
         </Dialog>
       </div>
 
       <div className="grid gap-3">
         {accounts.map((account) => (
           <Card key={account.id} className={`cursor-pointer transition-colors ${selectedAccount?.id === account.id ? "border-primary" : "hover:border-muted-foreground/50"}`} onClick={() => onAccountSelect(account)}>
             <CardContent className="p-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-emerald-600/10 flex items-center justify-center"><Phone className="w-5 h-5 text-emerald-600" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{account.verified_name || account.name}</p>
                        {account.chatbot_enabled && <Badge variant="secondary" className="text-[10px]"><Bot className="w-3 h-3 mr-1" /> AI</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.phone_number ? `+${account.phone_number}` : "No phone"} • Meta API</p>
                      {account.verified_name && account.verified_name !== account.name && (
                        <p className="text-[10px] text-muted-foreground">Account: {account.name}</p>
                      )}
                    </div>
                 </div>
                <div className="flex items-center gap-2">
                    {getStatusBadge(account.status)}
                    {(account.status === "error" || account.status === "disconnected") && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); handleRegisterNumber(account.id); }}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Register
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
               </div>
               <div className="mt-3 pt-3 border-t flex items-center justify-between">
                 <div className="flex items-center gap-2"><Bot className="w-4 h-4 text-muted-foreground" /><div><p className="text-sm font-medium">AI Chatbot</p><p className="text-xs text-muted-foreground">Auto-reply & lead capture</p></div></div>
                 <Switch checked={account.chatbot_enabled || false} onCheckedChange={(checked) => handleToggleChatbot(account.id, checked)} onClick={(e) => e.stopPropagation()} />
               </div>
             </CardContent>
           </Card>
         ))}
         {accounts.length === 0 && <div className="text-center py-8 text-muted-foreground"><WhatsAppIcon size="xl" className="mx-auto mb-2 opacity-50 text-[#25D366]" /><p>No WhatsApp accounts connected</p><p className="text-sm">Add an account using Meta API to start messaging</p></div>}
       </div>
     </div>
   );
 };
 
 export default WhatsAppAccounts;