import { useState, useEffect, useRef } from "react";
import { ClinicAdminLayout } from "@/components/clinic-admin/ClinicAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { 
  MessageCircle, 
  Send, 
  Search,
  Check,
  CheckCheck,
  User,
  ArrowLeft
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageAttachment, MessageFileDisplay, MessageFilePreview } from "@/components/crm/messages/MessageAttachment";

interface Patient {
  id: string;
  full_name: string;
  avatar_url: string | null;
  unreadCount?: number;
  lastMessage?: {
    content: string | null;
    created_at: string;
    sender_type: string;
  };
}

interface Message {
  id: string;
  clinic_id: string;
  patient_id: string;
  sender_id: string;
  sender_type: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  is_read: boolean;
  created_at: string;
}

export default function ClinicAdminMessages() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFile, setPendingFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load patients who have messages with the clinic
  useEffect(() => {
    if (currentClinic) {
      loadPatients();
    }
  }, [currentClinic]);

  // Load messages when patient is selected
  useEffect(() => {
    if (selectedPatient && currentClinic) {
      loadMessages(selectedPatient.id);
      markMessagesAsRead(selectedPatient.id);
    }
  }, [selectedPatient, currentClinic]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!currentClinic) return;

    const channel = supabase
      .channel('clinic-patient-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_messages',
          filter: `clinic_id=eq.${currentClinic.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // Add to messages if in current chat
          if (selectedPatient && newMsg.patient_id === selectedPatient.id) {
            setMessages(prev => [...prev, newMsg]);
            scrollToBottom();
            
            // Mark as read if from patient
            if (newMsg.sender_type === 'patient') {
              markMessagesAsRead(selectedPatient.id);
            }
          }
          
          // Update patient's last message and unread count
          updatePatientLastMessage(newMsg);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'patient_messages',
          filter: `clinic_id=eq.${currentClinic.id}`
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages(prev => 
            prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClinic, selectedPatient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadPatients = async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      // Get unique patient IDs from messages
      const { data: messagesData } = await supabase
        .from("patient_messages")
        .select("patient_id")
        .eq("clinic_id", currentClinic.id);

      const patientIds = [...new Set(messagesData?.map(m => m.patient_id) || [])];

      if (patientIds.length === 0) {
        setPatients([]);
        setLoading(false);
        return;
      }

      // Get patient profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", patientIds);

      if (!profilesData) {
        setPatients([]);
        setLoading(false);
        return;
      }

      // Get last messages and unread counts for each patient
      const patientsWithMessages = await Promise.all(
        profilesData.map(async (profile) => {
          // Get last message
          const { data: lastMsgData } = await supabase
            .from("patient_messages")
            .select("content, created_at, sender_type")
            .eq("clinic_id", currentClinic.id)
            .eq("patient_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count } = await supabase
            .from("patient_messages")
            .select("*", { count: "exact", head: true })
            .eq("clinic_id", currentClinic.id)
            .eq("patient_id", profile.id)
            .eq("sender_type", "patient")
            .eq("is_read", false);

          return {
            ...profile,
            lastMessage: lastMsgData || undefined,
            unreadCount: count || 0
          };
        })
      );

      // Sort by last message time
      patientsWithMessages.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });

      setPatients(patientsWithMessages);
    } catch (error) {
      console.error("Error loading patients:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (patientId: string) => {
    if (!currentClinic) return;

    const { data } = await supabase
      .from("patient_messages")
      .select("*")
      .eq("clinic_id", currentClinic.id)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  };

  const markMessagesAsRead = async (patientId: string) => {
    if (!currentClinic) return;

    await supabase
      .from("patient_messages")
      .update({ is_read: true })
      .eq("clinic_id", currentClinic.id)
      .eq("patient_id", patientId)
      .eq("sender_type", "patient")
      .eq("is_read", false);

    // Update local state
    setPatients(prev => 
      prev.map(p => 
        p.id === patientId ? { ...p, unreadCount: 0 } : p
      )
    );
  };

  const updatePatientLastMessage = (msg: Message) => {
    setPatients(prev => {
      const updated = prev.map(p => {
        if (p.id === msg.patient_id) {
          return {
            ...p,
            lastMessage: {
              content: msg.content,
              created_at: msg.created_at,
              sender_type: msg.sender_type
            },
            unreadCount: msg.sender_type === 'patient' 
              ? (p.unreadCount || 0) + 1 
              : p.unreadCount
          };
        }
        return p;
      });
      
      // Re-sort by last message time
      return updated.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });
    });
  };

  const sendMessage = async (fileUrl?: string, fileType?: string) => {
    if ((!newMessage.trim() && !fileUrl) || !selectedPatient || !user || !currentClinic || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");
    setPendingFile(null);

    try {
      const { data, error } = await supabase
        .from("patient_messages")
        .insert({
          clinic_id: currentClinic.id,
          patient_id: selectedPatient.id,
          sender_id: user.id,
          sender_type: "clinic",
          content: messageContent || null,
          file_url: fileUrl || null,
          file_type: fileType || null,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      // Add message to local state immediately
      if (data) {
        setMessages(prev => [...prev, data]);
        updatePatientLastMessage(data);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleFileSelected = (fileUrl: string, fileType: string, fileName: string) => {
    setPendingFile({ url: fileUrl, type: fileType, name: fileName });
  };

  const handleSendMessage = () => {
    sendMessage(pendingFile?.url, pendingFile?.type);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "HH:mm", { locale: ru });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Сегодня";
    if (isYesterday(date)) return "Вчера";
    return format(date, "d MMMM yyyy", { locale: ru });
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach(msg => {
      const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const filteredPatients = patients.filter(p => 
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <ClinicAdminLayout>
      <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col">
        <div className="p-4 lg:p-6 border-b border-border/50">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Сообщения
          </h1>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Patients List */}
          <div className={cn(
            "w-full md:w-80 lg:w-96 border-r border-border/50 flex flex-col",
            selectedPatient && "hidden md:flex"
          )}>
            {/* Search */}
            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск пациента..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Patients */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="p-8 text-center">
                  <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    {patients.length === 0 
                      ? "Нет сообщений от пациентов"
                      : "Пациенты не найдены"
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredPatients.map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={cn(
                        "w-full p-4 flex gap-3 hover:bg-muted/50 transition-colors text-left",
                        selectedPatient?.id === patient.id && "bg-muted"
                      )}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={patient.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(patient.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium text-foreground truncate">
                            {patient.full_name || "Пациент"}
                          </h3>
                          {patient.lastMessage && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatMessageTime(patient.lastMessage.created_at)}
                            </span>
                          )}
                        </div>
                        {patient.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {patient.lastMessage.sender_type === "clinic" && (
                              <span className="text-primary">Вы: </span>
                            )}
                            {patient.lastMessage.content || "[Файл]"}
                          </p>
                        )}
                      </div>
                      {(patient.unreadCount || 0) > 0 && (
                        <Badge className="bg-primary text-primary-foreground h-5 min-w-5 flex items-center justify-center">
                          {patient.unreadCount}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={cn(
            "flex-1 flex flex-col",
            !selectedPatient && "hidden md:flex"
          )}>
            {selectedPatient ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border/50 flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSelectedPatient(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedPatient.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedPatient.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-medium text-foreground">
                      {selectedPatient.full_name || "Пациент"}
                    </h2>
                    <p className="text-sm text-muted-foreground">Пациент</p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          Начните переписку с пациентом
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
                        <div key={date}>
                          <div className="flex justify-center mb-4">
                            <span className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                              {formatDateHeader(msgs[0].created_at)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {msgs.map(msg => {
                              const isOwn = msg.sender_type === "clinic";
                              return (
                                <div
                                  key={msg.id}
                                  className={cn(
                                    "flex",
                                    isOwn ? "justify-end" : "justify-start"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "max-w-[75%] px-4 py-2 rounded-2xl",
                                      isOwn 
                                        ? "bg-primary text-primary-foreground rounded-br-md" 
                                        : "bg-muted text-foreground rounded-bl-md"
                                    )}
                                  >
                                    {msg.file_url && msg.file_type && (
                                      <div className="mb-2">
                                        <MessageFileDisplay 
                                          fileUrl={msg.file_url} 
                                          fileType={msg.file_type}
                                          isOwn={isOwn}
                                        />
                                      </div>
                                    )}
                                    {msg.content && (
                                      <p className="break-words">{msg.content}</p>
                                    )}
                                    <div className={cn(
                                      "flex items-center gap-1 mt-1",
                                      isOwn ? "justify-end" : "justify-start"
                                    )}>
                                      <span className={cn(
                                        "text-xs",
                                        isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                                      )}>
                                        {formatMessageTime(msg.created_at)}
                                      </span>
                                      {isOwn && (
                                        msg.is_read 
                                          ? <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/70" />
                                          : <Check className="w-3.5 h-3.5 text-primary-foreground/70" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* File Preview */}
                {pendingFile && (
                  <MessageFilePreview 
                    file={pendingFile} 
                    onRemove={() => setPendingFile(null)} 
                  />
                )}

                {/* Message Input */}
                <div className="p-4 border-t border-border/50">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex items-center gap-2"
                  >
                    <MessageAttachment 
                      onFileSelected={handleFileSelected}
                      pendingFile={pendingFile}
                      onClearFile={() => setPendingFile(null)}
                      disabled={sending}
                    />
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Написать сообщение..."
                      className="flex-1"
                      disabled={sending}
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      disabled={(!newMessage.trim() && !pendingFile) || sending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h2 className="text-xl font-medium text-foreground mb-2">
                    Выберите пациента
                  </h2>
                  <p className="text-muted-foreground">
                    Выберите пациента из списка слева, чтобы начать переписку
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ClinicAdminLayout>
  );
}
