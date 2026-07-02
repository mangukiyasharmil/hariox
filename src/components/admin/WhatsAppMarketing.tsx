import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, Reply, BarChart3, Phone } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

import WhatsAppAccounts from "./whatsapp/WhatsAppAccounts";
import WhatsAppCampaigns from "./whatsapp/WhatsAppCampaigns";
import WhatsAppTemplates from "./whatsapp/WhatsAppTemplates";
import WhatsAppAutoResponses from "./whatsapp/WhatsAppAutoResponses";
import WhatsAppAPIDashboard from "./whatsapp/WhatsAppAPIDashboard";

interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number: string | null;
  connection_type: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  meta_phone_id: string | null;
  last_connected_at: string | null;
  created_at: string;
  company_id?: string | null;
}

const WhatsAppMarketing = () => {
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const { currentCompany, showAllCompanies } = useCompany();

  const accountId = selectedAccount?.id || null;

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Auto-select account when company changes — lock to company's account
  useEffect(() => {
    if (accounts.length === 0) return;
    
    if (currentCompany && !showAllCompanies) {
      // Single company selected: auto-lock to that company's account
      const matched = accounts.find(a => a.company_id === currentCompany.id);
      if (matched && matched.id !== selectedAccount?.id) {
        setSelectedAccount(matched);
      } else if (!matched) {
        setSelectedAccount(null);
      }
    } else if (showAllCompanies && !selectedAccount) {
      // All companies: default to first account
      setSelectedAccount(accounts[0]);
    }
  }, [currentCompany, showAllCompanies, accounts]);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .order("name");
    const typed = (data || []) as WhatsAppAccount[];
    setAccounts(typed);
    if (typed.length > 0 && !selectedAccount) {
      if (currentCompany && !showAllCompanies) {
        const matched = typed.find(a => a.company_id === currentCompany.id);
        setSelectedAccount(matched || null);
      } else {
        setSelectedAccount(typed[0]);
      }
    }
  };

  // Visible accounts: filter by company unless "All Companies"
  const visibleAccounts = showAllCompanies
    ? accounts
    : accounts.filter(a => a.company_id === currentCompany?.id);

  return (
    <div className="space-y-4">
      {/* Header with account info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">WhatsApp Marketing</h2>
          <p className="text-xs text-muted-foreground">Manage accounts, campaigns & messaging</p>
        </div>
        <div className="flex items-center gap-2">
          <WhatsAppIcon size="sm" className="text-[#25D366]" />
          {showAllCompanies ? (
            /* Admin "All Companies" mode: show dropdown */
            <Select
              value={selectedAccount?.id || ""}
              onValueChange={(val) => {
                const acc = accounts.find(a => a.id === val);
                if (acc) setSelectedAccount(acc);
              }}
            >
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Select Account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${acc.status === "connected" ? "bg-green-500" : "bg-red-400"}`} />
                      {acc.name} {acc.phone_number ? `(${acc.phone_number})` : ""}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            /* Single company: show locked label, no dropdown */
            <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-muted/50 h-8">
              <div className={`w-1.5 h-1.5 rounded-full ${selectedAccount?.status === "connected" ? "bg-green-500" : "bg-red-400"}`} />
              <span className="text-xs font-medium truncate max-w-[200px]">
                {selectedAccount
                  ? `${selectedAccount.name} ${selectedAccount.phone_number ? `(${selectedAccount.phone_number})` : ""}`
                  : "No account linked"}
              </span>
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5 hidden sm:inline" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5 text-xs">
            <Phone className="w-3.5 h-3.5 hidden sm:inline" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5 hidden sm:inline" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5 hidden sm:inline" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="auto" className="gap-1.5 text-xs">
            <Reply className="w-3.5 h-3.5 hidden sm:inline" />
            Auto-Reply
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <WhatsAppAPIDashboard accountId={accountId} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <WhatsAppAccounts onAccountSelect={setSelectedAccount} selectedAccount={selectedAccount} />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <WhatsAppCampaigns accountId={accountId} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <WhatsAppTemplates accountId={accountId} />
        </TabsContent>
        <TabsContent value="auto" className="mt-4">
          <WhatsAppAutoResponses accountId={accountId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppMarketing;
