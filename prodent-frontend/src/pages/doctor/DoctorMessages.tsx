import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCheck,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageFileDisplay,
} from "@/components/crm/messages/MessageAttachment";
import { MessageComposer } from "@/components/crm/messages/MessageComposer";
import { ChatAccessRequest } from "@/components/medical/ChatAccessRequest";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  content: string | null;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  file_url: string | null;
  file_type: string | null;
}

interface PatientChat {
  patient_id: string;
  patient_name: string;
  patient_avatar: string | null;
  phone: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface PatientProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

const DoctorMessages = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<PatientChat | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: doctorId,
    isLoading: doctorLoading,
    isError: doctorError,
    refetch: refetchDoctor,
  } = useQuery({
    queryKey: ["doctor-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data?.id || null;
    },
    enabled: !!user?.id,
  });

  const {
    data: patientChats = [],
    isLoading: chatsLoading,
    isError: chatsError,
    refetch: refetchChats,
  } = useQuery({
    queryKey: ["doctor-patient-chats", doctorId],
    queryFn: async () => {
      if (!doctorId) return [];

      const { data: messages, error: messagesQueryError } = await supabase
        .from("doctor_messages")
        .select("*")
        .eq("doctor_id", doctorId)
        .not("patient_id", "is", null)
        .order("created_at", { ascending: false });
      if (messagesQueryError) throw messagesQueryError;

      if (!messages || messages.length === 0) return [];

      const messageRows = (messages || []) as Message[];
      const patientIds = [
        ...new Set(messageRows.map((m) => m.patient_id).filter(Boolean)),
      ] as string[];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone")
        .in("id", patientIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map(
        ((profiles || []) as PatientProfile[]).map((p) => [p.id, p])
      );

      const chats: PatientChat[] = patientIds.map((patientId) => {
        const patientMessages = messageRows.filter(
          (m) => m.patient_id === patientId
        );
        const lastMessage = patientMessages[0];
        const unreadCount = patientMessages.filter(
          (m) => !m.is_read && m.sender_id === patientId
        ).length;
        const profile = profileMap.get(patientId);

        return {
          patient_id: patientId,
          patient_name: profile?.full_name || t("doctorMessages.defaultPatient"),
          patient_avatar: profile?.avatar_url ?? null,
          phone: profile?.phone ?? null,
          last_message: lastMessage?.content || "",
          last_message_time: lastMessage?.created_at || "",
          unread_count: unreadCount,
        };
      });

      return chats.sort(
        (a, b) =>
          new Date(b.last_message_time).getTime() -
          new Date(a.last_message_time).getTime()
      );
    },
    enabled: !!doctorId,
    // WS subscription invalidates this query on changes; remove polling.
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const {
    data: messages = [],
    isLoading: messagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["doctor-messages", doctorId, selectedPatient?.patient_id],
    queryFn: async () => {
      if (!doctorId || !selectedPatient?.patient_id) return [];
      const { data, error } = await supabase
        .from("doctor_messages")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("patient_id", selectedPatient.patient_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: !!doctorId && !!selectedPatient?.patient_id,
    // Realtime invalidation comes from the WS subscription below — no
    // need for an extra polling interval that hits the API every 3s.
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      content,
      fileUrl,
      fileType,
    }: {
      content?: string;
      fileUrl?: string;
      fileType?: string;
    }) => {
      if (!doctorId || !selectedPatient?.patient_id || !user?.id) {
        throw new Error("Missing required data");
      }
      const { error } = await supabase.from("doctor_messages").insert({
        doctor_id: doctorId,
        patient_id: selectedPatient.patient_id,
        sender_id: user.id,
        content: content || null,
        file_url: fileUrl || null,
        file_type: fileType || null,
        is_read: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Composer clears its own state on success; we just refresh queries.
      queryClient.invalidateQueries({ queryKey: ["doctor-messages"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-patient-chats"] });
    },
  });

  useEffect(() => {
    const markAsRead = async () => {
      if (!doctorId || !selectedPatient?.patient_id || !user?.id) return;
      await supabase
        .from("doctor_messages")
        .update({ is_read: true })
        .eq("doctor_id", doctorId)
        .eq("patient_id", selectedPatient.patient_id)
        .eq("sender_id", selectedPatient.patient_id)
        .eq("is_read", false);
      queryClient.invalidateQueries({ queryKey: ["doctor-patient-chats"] });
    };
    markAsRead();
  }, [selectedPatient?.patient_id, doctorId, user?.id, queryClient]);

  // Scroll to the latest message only when the *count* changes — not on
  // every refetch (RQ may produce a new array reference even when content
  // is unchanged), and not on every parent re-render.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!doctorId) return;
    const channel = supabase
      .channel("doctor-messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doctor_messages",
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["doctor-messages"] });
          queryClient.invalidateQueries({ queryKey: ["doctor-patient-chats"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, queryClient]);

  // Stable callback so the memoized MessageComposer doesn't re-render
  // when this page re-renders for unrelated reasons.
  const handleComposerSend = useCallback(
    (payload: { content?: string; fileUrl?: string; fileType?: string }) =>
      sendMessage.mutateAsync(payload),
    [sendMessage]
  );

  const filteredChats = patientChats.filter((chat) =>
    chat.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMessageTime = (dateStr: string) =>
    format(new Date(dateStr), "HH:mm");

  const formatChatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "HH:mm");
    if (isYesterday(date)) return t("doctorMessages.yesterday");
    return format(date, "dd.MM.yy");
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";
    msgs.forEach((msg) => {
      const msgDate = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return t("doctorMessages.today");
    if (isYesterday(date)) return t("doctorMessages.yesterday");
    return format(date, "d MMMM yyyy", { locale: ru });
  };

  const totalUnread = patientChats.reduce((s, c) => s + c.unread_count, 0);

  return (
    <DoctorLayout>
      <div className="h-cabinet">
        <div className="grid h-full overflow-hidden grid-cols-1 md:grid-cols-[320px_1fr]">
          {/* Left: contacts */}
          <aside
            className={cn(
              "flex min-h-0 min-w-0 flex-col border-r border-border bg-background",
              selectedPatient && "hidden md:flex"
            )}
          >
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-2">
                <div className="font-heading text-lg font-bold tracking-tight text-foreground">
                  {t("doctorMessages.title")}
                </div>
                {totalUnread > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </div>
              <div className="relative mt-3">
                <label htmlFor="doctor-message-search" className="sr-only">
                  {t("doctorMessages.searchPatient")}
                </label>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="doctor-message-search"
                  placeholder={t("doctorMessages.searchPatient")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-prodent-input border border-border bg-background pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {doctorLoading || chatsLoading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground" role="status" aria-live="polite">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : doctorError || chatsError ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
                  <div className="text-sm font-medium text-destructive">{t("common.error")}</div>
                  <Button
                    variant="outline"
                    className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      void refetchDoctor();
                      void refetchChats();
                    }}
                  >
                    Повторить
                  </Button>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <div className="text-sm text-muted-foreground">
                    {searchQuery ? t("doctor.nothingFound") : t("doctorMessages.noMessages")}
                  </div>
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const a = selectedPatient?.patient_id === chat.patient_id;
                  return (
                    <button
                      type="button"
                      key={chat.patient_id}
                      onClick={() => setSelectedPatient(chat)}
                      className={cn(
                        "flex min-h-11 w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        a ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <Avatar
                        name={chat.patient_name}
                        size={40}
                        src={chat.patient_avatar}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <div className="truncate font-heading text-base font-bold text-foreground">
                            {chat.patient_name}
                          </div>
                          {chat.last_message_time && (
                            <div className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatChatTime(chat.last_message_time)}
                            </div>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {t("doctorMessages.patient")}
                        </div>
                        {chat.last_message && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {chat.last_message}
                          </div>
                        )}
                      </div>
                      {chat.unread_count > 0 && (
                        <span className="mt-1 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                          {chat.unread_count > 99 ? "99+" : chat.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right: chat */}
          <section
            className={cn(
              "flex min-h-0 min-w-0 flex-col bg-muted/40",
              !selectedPatient && "hidden md:flex"
            )}
          >
            {selectedPatient ? (
              <>
                <header className="flex min-h-16 min-w-0 items-center gap-2 border-b border-border bg-background px-2 sm:gap-3 sm:px-4 md:px-6">
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-prodent-input text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                    aria-label={t("common.back")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar
                    name={selectedPatient.patient_name}
                    size={38}
                    src={selectedPatient.patient_avatar}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-heading text-base font-semibold text-foreground">
                      {selectedPatient.patient_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t("doctorMessages.patient")}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Link
                      to={`/doctor/patients/${selectedPatient.patient_id}`}
                      className="hidden min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-prodent-input border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
                      aria-label={t("doctorMessages.profile")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">{t("doctorMessages.profile")}</span>
                    </Link>
                    <a
                      href={selectedPatient.phone ? `tel:${selectedPatient.phone.replace(/\s+/g, "")}` : undefined}
                      onClick={(e) => {
                        if (!selectedPatient.phone) {
                          e.preventDefault();
                          toast.info(t("doctor.patientPhoneNotSet"));
                        }
                      }}
                      title={selectedPatient.phone ? `${t("doctor.callPatient")} ${selectedPatient.phone}` : t("doctor.noPhone")}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-prodent-input text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t("doctor.callPatient")}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-prodent-input text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("doctorMessages.moreLabel")}>
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/doctor/patients/${selectedPatient.patient_id}`}>
                            <Eye className="mr-2 h-4 w-4" /> {t("doctorMessages.patientProfile")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/crm/medical-records?id=${selectedPatient.patient_id}`}>
                            <FileText className="mr-2 h-4 w-4" /> {t("doctorMessages.openMedicalCard")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toast.info(t("doctorMessages.archiveComingSoon"))}
                        >
                          <Archive className="mr-2 h-4 w-4" /> {t("doctorMessages.archiveChat")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </header>

                {doctorId && selectedPatient && (
                  <ChatAccessRequest
                    patientId={selectedPatient.patient_id}
                    doctorId={doctorId}
                  />
                )}

                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("common.loading")}
                    </div>
                  ) : messagesError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center" role="alert">
                      <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
                      <Button
                        variant="outline"
                        className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => void refetchMessages()}
                      >
                        Повторить
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <MessageCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
                        <div className="text-sm text-muted-foreground">
                          {t("doctorMessages.startChat")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
                      {groupMessagesByDate(messages).map((group) => (
                        <div key={group.date}>
                          <div className="mb-3 flex justify-center">
                            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                              {formatDateHeader(group.date)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.messages.map((msg) => {
                              const isOwn = msg.sender_id === user?.id;
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
                                      "min-w-0 max-w-[85%] rounded-prodent px-4 py-2.5 text-sm sm:max-w-[520px]",
                                      isOwn
                                        ? "rounded-br-[4px] bg-primary text-primary-foreground"
                                        : "rounded-bl-[4px] border border-border bg-card text-foreground"
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
                                      <div className="whitespace-pre-wrap break-words">
                                        {msg.content}
                                      </div>
                                    )}
                                    <div
                                      className={cn(
                                        "mt-1 flex items-center gap-1 text-xs tabular-nums",
                                        isOwn
                                          ? "justify-end text-primary-foreground/70"
                                          : "justify-start text-muted-foreground"
                                      )}
                                    >
                                      {formatMessageTime(msg.created_at)}
                                      {isOwn &&
                                        (msg.is_read ? (
                                          <CheckCheck className="h-3 w-3" />
                                        ) : (
                                          <Check className="h-3 w-3" />
                                        ))}
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
                </div>

                <MessageComposer
                  onSend={handleComposerSend}
                  disabled={sendMessage.isPending}
                  variant="doctor"
                />
                <p
                  className={cn(
                    "px-4 text-xs",
                    sendMessage.isError ? "pb-3 text-destructive" : "sr-only"
                  )}
                  role={sendMessage.isError ? "alert" : "status"}
                  aria-live={sendMessage.isError ? "assertive" : "polite"}
                >
                  {sendMessage.isError
                    ? t("doctorChat.messageError")
                    : sendMessage.isPending
                      ? t("common.loading")
                      : ""}
                </p>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
                  <div className="font-heading text-base font-bold text-foreground">
                    {t("doctorMessages.selectChat")}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t("doctorMessages.forViewing")}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </DoctorLayout>
  );
};

export default DoctorMessages;
