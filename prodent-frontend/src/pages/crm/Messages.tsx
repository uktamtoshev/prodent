import { useState, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { User } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ru, kk, uz, uzCyrl } from 'date-fns/locale';
import { useClinic } from '@/contexts/ClinicContext';
import { useUserRole } from '@/hooks/useUserRole';
import { MessageFileDisplay } from '@/components/crm/messages/MessageAttachment';
import { MessageComposer } from '@/components/crm/messages/MessageComposer';
import { cn } from '@/lib/utils';
import { ChatAccessRequest } from '@/components/medical/ChatAccessRequest';
import { AccessStatusBadge } from '@/components/medical/AccessStatusBadge';
import { useMedicalAccess } from '@/hooks/useMedicalAccess';

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
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface ProfileSummary {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface MessageGroup {
  date: string;
  messages: Message[];
}

interface SendMessagePayload {
  content?: string;
  fileUrl?: string;
  fileType?: string;
}

interface SendMessageMutation {
  mutate: (payload: SendMessagePayload) => void;
  isPending: boolean;
}

interface ChatAreaWithAccessProps {
  selectedPatient: PatientChat;
  setSelectedPatient: Dispatch<SetStateAction<PatientChat | null>>;
  currentDoctorId: string | null;
  user: User | null;
  messages: Message[];
  sendMessage: SendMessageMutation;
  messagesEndRef: RefObject<HTMLDivElement>;
  formatMessageTime: (dateStr: string) => string;
  formatDateHeader: (dateStr: string) => string;
  groupMessagesByDate: (msgs: Message[]) => MessageGroup[];
}

const CRMMessages = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { currentClinic } = useClinic();
  const { doctorId } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<PatientChat | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  /**
   * Срез списка диалогов. Из эталонных вкладок поддержаны те, что опираются
   * на приходящие поля: непрочитанные считаются по unread_count. «Сегодняшние
   * приёмы» и «Архив» требуют связи диалога с записью и признака архива —
   * ни того, ни другого в ответе нет.
   */
  const [chatTab, setChatTab] = useState<'all' | 'unread'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ky/tj have no date-fns locale at the time of writing — fall back to ru
  // for those languages (the translation file still localises the static
  // headers like "Сегодня"/"Вчера", only relative-format month names fall
  // back here).
  const dateFnsLocale =
    language === 'uz'
      ? uz
      : language === 'uz_cyrl'
        ? uzCyrl
        : language === 'kz'
          ? kk
          : ru;

  // Get the doctor ID for the current user
  const { data: currentDoctorId } = useQuery({
    queryKey: ['crm-doctor-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      if (doctorId) return doctorId;
      
      const { data } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      return data?.id || null;
    },
    enabled: !!user?.id,
  });

  // Fetch patient chats for the current doctor
  const { data: patientChats = [] } = useQuery({
    queryKey: ['crm-patient-chats', currentDoctorId],
    queryFn: async () => {
      if (!currentDoctorId) return [];

      // Get all messages for this doctor
      const { data: messages } = await supabase
        .from('doctor_messages')
        .select('*')
        .eq('doctor_id', currentDoctorId)
        .not('patient_id', 'is', null)
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) return [];

      // Get unique patient IDs
      const patientIds = [...new Set(messages.map(m => m.patient_id).filter(Boolean))] as string[];

      // Get patient profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', patientIds);

      const profileRows = (profiles || []) as ProfileSummary[];
      const profileMap = new Map<string, ProfileSummary>(
        profileRows.map((profile) => [profile.id, profile]),
      );

      // Build chat list
      const chats: PatientChat[] = patientIds.map(patientId => {
        const patientMessages = messages.filter(m => m.patient_id === patientId);
        const lastMessage = patientMessages[0];
        const unreadCount = patientMessages.filter(
          m => !m.is_read && m.sender_id === patientId
        ).length;
        const profile = profileMap.get(patientId);

        return {
          patient_id: patientId,
          patient_name: profile?.full_name || t("crmMessages.defaultPatient"),
          patient_avatar: profile?.avatar_url,
          last_message: lastMessage?.content || '',
          last_message_time: lastMessage?.created_at || '',
          unread_count: unreadCount,
        };
      });

      // Sort by last message time
      return chats.sort((a, b) => 
        new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      );
    },
    enabled: !!currentDoctorId,
    // WS subscription invalidates this query on changes — drop polling.
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // Fetch messages for selected patient
  const { data: messages = [] } = useQuery({
    queryKey: ['crm-messages', currentDoctorId, selectedPatient?.patient_id],
    queryFn: async () => {
      if (!currentDoctorId || !selectedPatient?.patient_id) return [];

      const { data } = await supabase
        .from('doctor_messages')
        .select('*')
        .eq('doctor_id', currentDoctorId)
        .eq('patient_id', selectedPatient.patient_id)
        .order('created_at', { ascending: true });

      return (data || []) as Message[];
    },
    enabled: !!currentDoctorId && !!selectedPatient?.patient_id,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ content, fileUrl, fileType }: { content?: string; fileUrl?: string; fileType?: string }) => {
      if (!currentDoctorId || !selectedPatient?.patient_id || !user?.id) {
        throw new Error('Missing required data');
      }

      const { error } = await supabase.from('doctor_messages').insert({
        doctor_id: currentDoctorId,
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
      queryClient.invalidateQueries({ queryKey: ['crm-messages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-patient-chats'] });
    },
    onError: (error) => {
      // Without this the failure was completely silent: no toast, no inline
      // message, and the composer had already been told the send succeeded.
      console.error('Failed to send clinic message', error);
    },
  });

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      if (!currentDoctorId || !selectedPatient?.patient_id || !user?.id) return;

      await supabase
        .from('doctor_messages')
        .update({ is_read: true })
        .eq('doctor_id', currentDoctorId)
        .eq('patient_id', selectedPatient.patient_id)
        .eq('sender_id', selectedPatient.patient_id)
        .eq('is_read', false);

      queryClient.invalidateQueries({ queryKey: ['crm-patient-chats'] });
    };

    markAsRead();
  }, [selectedPatient?.patient_id, currentDoctorId, user?.id, queryClient]);

  // Scroll to bottom only when message *count* changes — not on every
  // refetch tick (RQ may produce a new array reference even when content
  // is identical) and not on every parent re-render.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Realtime subscription
  useEffect(() => {
    if (!currentDoctorId) return;

    const channel = supabase
      .channel('crm-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doctor_messages',
          filter: `doctor_id=eq.${currentDoctorId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['crm-messages'] });
          queryClient.invalidateQueries({ queryKey: ['crm-patient-chats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDoctorId, queryClient]);

  const filteredChats = patientChats.filter(chat =>
    (chatTab === 'all' || chat.unread_count > 0) &&
    chat.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm');
  };

  const formatChatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return t("crmMessages.yesterday");
    return format(date, 'dd.MM.yy');
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: MessageGroup[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
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
    if (isToday(date)) return t("crmMessages.today");
    if (isYesterday(date)) return t("crmMessages.yesterday");
    return format(date, 'd MMMM yyyy', { locale: dateFnsLocale });
  };

  const totalUnread = patientChats.reduce((sum, chat) => sum + chat.unread_count, 0);

  // Chat area component with access status
  const ChatAreaWithAccess = ({
    selectedPatient,
    setSelectedPatient,
    currentDoctorId,
    user,
    messages,
    sendMessage,
    messagesEndRef,
    formatMessageTime,
    formatDateHeader,
    groupMessagesByDate,
  }: ChatAreaWithAccessProps) => {
    const { data: accessStatus } = useMedicalAccess(selectedPatient.patient_id, currentDoctorId);
    
    return (
      <>
        {/* Chat Header */}
        <div className="border-b border-border/50 bg-card px-card-x py-card-y">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                onClick={() => setSelectedPatient(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-10 w-10 shrink-0 border border-border">
                <AvatarImage src={selectedPatient.patient_avatar || undefined} />
                <AvatarFallback>
                  {selectedPatient.patient_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="truncate font-medium">{selectedPatient.patient_name}</h3>
                <p className="text-sm text-muted-foreground">{t("crmMessages.patient")}</p>
              </div>
            </div>
          
            {/* Medical Access Status and Request */}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <AccessStatusBadge
                status={accessStatus?.request?.status || 'none'}
                expiresAt={accessStatus?.expiresAt || undefined}
              />
              {currentDoctorId && (
                <ChatAccessRequest
                  patientId={selectedPatient.patient_id}
                  doctorId={currentDoctorId}
                />
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 bg-muted/20 p-4">
          {groupMessagesByDate(messages).map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-4">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {formatDateHeader(group.date)}
                </span>
              </div>
              {group.messages.map((msg: Message) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      }`}
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
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        <span className="text-xs">{formatMessageTime(msg.created_at)}</span>
                        {isOwn && (
                          msg.is_read 
                            ? <CheckCheck className="h-3.5 w-3.5" />
                            : <Check className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/*
          Message Input — local state, isolated re-renders.

          `mutateAsync`, not `mutate`: MessageComposer awaits this promise and
          keeps the draft in its `catch`. With `mutate` the call returned void
          and never rejected, so the catch was dead code and the composer wiped
          the textarea on failure — the administrator watched the field clear,
          assumed the message was sent, and the text was gone with no toast and
          no way to recover it. In a clinic that text can be dosage
          instructions.
        */}
        <MessageComposer
          onSend={(payload) => sendMessage.mutateAsync(payload)}
          disabled={sendMessage.isPending}
        />
        <p
          className={cn(
            'px-4 text-xs',
            sendMessage.isError ? 'pb-3 text-destructive' : 'sr-only'
          )}
          role={sendMessage.isError ? 'alert' : 'status'}
          aria-live={sendMessage.isError ? 'assertive' : 'polite'}
        >
          {sendMessage.isError
            ? t('doctorChat.messageError')
            : sendMessage.isPending
              ? t('common.loading')
              : ''}
        </p>
      </>
    );
  };

  return (
    <CRMLayout>
      <div className="h-cabinet overflow-hidden rounded-panel border border-border/50 bg-card shadow-soft">
        <div className="flex h-full">
          {/* Patient List */}
          <div className={`w-full flex-col border-r border-border/50 md:w-80 lg:w-96 ${selectedPatient ? 'hidden md:flex' : 'flex'}`}>
            {/* Шапка панели по макету: без градиента, отступ 11/14, разделитель.
                Градиент здесь был единственной цветной плашкой на экране и
                перетягивал внимание с самого списка диалогов. */}
            <div className="border-b border-border/50 px-card-x py-card-y">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold">{t("crmMessages.threadsPanel")}</h2>
                {/* Показатель эталона «Непрочитанных». Остальные три
                    («Диалогов за неделю», «Среднее время ответа», «Закрыто
                    вопросов») требуют времени сообщений и признака закрытия —
                    в ответе их нет. */}
                <span className="text-kpi tabular-nums font-heading">{totalUnread}</span>
              </div>
              {/* Срезы и счётчик непрочитанных. Раньше счётчик был отдельной
                  плашкой у заголовка и ничего не переключал — теперь это
                  вкладка, по которой список действительно фильтруется. */}
              <div className="flex flex-wrap items-center gap-0.5">
                {([
                  { key: 'all' as const, label: t("crmMessages.tabAll"), n: patientChats.length },
                  { key: 'unread' as const, label: t("crmMessages.tabUnread"), n: totalUnread },
                ]).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setChatTab(item.key)}
                    aria-pressed={chatTab === item.key}
                    className={cn(
                      "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      chatTab === item.key
                        ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                        : "font-medium text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                    {item.n > 0 && (
                      <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                        {item.n}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("crmMessages.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 border-border bg-background pl-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {!currentDoctorId ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <p>{t("crmMessages.doctorsOnly")}</p>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? t("crmMessages.noPatientsFound") : t("crmMessages.noMessages")}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredChats.map(chat => (
                    <button
                      key={chat.patient_id}
                      onClick={() => setSelectedPatient(chat)}
                      className={`w-full p-4 flex items-start gap-3 text-left transition-all hover:bg-muted/60 ${
                        selectedPatient?.patient_id === chat.patient_id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <Avatar className="h-12 w-12 flex-shrink-0 border border-border">
                        <AvatarImage src={chat.patient_avatar || undefined} />
                        <AvatarFallback>{chat.patient_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{chat.patient_name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatChatTime(chat.last_message_time)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-sm text-muted-foreground truncate">
                            {chat.last_message}
                          </span>
                          {chat.unread_count > 0 && (
                            <span className="flex-shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${!selectedPatient ? 'hidden md:flex' : 'flex'}`}>
            {selectedPatient ? (
              <ChatAreaWithAccess
                selectedPatient={selectedPatient}
                setSelectedPatient={setSelectedPatient}
                currentDoctorId={currentDoctorId}
                user={user}
                messages={messages}
                sendMessage={sendMessage}
                messagesEndRef={messagesEndRef}
                formatMessageTime={formatMessageTime}
                formatDateHeader={formatDateHeader}
                groupMessagesByDate={groupMessagesByDate}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="rounded-panel border border-border/50 bg-card p-8 text-center shadow-sm">
                  <p className="text-lg font-medium text-foreground">{t("crmMessages.selectChat")}</p>
                  <p className="text-sm">{t("crmMessages.viewMessages")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </CRMLayout>
  );
};

export default CRMMessages;
