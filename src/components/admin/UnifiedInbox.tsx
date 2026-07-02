import { useState, useEffect, useRef } from "react";
import {
  Send, Search, Phone, User, Check, CheckCheck, Star, X, Plus, ArrowRight,
  UserCheck, Users, ChevronRight, Tag, FileText, Edit2, Paperclip, Smile,
  IndianRupee, MapPin, Mail, Calendar, ExternalLink, RefreshCw, MessageSquare, Instagram, Facebook, Bot,
  Heart, Clock, AlertCircle, Loader2, ShieldCheck, Timer,
} from "lucide-react";
import CannedResponses from "./inbox/CannedResponses";
import SLATimer from "./inbox/SLATimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";


type Platform = "all" | "whatsapp" | "facebook" | "instagram";
type FilterTab = "all" | "starred" | "unread";
type LeadFilter = "all" | "my_leads" | "unassigned" | "interested" | "agent" | "needs_agent";

interface StaffMember {
  id: string;
  name: string;
}

interface Message {
  id: string;
  platform: string;
  sender_id: string;
  sender_name: string | null;
  sender_profile_pic: string | null;
  content: string;
  direction: string;
  status: string;
  created_at: string;
  message_type: string;
  lead_id: string | null;
  is_read: boolean;
  media_url?: string | null;
  media_mime_type?: string | null;
}

interface Conversation {
  sender_id: string;
  sender_name: string | null;
  sender_profile_pic: string | null;
  platform: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  is_starred: boolean;
  is_interested: boolean | null;
  lead_id: string | null;
  lead_name: string | null;
  lead_status: string | null;
  assigned_to: string | null;
  needs_agent?: boolean;
  loan_type: string | null;
  loan_amount: number | null;
  email: string | null;
  city: string | null;
  monthly_income: number | null;
  contact_created_at: string | null;
  account_id?: string | null;
}

interface WhatsAppMessage {
  id: string;
  phone_number: string;
  contact_name: string | null;
  content: string;
  direction: string;
  status: string;
  created_at: string;
  message_type: string;
  lead_id: string | null;
  account_id: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
}

interface Lead {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  loan_type: string;
  loan_amount: number;
  status: string;
}

interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
  chatbot_enabled: boolean | null;
  company_id: string | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category?: string;
  language?: string;
  meta_variables_count?: number;
  header_type?: string;
  header_url?: string;
}

