import { useState, useEffect } from "react";
import { Plus, Trash2, Bot, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AutoResponse {
  id: string;
  account_id: string | null;
  trigger_keyword: string;
  response_message: string;
  is_active: boolean;
  created_at: string;
}

interface WhatsAppAutoResponsesProps {
  accountId: string | null;
}

const WhatsAppAutoResponses = ({ accountId }: WhatsAppAutoResponsesProps) => {
  const [responses, setResponses] = useState<AutoResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (accountId) fetchResponses();
  }, [accountId]);

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_auto_responses")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error("Error fetching auto responses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!keyword || !message) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from("whatsapp_auto_responses")
        .insert({
          account_id: accountId,
          trigger_keyword: keyword.toLowerCase(),
          response_message: message,
          created_by: session?.user.id,
        });

      if (error) throw error;
      
      toast.success("Auto-response created");
      fetchResponses();
      setKeyword("");
      setMessage("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving auto response:", error);
      toast.error("Failed to save auto-response");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("whatsapp_auto_responses")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      setResponses(responses.map(r => r.id === id ? { ...r, is_active: isActive } : r));
    } catch (error) {
      console.error("Error toggling auto response:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this auto-response?")) return;

    try {
      const { error } = await supabase
        .from("whatsapp_auto_responses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setResponses(responses.filter(r => r.id !== id));
      toast.success("Auto-response deleted");
    } catch (error) {
      console.error("Error deleting auto response:", error);
    }
  };

  if (!accountId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Select a WhatsApp account to manage auto-responses
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Auto-Responses</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add Response
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Auto-Response</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Trigger Keyword</Label>
                <Input
                  placeholder="e.g., hi, hello, status, help"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  When customer message contains this keyword, auto-reply will be sent
                </p>
              </div>
              <div className="space-y-2">
                <Label>Response Message</Label>
                <Textarea
                  placeholder="Hello! Thank you for contacting Hariox. How can we help you today?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={handleSave} className="w-full">
                <Save className="w-4 h-4 mr-2" /> Save Auto-Response
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {responses.map((response) => (
          <Card key={response.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm bg-muted px-2 py-0.5 rounded">
                        {response.trigger_keyword}
                      </span>
                      <Switch
                        checked={response.is_active}
                        onCheckedChange={(checked) => handleToggle(response.id, checked)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {response.response_message}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(response.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {responses.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No auto-responses configured</p>
            <p className="text-sm">Add triggers for automatic replies</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppAutoResponses;
