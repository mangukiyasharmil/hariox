import { useState, useEffect, useRef } from "react";
import {
  Send, Search, Users, Plus, ArrowLeft, Check, CheckCheck, Paperclip, X,
  UserPlus, Settings, Image as ImageIcon, File, Crown, LogOut, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChatItem {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  members: { user_id: string; role: string; name: string }[];
}

interface InternalMsg {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  read_by: string[];
}

interface StaffMember {
  user_id: string;
  full_name: string;
  role: string;
}

const InternalChat = () => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<InternalMsg[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchChats();
      fetchStaff();
    }
  }, [currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`internal-chat-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, (payload) => {
        const msg = payload.new as any;
        if (selectedChat && msg.chat_id === selectedChat.id) {
          const senderName = profileMap[msg.sender_id] || "Unknown";
          setMessages(prev => [...prev, { ...msg, sender_name: senderName, read_by: [] }]);
          // Mark as read
          markMessageRead(msg.id);
        }
        fetchChats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat, currentUserId, profileMap]);

  const initUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUserId(session.user.id);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      setIsAdmin(roles?.some(r => r.role === "admin") || false);
    }
  };

  const fetchStaff = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const pMap: Record<string, string> = {};
    (profiles || []).forEach(p => { pMap[p.user_id] = p.full_name; });
    setProfileMap(pMap);
    const staff: StaffMember[] = (roles || []).map(r => ({
      user_id: r.user_id,
      full_name: pMap[r.user_id] || "Unknown",
      role: r.role,
    })).filter(s => s.user_id !== currentUserId);
    setStaffList(staff);
  };

  const fetchChats = async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    try {
      // Get chats user is member of
      const { data: memberOf } = await supabase
        .from("internal_chat_members")
        .select("chat_id")
        .eq("user_id", currentUserId);

      if (!memberOf?.length) { setChats([]); setIsLoading(false); return; }

      const chatIds = memberOf.map(m => m.chat_id);
      const { data: chatData } = await supabase
        .from("internal_chats")
        .select("*")
        .in("id", chatIds)
        .order("updated_at", { ascending: false });

      if (!chatData) { setChats([]); setIsLoading(false); return; }

      // Get all members for these chats
      const { data: allMembers } = await supabase
        .from("internal_chat_members")
        .select("chat_id, user_id, role")
        .in("chat_id", chatIds);

      // Get latest message per chat
      const { data: latestMsgs } = await supabase
        .from("internal_messages")
        .select("chat_id, content, created_at, sender_id")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false });

      // Get unread counts
      const { data: allMsgs } = await supabase
        .from("internal_messages")
        .select("id, chat_id")
        .in("chat_id", chatIds);

      const { data: myReads } = await supabase
        .from("internal_message_reads")
        .select("message_id")
        .eq("user_id", currentUserId);

      const readIds = new Set((myReads || []).map(r => r.message_id));

      // Build profile map if needed
      const allUserIds = new Set<string>();
      (allMembers || []).forEach(m => allUserIds.add(m.user_id));
      (latestMsgs || []).forEach(m => allUserIds.add(m.sender_id));
      
      if (allUserIds.size > 0) {
        const { data: newProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", Array.from(allUserIds));
        const newMap = { ...profileMap };
        (newProfiles || []).forEach(p => { newMap[p.user_id] = p.full_name; });
        setProfileMap(newMap);
      }

      const chatItems: ChatItem[] = chatData.map(chat => {
        const members = (allMembers || [])
          .filter(m => m.chat_id === chat.id)
          .map(m => ({ user_id: m.user_id, role: m.role, name: profileMap[m.user_id] || "Unknown" }));

        const lastMsg = (latestMsgs || []).find(m => m.chat_id === chat.id);
        const chatMsgIds = (allMsgs || []).filter(m => m.chat_id === chat.id).map(m => m.id);
        const unread = chatMsgIds.filter(id => !readIds.has(id)).length;

        // For 1:1, show other person's name
        let displayName = chat.name;
        if (!chat.is_group) {
          const other = members.find(m => m.user_id !== currentUserId);
          displayName = other ? (profileMap[other.user_id] || other.name) : "Chat";
        }

        return {
          id: chat.id,
          name: displayName,
          is_group: chat.is_group,
          created_by: chat.created_by,
          last_message: lastMsg ? (lastMsg.content || "[File]") : "",
          last_time: lastMsg?.created_at || chat.created_at,
          unread_count: unread,
          members,
        };
      });

      chatItems.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
      setChats(chatItems);
    } catch (err) {
      console.error("Error fetching internal chats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const { data } = await supabase
        .from("internal_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      const msgIds = (data || []).map(m => m.id);
      const { data: reads } = await supabase
        .from("internal_message_reads")
        .select("message_id, user_id")
        .in("message_id", msgIds.length > 0 ? msgIds : ["none"]);

      const readMap: Record<string, string[]> = {};
      (reads || []).forEach(r => {
        if (!readMap[r.message_id]) readMap[r.message_id] = [];
        readMap[r.message_id].push(r.user_id);
      });

      const msgs: InternalMsg[] = (data || []).map(m => ({
        id: m.id,
        chat_id: m.chat_id,
        sender_id: m.sender_id,
        sender_name: profileMap[m.sender_id] || "Unknown",
        content: m.content,
        message_type: m.message_type,
        file_url: m.file_url,
        file_name: m.file_name,
        created_at: m.created_at,
        read_by: readMap[m.id] || [],
      }));

      setMessages(msgs);

      // Mark all as read
      const unread = msgIds.filter(id => !(readMap[id] || []).includes(currentUserId!));
      if (unread.length > 0) {
        const inserts = unread.map(id => ({ message_id: id, user_id: currentUserId! }));
        await supabase.from("internal_message_reads").upsert(inserts, { onConflict: "message_id,user_id" });
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const markMessageRead = async (messageId: string) => {
    if (!currentUserId) return;
    await supabase.from("internal_message_reads").upsert(
      { message_id: messageId, user_id: currentUserId },
      { onConflict: "message_id,user_id" }
    );
  };

  const handleSelectChat = (chat: ChatItem) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !currentUserId) return;
    setIsSending(true);
    try {
      await supabase.from("internal_messages").insert({
        chat_id: selectedChat.id,
        sender_id: currentUserId,
        content: newMessage.trim(),
        message_type: "text",
      });
      // Update chat timestamp
      await supabase.from("internal_chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChat.id);

      // Create notification for other members
      const otherMembers = selectedChat.members.filter(m => m.user_id !== currentUserId);
      if (otherMembers.length > 0) {
        const notifications = otherMembers.map(m => ({
          user_id: m.user_id,
          type: "internal_message",
          title: selectedChat.is_group ? `${selectedChat.name}` : "New Message",
          message: `${profileMap[currentUserId] || "Someone"}: ${newMessage.trim().substring(0, 80)}`,
          link: "/admin/dashboard/inbox",
          metadata: { chat_id: selectedChat.id },
        }));
        await supabase.from("staff_notifications").insert(notifications);
      }

      setNewMessage("");
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || !currentUserId) return;

    try {
      const ext = file.name.split(".").pop();
      const path = `internal-chat/${selectedChat.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      const isImage = file.type.startsWith("image/");

      await supabase.from("internal_messages").insert({
        chat_id: selectedChat.id,
        sender_id: currentUserId,
        content: isImage ? null : file.name,
        message_type: isImage ? "image" : "file",
        file_url: urlData.publicUrl,
        file_name: file.name,
      });
      await supabase.from("internal_chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChat.id);

      fetchMessages(selectedChat.id);
      toast.success("File sent");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload file");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startDirectChat = async (staffMember: StaffMember) => {
    if (!currentUserId) return;
    try {
      // Check if 1:1 chat already exists
      const { data: myChats } = await supabase
        .from("internal_chat_members")
        .select("chat_id")
        .eq("user_id", currentUserId);

      const { data: theirChats } = await supabase
        .from("internal_chat_members")
        .select("chat_id")
        .eq("user_id", staffMember.user_id);

      const myIds = new Set((myChats || []).map(c => c.chat_id));
      const commonIds = (theirChats || []).filter(c => myIds.has(c.chat_id)).map(c => c.chat_id);

      if (commonIds.length > 0) {
        const { data: existing } = await supabase
          .from("internal_chats")
          .select("*")
          .in("id", commonIds)
          .eq("is_group", false)
          .limit(1);

        if (existing?.length) {
          const chat = chats.find(c => c.id === existing[0].id) || {
            id: existing[0].id, name: staffMember.full_name, is_group: false,
            created_by: existing[0].created_by, last_message: "", last_time: existing[0].updated_at,
            unread_count: 0, members: [],
          };
          handleSelectChat(chat);
          setShowNewChat(false);
          return;
        }
      }

      // Create new 1:1 chat
      const { data: newChat, error } = await supabase
        .from("internal_chats")
        .insert({ is_group: false, created_by: currentUserId })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("internal_chat_members").insert([
        { chat_id: newChat.id, user_id: currentUserId, role: "admin" },
        { chat_id: newChat.id, user_id: staffMember.user_id, role: "member" },
      ]);

      await fetchChats();
      const created = { id: newChat.id, name: staffMember.full_name, is_group: false,
        created_by: currentUserId, last_message: "", last_time: newChat.created_at,
        unread_count: 0, members: [
          { user_id: currentUserId, role: "admin", name: profileMap[currentUserId] || "You" },
          { user_id: staffMember.user_id, role: "member", name: staffMember.full_name },
        ],
      };
      handleSelectChat(created);
      setShowNewChat(false);
      toast.success(`Chat started with ${staffMember.full_name}`);
    } catch (err) {
      console.error("Error creating chat:", err);
      toast.error("Failed to create chat");
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !currentUserId) return;
    try {
      const { data: newChat, error } = await supabase
        .from("internal_chats")
        .insert({ name: groupName.trim(), is_group: true, created_by: currentUserId })
        .select()
        .single();

      if (error) throw error;

      const members = [
        { chat_id: newChat.id, user_id: currentUserId, role: "admin" },
        ...selectedMembers.map(uid => ({ chat_id: newChat.id, user_id: uid, role: "member" })),
      ];
      await supabase.from("internal_chat_members").insert(members);

      await fetchChats();
      setShowGroupCreate(false);
      setGroupName("");
      setSelectedMembers([]);
      toast.success("Group created");
    } catch (err) {
      console.error("Error creating group:", err);
      toast.error("Failed to create group");
    }
  };

  const addMemberToGroup = async (userId: string) => {
    if (!selectedChat) return;
    try {
      await supabase.from("internal_chat_members").insert({ chat_id: selectedChat.id, user_id: userId, role: "member" });
      await fetchChats();
      if (selectedChat) fetchMessages(selectedChat.id);
      toast.success("Member added");
    } catch (err) {
      toast.error("Failed to add member");
    }
  };

  const removeMemberFromGroup = async (userId: string) => {
    if (!selectedChat) return;
    try {
      await supabase.from("internal_chat_members").delete().eq("chat_id", selectedChat.id).eq("user_id", userId);
      await fetchChats();
      toast.success("Member removed");
    } catch (err) {
      toast.error("Failed to remove member");
    }
  };

  const totalUnread = chats.reduce((s, c) => s + c.unread_count, 0);

  const filteredChats = chats.filter(c =>
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.last_message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* Chat List */}
      <div className={`${selectedChat ? "hidden sm:flex" : "flex"} w-full sm:w-72 lg:w-80 border-r flex-col bg-card`}>
        <div className="p-2 border-b">
          <div className="flex items-center gap-1 mb-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => setShowNewChat(true)}>
              <Plus className="w-3 h-3 mr-1" /> New Chat
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => setShowGroupCreate(true)}>
                <Users className="w-3 h-3 mr-1" /> New Group
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No internal chats yet</p>
              <p className="text-xs mt-1">Start a chat with a team member</p>
            </div>
          ) : (
            filteredChats.map(chat => {
              const isSelected = selectedChat?.id === chat.id;
              const msgDate = new Date(chat.last_time);
              const now = new Date();
              const isToday = msgDate.toDateString() === now.toDateString();
              const yest = new Date(now); yest.setDate(yest.getDate() - 1);
              const isYesterday = msgDate.toDateString() === yest.toDateString();
              const timeStr = isToday ? format(msgDate, "hh:mm a") : isYesterday ? "Yesterday" : format(msgDate, "dd/MM/yy");

              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`px-3 py-2.5 cursor-pointer transition-colors border-b ${isSelected ? "bg-accent" : "hover:bg-muted/50"}`}
                >
                  <div className="flex items-start gap-2.5">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className={`text-sm font-medium ${chat.is_group ? "bg-blue-100 text-blue-700" : "bg-primary/10 text-primary"}`}>
                        {chat.is_group ? <Users className="w-4 h-4" /> : (chat.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-medium text-sm truncate">{chat.name || "Chat"}</p>
                        <span className={`text-[10px] shrink-0 ${chat.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{timeStr}</span>
                      </div>
                      {chat.is_group && (
                        <p className="text-[10px] text-muted-foreground">{chat.members.length} members</p>
                      )}
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground truncate flex-1">{chat.last_message || "No messages yet"}</p>
                        {chat.unread_count > 0 && (
                          <span className="rounded-full h-4.5 min-w-[18px] flex items-center justify-center text-[10px] bg-primary text-primary-foreground font-medium ml-1.5">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Message Area */}
      <div className={`${selectedChat ? "flex" : "hidden sm:flex"} flex-1 flex-col bg-muted/20`}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between border-b bg-card">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" onClick={() => setSelectedChat(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={selectedChat.is_group ? "bg-blue-100 text-blue-700" : "bg-primary/10 text-primary"}>
                    {selectedChat.is_group ? <Users className="w-4 h-4" /> : (selectedChat.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedChat.name || "Chat"}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedChat.is_group
                      ? `${selectedChat.members.length} members`
                      : "Direct message"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedChat.is_group && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMembersPanel(!showMembersPanel)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-1">
                  {messages.map((msg, idx) => {
                    const isMe = msg.sender_id === currentUserId;
                    const msgDate = new Date(msg.created_at);
                    const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
                    const showDateSep = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
                    const now = new Date();
                    const isToday = msgDate.toDateString() === now.toDateString();
                    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                    const isYesterday = msgDate.toDateString() === yest.toDateString();
                    const dateLabel = isToday ? "Today" : isYesterday ? "Yesterday" : format(msgDate, "dd MMMM yyyy");
                    const allOtherMembers = selectedChat.members.filter(m => m.user_id !== msg.sender_id);
                    const readByAll = allOtherMembers.every(m => msg.read_by.includes(m.user_id));
                    const readBySome = msg.read_by.filter(id => id !== msg.sender_id).length > 0;

                    return (
                      <div key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center justify-center my-3">
                            <span className="text-[11px] px-3 py-1 rounded-lg bg-white/80 text-muted-foreground shadow-sm border">{dateLabel}</span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
                          <div className={`max-w-[75%] ${isMe ? "bg-primary text-primary-foreground" : "bg-card border"} rounded-xl px-3 py-2 shadow-sm`}>
                            {!isMe && selectedChat.is_group && (
                              <p className="text-[10px] font-semibold mb-0.5 opacity-80">{msg.sender_name}</p>
                            )}
                            {msg.message_type === "image" && msg.file_url && (
                              <img src={msg.file_url} alt="" className="rounded-lg max-w-[200px] mb-1 cursor-pointer" onClick={() => window.open(msg.file_url!, "_blank")} />
                            )}
                            {msg.message_type === "file" && msg.file_url && (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-black/10 mb-1 hover:bg-black/20 transition-colors">
                                <File className="w-4 h-4" />
                                <span className="text-xs truncate">{msg.file_name || "File"}</span>
                              </a>
                            )}
                            {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className={`text-[10px] ${isMe ? "opacity-70" : "text-muted-foreground"}`}>
                                {format(msgDate, "hh:mm a")}
                              </span>
                              {isMe && (
                                readByAll
                                  ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                                  : readBySome
                                    ? <CheckCheck className="w-3.5 h-3.5 opacity-60" />
                                    : <Check className="w-3.5 h-3.5 opacity-60" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Members panel for groups */}
              {showMembersPanel && selectedChat.is_group && (
                <div className="w-60 border-l bg-card p-3 hidden sm:block">
                  <h4 className="font-semibold text-sm mb-3">Members ({selectedChat.members.length})</h4>
                  <ScrollArea className="h-[calc(100%-80px)]">
                    <div className="space-y-2">
                      {selectedChat.members.map(m => (
                        <div key={m.user_id} className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{(profileMap[m.user_id] || m.name)?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{profileMap[m.user_id] || m.name}</p>
                            {m.role === "admin" && <Badge variant="secondary" className="text-[9px] px-1"><Crown className="w-2.5 h-2.5 mr-0.5" />Admin</Badge>}
                          </div>
                          {isAdmin && m.user_id !== currentUserId && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMemberFromGroup(m.user_id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {isAdmin && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium mb-2">Add Member</p>
                      {staffList.filter(s => !selectedChat.members.some(m => m.user_id === s.user_id)).slice(0, 5).map(s => (
                        <div key={s.user_id} className="flex items-center gap-2 py-1">
                          <p className="text-xs flex-1 truncate">{s.full_name}</p>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => addMemberToGroup(s.user_id)}>
                            <UserPlus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-2 border-t bg-card">
              <div className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="min-h-[36px] max-h-[100px] resize-none text-sm"
                  rows={1}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                  }}
                />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSendMessage} disabled={!newMessage.trim() || isSending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Internal Team Chat</p>
              <p className="text-sm mt-1">Select or start a conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Chat</DialogTitle></DialogHeader>
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {staffList.map(s => (
                <div
                  key={s.user_id}
                  onClick={() => startDirectChat(s)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{s.full_name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                  </div>
                </div>
              ))}
              {staffList.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No other staff members found</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={showGroupCreate} onOpenChange={setShowGroupCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group Name</label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Sales Team" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Select Members</label>
              <ScrollArea className="h-[200px] mt-2 border rounded-lg p-2">
                {staffList.map(s => (
                  <div key={s.user_id} className="flex items-center gap-3 py-2">
                    <Checkbox
                      checked={selectedMembers.includes(s.user_id)}
                      onCheckedChange={(checked) => {
                        setSelectedMembers(prev => checked ? [...prev, s.user_id] : prev.filter(id => id !== s.user_id));
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
            <Button onClick={createGroup} disabled={!groupName.trim() || selectedMembers.length === 0} className="w-full">
              Create Group ({selectedMembers.length} members)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InternalChat;