// Format phone to 10-digit display (strip country code)
const formatPhone10 = (phone: string | null | undefined): string => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const UnifiedInbox = () => {
  const inboxTab = "external"; // Internal chat removed for performance
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform>("whatsapp");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [leadFilter, setLeadFilter] = useState<LeadFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newChatTab, setNewChatTab] = useState<"phone" | "lead">("lead");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [searchedLeads, setSearchedLeads] = useState<Lead[]>([]);
  const [isSearchingLeads, setIsSearchingLeads] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  const [waAccounts, setWaAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [is24hWindowClosed, setIs24hWindowClosed] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentCompany } = useCompany();

  useEffect(() => {
    fetchCurrentUser();
    fetchWaAccounts();
    fetchStaffList();
  }, []);

  // Re-fetch WA accounts when company changes to ensure fresh data
  useEffect(() => {
    fetchWaAccounts();
  }, [currentCompany?.id]);

  // Auto-select WA account when company changes (match by company_id)
  // This is the SINGLE SOURCE OF TRUTH for account selection
  useEffect(() => {
    if (waAccounts.length === 0) return;
    if (currentCompany) {
      const matched = waAccounts.find(acc => acc.company_id === currentCompany.id);
      setSelectedAccountId(matched?.id || null);
    } else {
      // Admin "All Companies" — set to null so we fetch ALL accounts' messages
      setSelectedAccountId(null);
    }
  }, [currentCompany?.id, waAccounts]);

  useEffect(() => {
    if (currentUserId) {
      fetchConversations();
    }
    // Note: we track currentCompany?.id directly, NOT selectedAccountId,
    // because selectedAccountId is derived from company and may cause double-fetches
  }, [platformFilter, leadFilter, currentUserId, currentCompany?.id, selectedAgentId, waAccounts]);

  useEffect(() => {
    if (selectedAccountId) fetchTemplates();
  }, [selectedAccountId]);

  // Pre-fetch templates on mount if account exists
  useEffect(() => {
    if (waAccounts.length > 0 && !templatesLoaded) {
      const acctId = selectedAccountId || waAccounts[0]?.id;
      if (acctId) fetchTemplates();
    }
  }, [waAccounts]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (leadSearchQuery.length >= 2) {
        searchLeads(leadSearchQuery);
      } else {
        setSearchedLeads([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearchQuery]);

  useEffect(() => {
    const channel = supabase
      .channel(`unified-inbox-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        async (payload) => {
          const msg = payload.new as any;
          // For non-admin staff, only refresh if message belongs to their assigned lead
          if (!isAdmin && currentUserId && msg.lead_id) {
            const { data: lead } = await supabase
              .from("leads")
              .select("assigned_to")
              .eq("id", msg.lead_id)
              .single();
            if (lead?.assigned_to !== currentUserId) return; // Skip — not their lead
          }
          fetchConversations();
          if (selectedConversation?.platform === 'whatsapp') {
            fetchMessages(selectedConversation);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'unified_messages' },
        () => {
          fetchConversations();
          if (selectedConversation && selectedConversation.platform !== 'whatsapp') {
            fetchMessages(selectedConversation);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, isAdmin, currentUserId]);

  /** Clear the needs_agent flag for all messages from this phone number */
  const handleResolveAgentRequest = async (conversation: Conversation) => {
    if (!conversation || conversation.platform !== "whatsapp") return;
    try {
      // Derive account from company context (single source of truth)
      const accountFilter = currentCompany 
        ? waAccounts.find(acc => acc.company_id === currentCompany.id)?.id || null
        : selectedAccountId;

      let query = supabase
        .from("whatsapp_messages")
        .update({ needs_agent: false })
        .eq("phone_number", conversation.sender_id)
        .eq("needs_agent", true);
      if (accountFilter) query = query.eq("account_id", accountFilter);

      const { error } = await query;
      if (error) throw error;

      // Update local state
      setSelectedConversation({ ...conversation, needs_agent: false });
      setConversations(prev =>
        prev.map(c =>
          c.sender_id === conversation.sender_id && c.platform === conversation.platform
            ? { ...c, needs_agent: false }
            : c
        )
      );
      toast.success("Agent request resolved");
    } catch (err) {
      console.error("Error resolving agent request:", err);
      toast.error("Failed to resolve");
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUserId(session.user.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const hasAdmin = roles?.some(r => r.role === "admin");
      setIsAdmin(!!hasAdmin);
      setLeadFilter(hasAdmin ? "all" : "my_leads");
    }
  };

  const fetchStaffList = async () => {
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (!roles || roles.length === 0) return;
      const userIds = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const staff: StaffMember[] = (profiles || []).map(p => ({
        id: p.user_id,
        name: p.full_name || "Unknown",
      }));
      setStaffList(staff);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  };

  const fetchWaAccounts = async () => {
    try {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select("id, name, phone_number, status, chatbot_enabled, company_id")
        .order("created_at", { ascending: false });
      const accs = (data || []) as WhatsAppAccount[];
      setWaAccounts(accs);
      // Don't set selectedAccountId here — it's derived from currentCompany in useEffect
    } catch (error) {
      console.error("Error fetching WA accounts:", error);
    }
  };

  const fetchTemplates = async () => {
    try {
      // First try selected account
      let accountToQuery = selectedAccountId;
      if (accountToQuery) {
        const { data, error } = await supabase
          .from("whatsapp_templates")
          .select("id, name, content, variables, category, language, meta_variables_count, header_type, header_url")
          .eq("account_id", accountToQuery)
          .eq("is_active", true)
          .order("name");
        if (!error && data && data.length > 0) {
          console.log(`[Inbox] Loaded ${data.length} templates for account ${accountToQuery}`);
          setTemplates(data);
          setTemplatesLoaded(true);
          return;
        }
      }
      // Fallback: load templates from ANY account that has active templates
      const { data: allTemplates, error: allError } = await supabase
        .from("whatsapp_templates")
        .select("id, name, content, variables, category, language, meta_variables_count, header_type, header_url")
        .eq("is_active", true)
        .order("name");
      if (allError) {
        console.error("Error fetching templates:", allError);
        return;
      }
      console.log(`[Inbox] Loaded ${(allTemplates || []).length} templates (fallback from all accounts)`);
      setTemplates(allTemplates || []);
      setTemplatesLoaded(true);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  // Check 24h window status when messages change
  useEffect(() => {
    if (!messages.length || !selectedConversation || selectedConversation.platform !== "whatsapp") {
      setIs24hWindowClosed(false);
      return;
    }
    const lastIncoming = [...messages].reverse().find(m => m.direction === "incoming");
    if (!lastIncoming) {
      setIs24hWindowClosed(true);
      return;
    }
    const hoursSince = (Date.now() - new Date(lastIncoming.created_at).getTime()) / (1000 * 60 * 60);
    setIs24hWindowClosed(hoursSince > 24);
  }, [messages, selectedConversation]);

  const handleSelectTemplate = (template: Template) => {
    // Use meta_variables_count to determine actual param count from Meta
    const metaVarCount = template.meta_variables_count || 0;
    const paramLabels = ["Name", "Amount", "Loan Type", "City"];
    
    let params: string[] = [];
    if (metaVarCount > 0) {
      params = Array.from({ length: metaVarCount }, (_, i) => {
        const label = paramLabels[i]?.toLowerCase() || "";
        if (!selectedConversation) return "";
        if (label.includes("name")) return selectedConversation.lead_name || selectedConversation.sender_name || "";
        if (label.includes("amount")) return selectedConversation.loan_amount?.toLocaleString("en-IN") || "";
        if (label.includes("loan")) return selectedConversation.loan_type || "";
        if (label.includes("city")) return selectedConversation.city || "";
        return "";
      });
    }
    
    setSelectedTemplate(template);
    setTemplateParams(params);
    setNewMessage(template.content || `📋 Template: ${template.name}`);
    setShowTemplates(false);
  };

  const clearSelectedTemplate = () => {
    setSelectedTemplate(null);
    setTemplateParams([]);
    setNewMessage("");
  };

  const searchLeads = async (query: string) => {
    setIsSearchingLeads(true);
    try {
      let q = supabase
        .from("leads")
        .select("id, full_name, phone, email, city, loan_type, loan_amount, status")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
      
      // Filter by company for isolation
      if (currentCompany) {
        q = q.eq("company_id", currentCompany.id);
      }
      
      const { data, error } = await q.limit(10);
      if (error) throw error;
      setSearchedLeads(data || []);
    } catch (error) {
      console.error("Error searching leads:", error);
    } finally {
      setIsSearchingLeads(false);
    }
  };

  const fetchConversations = async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    try {
      const convos: Conversation[] = [];

      if (platformFilter === "all" || platformFilter === "whatsapp") {
        // Determine which account(s) to query
        // If a specific company is selected, use its matched account
        // If "All Companies" (admin), query ALL company-linked accounts
        let accountIds: string[] = [];
        if (currentCompany) {
          const matched = waAccounts.find(acc => acc.company_id === currentCompany.id);
          if (matched) accountIds = [matched.id];
        } else if (selectedAccountId) {
          accountIds = [selectedAccountId];
        } else if (isAdmin) {
          // Admin "All Companies" — include all accounts
          accountIds = waAccounts.map(acc => acc.id);
        }

        if (accountIds.length > 0) {
          const waQuery = supabase
            .from("whatsapp_messages")
            .select(`*, leads:lead_id (id, full_name, status, assigned_to, loan_type, loan_amount, email, city, monthly_income, is_interested, created_at, company_id)`)
            .in("account_id", accountIds)
            .order("created_at", { ascending: false });

          const { data: waMessages, error: waError } = await waQuery;

          if (waError) throw waError;

          // Track which phone numbers have needs_agent messages
          const needsAgentPhones = new Set<string>();
          (waMessages || []).forEach(msg => {
            if (msg.needs_agent === true) needsAgentPhones.add(msg.phone_number);
          });

          // Use composite key (account_id + phone_number) to prevent cross-company merging
          const waGrouped = (waMessages || []).reduce((acc, msg) => {
            const lead = msg.leads as any;
            
            // Company-level isolation: if a lead is linked, it must belong to the active company
            if (currentCompany && lead && lead.company_id && lead.company_id !== currentCompany.id) {
              return acc;
            }

            if (leadFilter === "my_leads" && lead?.assigned_to !== currentUserId) return acc;
            if (leadFilter === "unassigned" && lead?.assigned_to) return acc;
            if (leadFilter === "interested" && !lead?.is_interested) return acc;
            if (leadFilter === "agent" && selectedAgentId && lead?.assigned_to !== selectedAgentId) return acc;
            if (leadFilter === "needs_agent" && !needsAgentPhones.has(msg.phone_number)) return acc;
            
            // Use account_id + phone for grouping to prevent merging across companies
            const groupKey = `${msg.account_id}::${msg.phone_number}`;
            if (!acc[groupKey]) {
              acc[groupKey] = {
                sender_id: msg.phone_number,
                sender_name: msg.contact_name || lead?.full_name || null,
                sender_profile_pic: null,
                platform: "whatsapp",
                last_message: msg.content,
                last_time: msg.created_at,
                unread_count: 0,
                is_starred: false,
                is_interested: lead?.is_interested ?? null,
                lead_id: msg.lead_id,
                lead_name: lead?.full_name || null,
                lead_status: lead?.status || null,
                assigned_to: lead?.assigned_to || null,
                needs_agent: needsAgentPhones.has(msg.phone_number),
                loan_type: lead?.loan_type || null,
                loan_amount: lead?.loan_amount || null,
                email: lead?.email || null,
                city: lead?.city || null,
                monthly_income: lead?.monthly_income || null,
                contact_created_at: lead?.created_at || null,
                account_id: msg.account_id || null,
              };
            }
            if (msg.direction === "incoming" && msg.status !== "read") {
              acc[groupKey].unread_count++;
            }
            return acc;
          }, {} as Record<string, Conversation>);

          convos.push(...Object.values(waGrouped));
        } else {
          console.log("[Inbox] No WhatsApp account for current company, skipping WA messages");
        }
      }

      if (platformFilter === "all" || platformFilter === "facebook" || platformFilter === "instagram") {
        const platformsToFetch = platformFilter === "all" 
          ? ["facebook", "instagram"] 
          : [platformFilter];
        
        let query = supabase
          .from("unified_messages")
          .select("*")
          .order("created_at", { ascending: false });

        if (platformFilter !== "all") {
          query = query.eq("platform", platformFilter as "facebook" | "instagram" | "whatsapp");
        } else {
          query = query.in("platform", platformsToFetch as ("facebook" | "instagram")[]);
        }

        const { data: unifiedMessages, error: unifiedError } = await query;

        if (unifiedError) throw unifiedError;

        const unifiedGrouped = (unifiedMessages || []).reduce((acc, msg) => {
          const key = `${msg.platform}-${msg.sender_id}`;
          if (!acc[key]) {
            acc[key] = {
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              sender_profile_pic: msg.sender_profile_pic,
              platform: msg.platform,
              last_message: msg.content,
              last_time: msg.created_at,
              unread_count: 0,
              is_starred: false,
              is_interested: null,
              lead_id: msg.lead_id,
              lead_name: null,
              lead_status: null,
              assigned_to: null,
              loan_type: null,
              loan_amount: null,
              email: null,
              city: null,
              monthly_income: null,
              contact_created_at: null,
            };
          }
          if (msg.direction === "incoming" && !msg.is_read) {
            acc[key].unread_count++;
          }
          return acc;
        }, {} as Record<string, Conversation>);

        convos.push(...Object.values(unifiedGrouped));
      }

      convos.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());

      setConversations(convos);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (conversation: Conversation) => {
    try {
      if (conversation.platform === "whatsapp") {
        // Use conversation's account_id for precise filtering (prevents cross-company merge)
        const conversationAccountId = conversation.account_id;
        const accountFilter = conversationAccountId
          || (currentCompany ? waAccounts.find(acc => acc.company_id === currentCompany.id)?.id : null)
          || selectedAccountId;

        let msgQuery = supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("phone_number", conversation.sender_id)
          .order("created_at", { ascending: true });

        if (accountFilter) {
          msgQuery = msgQuery.eq("account_id", accountFilter);
        } else if (isAdmin && waAccounts.length > 0) {
          msgQuery = msgQuery.in("account_id", waAccounts.map(a => a.id));
        }

        const { data, error } = await msgQuery;

        if (error) throw error;

        setMessages((data || []).map((m: WhatsAppMessage) => ({
          id: m.id,
          platform: "whatsapp",
          sender_id: m.phone_number,
          sender_name: m.contact_name,
          sender_profile_pic: null,
          content: m.content,
          direction: m.direction,
          status: m.status || "sent",
          created_at: m.created_at,
          message_type: m.message_type,
          lead_id: m.lead_id,
          is_read: m.status === "read",
          media_url: (m as any).media_url || null,
          media_mime_type: (m as any).media_mime_type || null,
        })));

        // Mark as read — scoped to account
        let markReadQuery = supabase
          .from("whatsapp_messages")
          .update({ status: "read", read_at: new Date().toISOString() })
          .eq("phone_number", conversation.sender_id)
          .eq("direction", "incoming")
          .neq("status", "read");
        if (accountFilter) {
          markReadQuery = markReadQuery.eq("account_id", accountFilter);
        }
        await markReadQuery;
      } else {
        const platformValue = conversation.platform as "facebook" | "instagram" | "whatsapp";
        const { data, error } = await supabase
          .from("unified_messages")
          .select("*")
          .eq("platform", platformValue)
          .eq("sender_id", conversation.sender_id)
          .order("created_at", { ascending: true });

        if (error) throw error;

        setMessages((data || []) as Message[]);

        await supabase
          .from("unified_messages")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("platform", platformValue)
          .eq("sender_id", conversation.sender_id)
          .eq("direction", "incoming")
          .eq("is_read", false);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setIsSending(true);

    const addOptimistic = (content: string, messageType: "text" | "template") => {
      const optimisticId = `tmp-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          platform: "whatsapp",
          sender_id: selectedConversation.sender_id,
          sender_name: selectedConversation.sender_name,
          sender_profile_pic: null,
          content,
          direction: "outgoing",
          status: "sending",
          created_at: new Date().toISOString(),
          message_type: messageType,
          lead_id: selectedConversation.lead_id,
          is_read: true,
        },
      ]);
      return optimisticId;
    };

    const patchOptimistic = (optimisticId: string, patch: Partial<Message>) => {
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? { ...m, ...patch } : m)));
    };

    const showWhatsAppSendError = (errCode?: string, errMsg?: string) => {
      if (errCode === "OUTSIDE_24H_WINDOW") {
        toast.error("⏰ 24-hour window expired. Use a Template to re-engage this customer.", { duration: 6000 });
        return;
      }
      if (errCode === "TEMPLATE_NOT_SYNCED") {
        toast.error("Templates not synced for this account. Open Templates → Sync from Meta.", { duration: 6500 });
        return;
      }
      if (errCode === "META_TIMEOUT") {
        toast.error("WhatsApp provider timeout. Please try again.", { duration: 6500 });
        return;
      }
      toast.error(errMsg || "Failed to send message", { duration: 5000 });
    };

    try {
      if (selectedConversation.platform === "whatsapp") {
        // Derive send account from company context
        const sendAccountId = currentCompany
          ? waAccounts.find(acc => acc.company_id === currentCompany.id)?.id || selectedAccountId
          : selectedAccountId;
        if (!sendAccountId) {
          toast.error("No WhatsApp account for this company");
          return;
        }

        if (selectedTemplate) {
          let readableContent = selectedTemplate.content;
          const variables = selectedTemplate.variables || [];
          variables.forEach((v: string, i: number) => {
            readableContent = readableContent.replace(`{{${v}}}`, templateParams[i] || v);
          });
          templateParams.forEach((p, i) => {
            readableContent = readableContent.replace(`{{${i + 1}}}`, p || `{{${i + 1}}}`);
          });
          templateParams.forEach((p) => {
            readableContent = readableContent.replace(`{{}}`, p || "");
          });

          const optimisticId = addOptimistic(readableContent, "template");

          const { data, error } = await supabase.functions.invoke("send-whatsapp", {
            body: {
              account_id: sendAccountId,
              phone_number: selectedConversation.sender_id,
              template_name: selectedTemplate.name,
              template_language: selectedTemplate.language || "en",
              template_params: templateParams.length > 0 ? templateParams : undefined,
              contact_name: selectedConversation.sender_name,
              lead_id: selectedConversation.lead_id,
              message: readableContent,
            },
          });

          if (error || (data && !data.success)) {
            let errCode = data?.error_code;
            let errMsg = data?.error || (error as any)?.message;
            if (!errCode && (error as any)?.context) {
              try {
                const errBody = await (error as any).context.json();
                errCode = errBody?.error_code;
                errMsg = errBody?.error || errMsg;
              } catch {}
            }
            patchOptimistic(optimisticId, { status: "failed" });
            showWhatsAppSendError(errCode, errMsg);
            if (errCode === "OUTSIDE_24H_WINDOW") setIs24hWindowClosed(true);
            return;
          }

          patchOptimistic(optimisticId, { id: data?.message_id || optimisticId, status: "sent" });
          clearSelectedTemplate();
        } else {
          const optimisticId = addOptimistic(newMessage, "text");

          const { data, error } = await supabase.functions.invoke("send-whatsapp", {
            body: {
              account_id: sendAccountId,
              phone_number: selectedConversation.sender_id,
              message: newMessage,
              contact_name: selectedConversation.sender_name,
              lead_id: selectedConversation.lead_id,
            },
          });

          if (error || (data && !data.success)) {
            let errCode = data?.error_code;
            let errMsg = data?.error || (error as any)?.message;
            if (!errCode && (error as any)?.context) {
              try {
                const errBody = await (error as any).context.json();
                errCode = errBody?.error_code;
                errMsg = errBody?.error || errMsg;
              } catch {}
            }
            patchOptimistic(optimisticId, { status: "failed" });
            showWhatsAppSendError(errCode, errMsg);
            if (errCode === "OUTSIDE_24H_WINDOW") setIs24hWindowClosed(true);
            return;
          }

          patchOptimistic(optimisticId, { id: data?.message_id || optimisticId, status: "sent" });
        }
      } else {
        const platformValue = selectedConversation.platform as "facebook" | "instagram" | "whatsapp";
        const { data: pageData } = await supabase
          .from("meta_pages")
          .select("id")
          .eq("platform", platformValue)
          .eq("is_active", true)
          .limit(1);

        if (!pageData?.length) {
          toast.error(`No connected ${selectedConversation.platform === "facebook" ? "Facebook" : "Instagram"} page`);
          return;
        }

        const { error } = await supabase.functions.invoke("send-meta-message", {
          body: {
            page_id: pageData[0].id,
            recipient_id: selectedConversation.sender_id,
            message: newMessage,
            platform: selectedConversation.platform,
          },
        });

        if (error) {
          toast.error("Failed to send message");
          return;
        }
      }

      setNewMessage("");
      fetchMessages(selectedConversation);
      toast.success("Message sent");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectLead = (lead: Lead) => {
    const phone = lead.phone.replace(/\D/g, "");
    const cleanPhone = phone.length > 10 ? phone.slice(-10) : phone;
    setSelectedConversation({
      sender_id: cleanPhone,
      sender_name: lead.full_name,
      sender_profile_pic: null,
      platform: "whatsapp",
      last_message: "",
      last_time: new Date().toISOString(),
      unread_count: 0,
      is_starred: false,
      is_interested: null,
      lead_id: lead.id,
      lead_name: lead.full_name,
      lead_status: lead.status,
      assigned_to: null,
      loan_type: lead.loan_type,
      loan_amount: lead.loan_amount,
      email: lead.email,
      city: lead.city,
      monthly_income: null,
      contact_created_at: null,
    });
    setShowNewConversation(false);
    setLeadSearchQuery("");
    setSearchedLeads([]);
  };

  const handleStartNewConversation = async () => {
    if (!newContactPhone.trim()) return;
    const phone = newContactPhone.replace(/\D/g, "");
    setSelectedConversation({
      sender_id: phone,
      sender_name: null,
      sender_profile_pic: null,
      platform: "whatsapp",
      last_message: "",
      last_time: new Date().toISOString(),
      unread_count: 0,
      is_starred: false,
      is_interested: null,
      lead_id: null,
      lead_name: null,
      lead_status: null,
      assigned_to: null,
      loan_type: null,
      loan_amount: null,
      email: null,
      city: null,
      monthly_income: null,
      contact_created_at: null,
    });
    setShowNewConversation(false);
    setNewContactPhone("");
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "whatsapp":
        return <WhatsAppIcon size="sm" className="text-[#25D366]" />;
      case "facebook":
        return <Facebook className="w-4 h-4 text-[#1877F2]" />;
      case "instagram":
        return <Instagram className="w-4 h-4 text-[#E4405F]" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
      case "sent":
        return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
      case "sending":
        return <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "read": return "Read";
      case "delivered": return "Delivered";
      case "sent": return "Sent";
      case "sending": return "Sending…";
      case "failed": return "Failed";
      default: return "";
    }
  };

  const getLeadStatusBadge = (status: string | null) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      unpaid: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
      paid: "bg-green-500/20 text-green-700 border-green-500/30",
      verification: "bg-blue-500/20 text-blue-700 border-blue-500/30",
      approved: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
      lost: "bg-red-500/20 text-red-700 border-red-500/30",
    };
    return (
      <Badge variant="outline" className={`text-[10px] capitalize ${colors[status] || ""}`}>
        {status}
      </Badge>
    );
  };

  const filteredConversations = conversations.filter(c => 
    (c.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.sender_id.includes(searchQuery) ||
     c.lead_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.last_message.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (filterTab === "all" ||
     (filterTab === "starred" && c.is_starred) ||
     (filterTab === "unread" && c.unread_count > 0))
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const interestedCount = conversations.filter(c => c.is_interested).length;
  const needsAgentCount = conversations.filter(c => c.needs_agent).length;

  const openDirect = (conversation: Conversation) => {
    if (conversation.platform === "whatsapp") {
      const cleanPhone = conversation.sender_id.replace(/\D/g, "");
      const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      window.open(`https://wa.me/${fullPhone}`, "_blank");
    }
  };

  return (
    <div className="-m-3 lg:-m-6">
      {/* Compact Top Bar */}
      <div className="flex items-center gap-1.5 border-b bg-card px-2 py-1 h-10">
        <div className="flex items-center gap-1.5 px-2">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Chats</span>
        </div>

        {/* Show locked account label — derived from company context */}
        {inboxTab === "external" && (() => {
          const activeAccountId = currentCompany
            ? waAccounts.find(a => a.company_id === currentCompany.id)?.id
            : selectedAccountId;
          const acc = activeAccountId ? waAccounts.find(a => a.id === activeAccountId) : null;
          if (!acc && currentCompany) {
            return (
              <div className="flex items-center gap-1.5 px-2 py-0.5 border rounded-md bg-muted/50 h-7 ml-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-[11px] text-muted-foreground">No WA account for {currentCompany.name}</span>
              </div>
            );
          }
          if (!acc && !currentCompany) {
            return (
              <div className="flex items-center gap-1.5 px-2 py-0.5 border rounded-md bg-muted/50 h-7 ml-1">
                <span className="text-[11px] text-muted-foreground">All Companies</span>
              </div>
            );
          }
          return acc ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 border rounded-md bg-muted/50 h-7 ml-1">
              <div className={`w-1.5 h-1.5 rounded-full ${acc.status === "connected" ? "bg-green-500" : "bg-red-400"}`} />
              <span className="text-[11px] font-medium truncate max-w-[140px]">
                {acc.name} {acc.phone_number ? `(${acc.phone_number})` : ""}
              </span>
              {acc.chatbot_enabled && <Bot className="w-3 h-3 text-muted-foreground" />}
            </div>
          ) : null;
        })()}

        <div className="ml-auto flex items-center gap-0.5">
          {inboxTab === "external" && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNewConversation(true)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchConversations}>
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </>
          )}
        </div>
      </div>

      {
      <>
      <div className="flex" style={{ height: 'calc(100vh - 40px)' }}>
        {/* Conversations List */}
        <div className={`${selectedConversation ? "hidden sm:flex" : "flex"} w-full sm:w-72 lg:w-80 border-r flex-col bg-card`}>
          {/* Filters - horizontal scroll on mobile */}
          <div className="px-2 pt-1.5 pb-1 border-b space-y-1.5">
            <div className="flex gap-1 overflow-x-auto no-scrollbar items-center">
              {[
                { key: "my_leads", label: "My Leads" },
                { key: "all", label: "All" },
                { key: "unassigned", label: "New" },
                { key: "needs_agent", label: `🆘 ${needsAgentCount || ""}` },
                { key: "interested", label: `❤️ ${interestedCount || ""}` },
              ].map((filter) => (
                <button
                  key={filter.key}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors ${
                    leadFilter === filter.key
                      ? filter.key === "interested" ? "bg-green-600 text-white" 
                        : filter.key === "needs_agent" ? "bg-red-600 text-white"
                        : "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => { setLeadFilter(filter.key as LeadFilter); setSelectedAgentId(null); }}
                >
                  {filter.label}
                </button>
              ))}
              {isAdmin && staffList.length > 0 && (
                <Select
                  value={leadFilter === "agent" ? (selectedAgentId || "") : ""}
                  onValueChange={(val) => {
                    setSelectedAgentId(val);
                    setLeadFilter("agent");
                  }}
                >
                  <SelectTrigger className={`h-6 text-[11px] w-auto min-w-[80px] rounded-full border-0 ${
                    leadFilter === "agent" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Users className="w-3 h-3 mr-1" />
                    <SelectValue placeholder="Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-7 text-xs rounded-full bg-muted border-0"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {leadFilter === "my_leads" ? "No leads assigned to you" : 
                   leadFilter === "interested" ? "No interested leads" : "No conversations yet"}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedConversation?.sender_id === conv.sender_id && selectedConversation?.platform === conv.platform;
                if (!conv.last_time) console.warn("[Inbox] Missing last_time for:", conv.lead_name || conv.sender_id);
                const msgDate = conv.last_time ? new Date(conv.last_time) : null;
                const now = new Date();
                let timeStr = "";
                if (msgDate && !isNaN(msgDate.getTime())) {
                  const isToday = msgDate.toDateString() === now.toDateString();
                  const yesterday = new Date(now);
                  yesterday.setDate(yesterday.getDate() - 1);
                  const isYesterday = msgDate.toDateString() === yesterday.toDateString();
                  timeStr = isToday ? format(msgDate, "hh:mm a") : isYesterday ? "Yesterday" : format(msgDate, "dd/MM/yy");
                }

                return (
                  <div
                    key={conv.platform === "whatsapp" && conv.account_id ? `${conv.platform}-${conv.account_id}-${conv.sender_id}` : `${conv.platform}-${conv.sender_id}`}
                    onClick={() => setSelectedConversation(conv)}
                    className={`px-3 py-2 cursor-pointer transition-colors border-b border-border/50 ${
                      isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={conv.sender_profile_pic || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {conv.sender_name?.[0]?.toUpperCase() || conv.lead_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        {conv.unread_count > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                            {conv.unread_count > 9 ? "9+" : conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-[13px] truncate flex-1 ${conv.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
                            {conv.lead_name || conv.sender_name || conv.sender_id}
                          </p>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {conv.is_interested && <Heart className="w-3 h-3 text-green-600 fill-green-600" />}
                            {timeStr && timeStr !== "Invalid Date" && (
                              <span className={`text-[10px] ${conv.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                                {timeStr}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {conv.needs_agent && (
                            <div className="flex items-center gap-1">
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                🆘 Agent
                              </Badge>
                              <SLATimer requestTime={conv.last_time} slaMinutes={15} />
                            </div>
                          )}
                          {getLeadStatusBadge(conv.lead_status)}
                          <p className="text-[11px] text-muted-foreground truncate flex-1">
                            {conv.last_message && conv.last_message.length > 35
                              ? conv.last_message.substring(0, 35) + "..."
                              : conv.last_message || ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>

      {/* Chat Area */}
        <div className={`${selectedConversation ? "flex" : "hidden sm:flex"} flex-1 flex-col bg-background relative`}>
          {selectedConversation ? (
            <>
              {/* Chat Header - sticky */}
              <div className="sticky top-0 z-10 px-3 py-2 flex items-center gap-3 border-b bg-card shadow-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden shrink-0" onClick={() => setSelectedConversation(null)}>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </Button>
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {(selectedConversation.lead_name || selectedConversation.sender_name || "?")?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate leading-tight">
                    {selectedConversation.lead_name || selectedConversation.sender_name || "Unknown Contact"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span className="font-medium">{formatPhone10(selectedConversation.sender_id)}</span>
                    {selectedConversation.loan_amount && (
                      <>
                        <span>•</span>
                        <span className="text-primary font-semibold">₹{selectedConversation.loan_amount.toLocaleString("en-IN")}</span>
                      </>
                    )}
                    {selectedConversation.loan_type && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline capitalize">{selectedConversation.loan_type.replace(/_/g, " ")}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Resolve agent request button */}
                  {selectedConversation.needs_agent && (
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 hover:bg-red-200 text-red-700 transition-colors text-xs font-medium"
                      onClick={() => handleResolveAgentRequest(selectedConversation)}
                      title="Resolve agent request"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Resolve</span>
                    </button>
                  )}
                  {selectedConversation.lead_id && (
                    <button
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      onClick={async () => {
                        if (!selectedConversation.lead_id) return;
                        const newVal = !selectedConversation.is_interested;
                        await supabase.from("leads").update({ is_interested: newVal }).eq("id", selectedConversation.lead_id);
                        setSelectedConversation({ ...selectedConversation, is_interested: newVal });
                        setConversations(prev => prev.map(c => c.lead_id === selectedConversation.lead_id ? { ...c, is_interested: newVal } : c));
                        toast.success(newVal ? "Marked Interested" : "Removed");
                      }}
                    >
                      <Heart className={`w-4 h-4 ${selectedConversation.is_interested ? "text-green-600 fill-green-600" : "text-muted-foreground"}`} />
                    </button>
                  )}
                  {getLeadStatusBadge(selectedConversation.lead_status)}
                  <button className="p-1.5 rounded-md hover:bg-muted transition-colors" onClick={() => openDirect(selectedConversation)}>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="p-1.5 rounded-md hover:bg-muted transition-colors" onClick={() => setShowContactPanel(!showContactPanel)}>
                    <User className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Messages area */}
                <ScrollArea className="flex-1 p-4 bg-[#ECE5DD]/30">
                  <div className="space-y-1">
                    {messages.map((msg, idx) => {
                      const msgDate = new Date(msg.created_at);
                      const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
                      const showDateSep = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
                      const now = new Date();
                      const isToday = msgDate.toDateString() === now.toDateString();
                      const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                      const isYesterday = msgDate.toDateString() === yest.toDateString();
                      const dateLabel = isToday ? "Today" : isYesterday ? "Yesterday" : format(msgDate, "dd MMMM yyyy");

                      return (
                        <div key={msg.id}>
                          {showDateSep && (
                            <div className="flex items-center justify-center my-3">
                              <span className="text-[11px] px-3 py-1 rounded-lg bg-white/80 text-muted-foreground shadow-sm border">
                                {dateLabel}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"} mb-0.5`}>
                            <div
                              className={`max-w-[80%] sm:max-w-[65%] rounded-lg shadow-sm overflow-hidden ${
                                msg.direction === "outgoing"
                                  ? "bg-[#DCF8C6] rounded-tr-none"
                                  : "bg-white rounded-tl-none"
                              }`}
                            >
                              {/* Template header image */}
                              {msg.message_type === "template" && (() => {
                                const matchedTemplate = templates.find(t => 
                                  msg.content?.includes(t.content?.substring(0, 30)) || 
                                  msg.content?.toLowerCase().includes(t.name.toLowerCase())
                                );
                                if (matchedTemplate?.header_type === "IMAGE" && matchedTemplate?.header_url) {
                                    return (
                                      <img 
                                        src={matchedTemplate.header_url} 
                                        alt="Template header" 
                                        className="w-full object-contain rounded-t-lg"
                                        style={{ maxHeight: '280px' }}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                    );
                                }
                                return null;
                              })()}
                              {/* Media content (images, audio, video, documents) */}
                              {msg.media_url && ["image", "sticker"].includes(msg.message_type) && (
                                <img 
                                  src={msg.media_url} 
                                  alt={msg.content || "Image"} 
                                  className="w-full max-h-[300px] object-contain cursor-pointer rounded-t-lg"
                                  onClick={() => window.open(msg.media_url!, "_blank")}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              {msg.media_url && msg.message_type === "video" && (
                                <video 
                                  src={msg.media_url} 
                                  controls 
                                  className="w-full max-h-[300px] rounded-t-lg"
                                />
                              )}
                              {msg.media_url && msg.message_type === "audio" && (
                                <audio src={msg.media_url} controls className="w-full mt-1" />
                              )}
                              {msg.media_url && msg.message_type === "document" && (
                                <a 
                                  href={msg.media_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="flex items-center gap-2 p-2 bg-muted/50 rounded mb-1 hover:bg-muted"
                                >
                                  <FileText className="w-5 h-5 text-primary" />
                                  <span className="text-xs text-primary underline">View Document</span>
                                </a>
                              )}
                              {/* Fallback for media without URL */}
                              {!msg.media_url && ["image", "video", "audio", "document", "sticker"].includes(msg.message_type) && (
                                <div className="flex items-center gap-1 p-2 text-muted-foreground">
                                  <Paperclip className="w-3 h-3" />
                                  <span className="text-xs italic">{msg.message_type} (not available)</span>
                                </div>
                              )}
                              <div className="px-3 py-1.5">
                                {msg.message_type === "template" && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <FileText className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] font-semibold text-primary">Template</span>
                                  </div>
                                )}
                                {/* Hide [image]/[video]/[audio] placeholder text when media is shown */}
                                {!(msg.media_url && ["image", "video", "audio", "sticker"].includes(msg.message_type) && msg.content?.startsWith("[")) && (
                                <p className="text-[14px] text-foreground whitespace-pre-wrap leading-relaxed">
                                  {msg.content?.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                                    /^https?:\/\//.test(part) ? (
                                      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-800">
                                        {part}
                                      </a>
                                    ) : part
                                  )}
                                </p>
                                )}
                                <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(msgDate, "hh:mm a")}
                                  </span>
                                  {msg.direction === "outgoing" && (
                                    <span className="flex items-center gap-0.5" title={getStatusLabel(msg.status)}>
                                      {getStatusIcon(msg.status)}
                                      {msg.status === "failed" && <span className="text-[9px] text-red-500">Failed</span>}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Contact Panel - mobile friendly via sheet-style overlay on small screens */}
                {showContactPanel && selectedConversation && (
                  <div className="absolute right-0 top-0 bottom-0 w-full sm:w-72 sm:relative sm:flex border-l bg-card overflow-hidden flex-col z-10 flex">
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                        {/* Close button for mobile */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:hidden absolute top-2 right-2 z-20" onClick={() => setShowContactPanel(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <div className="text-center pb-4 border-b">
                          <Avatar className="h-16 w-16 mx-auto mb-2">
                            <AvatarImage src={selectedConversation.sender_profile_pic || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xl">
                              {selectedConversation.lead_name?.[0] || selectedConversation.sender_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <h4 className="font-semibold">
                            {selectedConversation.lead_name || selectedConversation.sender_name || "Unknown"}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {selectedConversation.platform === "whatsapp" ? formatPhone10(selectedConversation.sender_id) : selectedConversation.sender_id}
                          </p>
                          {selectedConversation.lead_id && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs mt-1 h-auto p-0"
                              onClick={() => window.open(`/admin/dashboard?lead=${selectedConversation.lead_id}`, "_blank")}
                            >
                              View Full Profile →
                            </Button>
                          )}
                        </div>

                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <User className="w-3 h-3" /> Contact Info
                          </h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              {getPlatformIcon(selectedConversation.platform)}
                              <span className="capitalize">{selectedConversation.platform}</span>
                            </div>
                            {selectedConversation.platform === "whatsapp" && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>{formatPhone10(selectedConversation.sender_id)}</span>
                              </div>
                            )}
                            {selectedConversation.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs truncate">{selectedConversation.email}</span>
                              </div>
                            )}
                            {selectedConversation.city && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>{selectedConversation.city}</span>
                              </div>
                            )}
                            {selectedConversation.contact_created_at && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs">Added {format(new Date(selectedConversation.contact_created_at), "dd MMM yyyy")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedConversation.lead_id && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Lead Details
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Status</span>
                                {getLeadStatusBadge(selectedConversation.lead_status)}
                              </div>
                              {selectedConversation.loan_type && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Loan Type</span>
                                  <span className="font-medium capitalize">{selectedConversation.loan_type}</span>
                                </div>
                              )}
                              {selectedConversation.loan_amount && (
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Amount</span>
                                  <span className="font-medium flex items-center gap-1">
                                    <IndianRupee className="w-3 h-3" />
                                    {selectedConversation.loan_amount.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              )}
                              {selectedConversation.monthly_income && (
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Income</span>
                                  <span className="font-medium flex items-center gap-1">
                                    <IndianRupee className="w-3 h-3" />
                                    {selectedConversation.monthly_income.toLocaleString("en-IN")}/mo
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Tags
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {selectedConversation.platform}
                            </Badge>
                            {selectedConversation.lead_id && (
                              <Badge variant="secondary" className="text-xs">Lead</Badge>
                            )}
                            {selectedConversation.loan_type && (
                              <Badge variant="outline" className="text-xs capitalize">{selectedConversation.loan_type}</Badge>
                            )}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Edit2 className="w-3 h-3" /> Notes
                          </h5>
                          <Textarea
                            placeholder="Add a note..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="text-xs min-h-[60px] resize-none"
                          />
                          {newNote && (
                            <Button size="sm" className="mt-2 w-full h-7 text-xs">
                              Save Note
                            </Button>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* 24h window notice */}
              {is24hWindowClosed && selectedConversation.platform === "whatsapp" && (
                <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">24-hour window closed.</span> You can only send approved templates to re-engage this customer.
                  </p>
                </div>
              )}

              {/* Message Input - compact */}
              <div className="px-2 py-1.5 border-t bg-card">
                {selectedTemplate && (
                  <div className="mb-1.5 p-2 rounded-lg bg-muted/80 border border-primary/20">
                    {selectedTemplate.header_type === "IMAGE" && selectedTemplate.header_url && (
                      <img src={selectedTemplate.header_url} alt="" className="w-full max-h-32 object-contain rounded mb-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-primary">📋 {selectedTemplate.name}</span>
                      <button onClick={clearSelectedTemplate} className="p-0.5 hover:bg-muted rounded">
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{selectedTemplate.content.substring(0, 100)}...</p>
                    {templateParams.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {templateParams.map((p, i) => {
                          const paramLabels = ["Name", "Amount", "Type", "City"];
                          return (
                            <Input
                              key={i}
                              placeholder={paramLabels[i] || `#${i + 1}`}
                              value={p}
                              onChange={(e) => {
                                const newParams = [...templateParams];
                                newParams[i] = e.target.value;
                                setTemplateParams(newParams);
                              }}
                              className="h-6 text-[11px] w-24 flex-1 min-w-[80px]"
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {showTemplates && templates.length > 0 && (
                  <div className="mb-1.5 max-h-52 overflow-y-auto rounded-lg bg-card border shadow-lg">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-xs transition-colors border-b border-border/30 last:border-0 flex items-start gap-2"
                      >
                        {t.header_type === "IMAGE" && t.header_url && (
                          <img src={t.header_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{t.name}</span>
                            {t.category && <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{t.category}</span>}
                          </div>
                          <p className="text-muted-foreground truncate text-[10px] mt-0.5">{t.content.substring(0, 60)}...</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <CannedResponses
                    onSelect={(text) => setNewMessage(text)}
                    customerName={selectedConversation?.lead_name || selectedConversation?.sender_name || ""}
                    companyName={currentCompany?.name || "Hariox"}
                  />
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors" onClick={() => setShowTemplates(!showTemplates)} title="Templates">
                    <FileText className={`w-5 h-5 ${showTemplates ? "text-primary" : is24hWindowClosed ? "text-amber-500" : "text-muted-foreground"}`} />
                  </button>
                  <Input
                    placeholder={selectedTemplate ? `Send: ${selectedTemplate.name}` : is24hWindowClosed ? "Select a template to send →" : "Type a message..."}
                    value={newMessage}
                    onChange={(e) => { if (!selectedTemplate && !is24hWindowClosed) setNewMessage(e.target.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (is24hWindowClosed && !selectedTemplate) { toast.error("24h window expired. Please select a template."); return; } handleSendMessage(); } }}
                    className="flex-1 h-9 text-sm rounded-full bg-muted border-0 px-4"
                    readOnly={!!selectedTemplate || is24hWindowClosed}
                  />
                  <button 
                    onClick={handleSendMessage} 
                    disabled={isSending}
                    className="p-2 rounded-full bg-[#25D366] hover:bg-[#1DA851] text-white disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/10">
              <div className="text-center px-4">
                <WhatsAppIcon size="xl" className="text-muted-foreground/20 w-16 h-16 mx-auto mb-4" />
                <h3 className="text-base font-semibold mb-1 text-foreground">WhatsApp Inbox</h3>
                <p className="text-xs text-muted-foreground mb-3">Select a chat or start a new conversation</p>
                <Button size="sm" onClick={() => setShowNewConversation(true)} className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  New Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
          </DialogHeader>
          <Tabs value={newChatTab} onValueChange={(v) => setNewChatTab(v as "phone" | "lead")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lead">Search Lead</TabsTrigger>
              <TabsTrigger value="phone">Enter Phone</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {newChatTab === "lead" ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, phone, or email..."
                      value={leadSearchQuery}
                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <ScrollArea className="h-60">
                    {isSearchingLeads ? (
                      <div className="text-center py-8 text-muted-foreground">Searching...</div>
                    ) : searchedLeads.length > 0 ? (
                      <div className="space-y-1">
                        {searchedLeads.map((lead) => (
                          <div
                            key={lead.id}
                            onClick={() => handleSelectLead(lead)}
                            className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {lead.full_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{lead.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{lead.phone} • {lead.city}</p>
                              </div>
                              {getLeadStatusBadge(lead.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : leadSearchQuery.length >= 2 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">No leads found</div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">Type to search leads...</div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Phone Number</label>
                    <Input
                      placeholder="Enter 10-digit phone number"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleStartNewConversation} disabled={newContactPhone.length !== 10} className="w-full">
                    Start Chat
                  </Button>
                </div>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
      </>
      }
    </div>
  );
};

export default UnifiedInbox;
