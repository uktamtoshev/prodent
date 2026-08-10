import { useState, useEffect, useRef, useCallback } from "react";
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
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFile, setPendingFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRequestRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadPatients = useCallback(async () => {
    if (!currentClinic) return;
    setLoading(true);
    setPatientsError(null);

    try {
      // Get unique patient IDs from messages
      const { data: messagesData, error: patientsMessagesError } = await supabase
        .from("patient_messages")
        .select("patient_id")
        .eq("clinic_id", currentClinic.id);
      if (patientsMessagesError) throw patientsMessagesError;

      const patientIds = [...new Set(messagesData?.map(m => m.patient_id) || [])];

      if (patientIds.length === 0) {
        setPatients([]);
        return;
      }

      // Get patient profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", patientIds);
      if (profilesError) throw profilesError;

      if (!profilesData) {
        setPatients([]);
        return;
      }

      // Get last messages and unread counts for each patient
      const patientsWithMessages = await Promise.all(
        profilesData.map(async (profile) => {
          // Get last message
          const { data: lastMsgData, error: lastMessageError } = await supabase
            .from("patient_messages")
            .select("content, created_at, sender_type")
            .eq("clinic_id", currentClinic.id)
            .eq("patient_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMessageError) throw lastMessageError;

          // Get unread count
          const { count, error: unreadError } = await supabase
            .from("patient_messages")
            .select("*", { count: "exact", head: true })
            .eq("clinic_id", currentClinic.id)
            .eq("patient_id", profile.id)
            .eq("sender_type", "patient")
            .eq("is_read", false);
          if (unreadError) throw unreadError;

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
      setPatientsError(error instanceof Error ? error.message : "Не удалось загрузить пациентов");
    } finally {
      setLoading(false);
    }
  }, [currentClinic]);

  const loadMessages = useCallback(async (patientId: string) => {
    if (!currentClinic) return;
    const requestId = ++messageRequestRef.current;
    setMessagesLoading(true);
    setMessagesError(null);

    try {
      const { data, error } = await supabase
        .from("patient_messages")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (requestId === messageRequestRef.current) setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      if (requestId === messageRequestRef.current) {
        setMessages([]);
        setMessagesError(error instanceof Error ? error.message : "Не удалось загрузить сообщения");
      }
    } finally {
      if (requestId === messageRequestRef.current) setMessagesLoading(false);
    }
  }, [currentClinic]);

  const markMessagesAsRead = useCallback(async (patientId: string) => {
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
  }, [currentClinic]);

  const updatePatientLastMessage = useCallback((msg: Message) => {
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
  }, []);

  // Load patients who have messages with the clinic
  useEffect(() => {
    if (currentClinic) {
      void loadPatients();
    }
  }, [currentClinic, loadPatients]);

  // Load messages when patient is selected
  useEffect(() => {
    if (selectedPatient && currentClinic) {
      void loadMessages(selectedPatient.id);
      void markMessagesAsRead(selectedPatient.id);
    }
  }, [selectedPatient, currentClinic, loadMessages, markMessagesAsRead]);

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
              void markMessagesAsRead(selectedPatient.id);
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
      void supabase.removeChannel(channel);
    };
  }, [currentClinic, selectedPatient, markMessagesAsRead, scrollToBottom, updatePatientLastMessage]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (fileUrl?: string, fileType?: string) => {
    if ((!newMessage.trim() && !fileUrl) || !selectedPatient || !user || !currentClinic || sending) return;

    setSending(true);
    setSendError(null);
    const messageContent = newMessage.trim();
    setNewMessage("");

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
      setPendingFile(null);
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent); // Restore message on error
      setSendError(error instanceof Error ? error.message : "Не удалось отправить сообщение");
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
      <div className="flex h-[calc(100dvh-4rem)] min-w-0 flex-col lg:h-dvh">
        <div className="border-b border-border/50 p-3 sm:p-4 lg:p-6">
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
            <MessageCircle className="w-6 h-6 text-primary" />
            Сообщения
          </h1>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {/* Patients List */}
          <div className={cn(
            "flex min-w-0 w-full flex-col border-r border-border/50 md:w-80 lg:w-96",
            selectedPatient && "hidden md:flex"
          )}>
            {/* Search */}
            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <label htmlFor="clinic-message-patient-search" className="sr-only">
                  Поиск пациента
                </label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="clinic-message-patient-search"
                  placeholder="Поиск пациента..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-10 focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Patients */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="space-y-3 p-4" role="status" aria-live="polite" aria-label="Загрузка пациентов">
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
              ) : patientsError ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
                  <p className="text-sm font-medium text-destructive">Не удалось загрузить пациентов</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => void loadPatients()}
                  >
                    Повторить
                  </Button>
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
                      type="button"
                      key={patient.id}
                      onClick={() => {
                        messageRequestRef.current += 1;
                        setMessages([]);
                        setSelectedPatient(patient);
                      }}
                      className={cn(
                        "flex min-h-11 w-full gap-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
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
            "flex min-w-0 flex-1 flex-col",
            !selectedPatient && "hidden md:flex"
          )}>
            {selectedPatient ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border/50 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                    onClick={() => {
                      messageRequestRef.current += 1;
                      setMessages([]);
                      setSelectedPatient(null);
                    }}
                    aria-label="Назад к списку пациентов"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedPatient.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedPatient.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate font-medium text-foreground">
                      {selectedPatient.full_name || "Пациент"}
                    </h2>
                    <p className="text-sm text-muted-foreground">Пациент</p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="min-h-0 flex-1 p-3 sm:p-4">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground" role="status" aria-live="polite">
                      Загрузка сообщений...
                    </div>
                  ) : messagesError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center" role="alert">
                      <p className="text-sm font-medium text-destructive">Не удалось загрузить сообщения</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => void loadMessages(selectedPatient.id)}
                      >
                        Повторить
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          Начните переписку с пациентом
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
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
                                      "min-w-0 max-w-[85%] rounded-2xl px-4 py-2 sm:max-w-[75%]",
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
                <div className="border-t border-border/50 p-3 sm:p-4">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex min-w-0 items-center gap-2"
                    aria-busy={sending}
                  >
                    <MessageAttachment 
                      onFileSelected={handleFileSelected}
                      pendingFile={pendingFile}
                      onClearFile={() => setPendingFile(null)}
                      disabled={sending}
                    />
                    <label htmlFor="clinic-message-body" className="sr-only">
                      Написать сообщение
                    </label>
                    <Input
                      id="clinic-message-body"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Написать сообщение..."
                      className="h-11 min-w-0 flex-1 focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={sending}
                      aria-describedby="clinic-message-send-status"
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      className="h-11 w-11 shrink-0 focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={(!newMessage.trim() && !pendingFile) || sending}
                      aria-label="Отправить сообщение"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                  <p
                    id="clinic-message-send-status"
                    className={cn("mt-2 text-xs", sendError ? "text-destructive" : "sr-only")}
                    role={sendError ? "alert" : "status"}
                    aria-live={sendError ? "assertive" : "polite"}
                  >
                    {sendError || (sending ? "Сообщение отправляется" : "")}
                  </p>
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
