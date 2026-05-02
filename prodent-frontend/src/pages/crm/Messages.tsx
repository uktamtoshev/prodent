import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useClinic } from '@/contexts/ClinicContext';
import { useUserRole } from '@/hooks/useUserRole';
import { MessageAttachment, MessageFileDisplay, MessageFilePreview } from '@/components/crm/messages/MessageAttachment';
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

const CRMMessages = () => {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { doctorId } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<PatientChat | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFile, setPendingFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

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
          patient_name: profile?.full_name || 'Пациент',
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
    refetchInterval: 5000,
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
    refetchInterval: 3000,
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
      setMessageText('');
      setPendingFile(null);
      queryClient.invalidateQueries({ queryKey: ['crm-messages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-patient-chats'] });
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() || pendingFile) {
      sendMessage.mutate({
        content: messageText.trim() || undefined,
        fileUrl: pendingFile?.url,
        fileType: pendingFile?.type,
      });
    }
  };

  const handleFileSelected = (fileUrl: string, fileType: string, fileName: string) => {
    setPendingFile({ url: fileUrl, type: fileType, name: fileName });
  };

  const filteredChats = patientChats.filter(chat =>
    chat.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm');
  };

  const formatChatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Вчера';
    return format(date, 'dd.MM.yy');
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
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
    if (isToday(date)) return 'Сегодня';
    if (isYesterday(date)) return 'Вчера';
    return format(date, 'd MMMM yyyy', { locale: ru });
  };

  const totalUnread = patientChats.reduce((sum, chat) => sum + chat.unread_count, 0);

  // Chat area component with access status
  const ChatAreaWithAccess = ({ 
    selectedPatient, 
    setSelectedPatient, 
    currentDoctorId, 
    user, 
    messages, 
    messageText, 
    setMessageText, 
    pendingFile, 
    setPendingFile, 
    sendMessage, 
    messagesEndRef, 
    formatMessageTime, 
    formatDateHeader, 
    groupMessagesByDate, 
    handleSend, 
    handleFileSelected 
  }: any) => {
    const { data: accessStatus } = useMedicalAccess(selectedPatient.patient_id, currentDoctorId);
    
    return (
      <>
        {/* Chat Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSelectedPatient(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src={selectedPatient.patient_avatar || undefined} />
              <AvatarFallback>
                {selectedPatient.patient_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium">{selectedPatient.patient_name}</h3>
              <p className="text-sm text-muted-foreground">Пациент</p>
            </div>
          </div>
          
          {/* Medical Access Status and Request */}
          <div className="flex items-center gap-2">
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

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {groupMessagesByDate(messages).map((group: any) => (
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

        {/* File Preview */}
        {pendingFile && (
          <MessageFilePreview 
            file={pendingFile} 
            onRemove={() => setPendingFile(null)} 
          />
        )}

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-4 border-t flex items-center gap-2">
          <MessageAttachment 
            onFileSelected={handleFileSelected}
            pendingFile={pendingFile}
            onClearFile={() => setPendingFile(null)}
            disabled={sendMessage.isPending}
          />
          <Input
            placeholder="Написать сообщение..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={(!messageText.trim() && !pendingFile) || sendMessage.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </>
    );
  };

  return (
    <CRMLayout>
      <div className="h-[calc(100vh-2rem)] flex bg-card rounded-xl border overflow-hidden">
        {/* Patient List */}
        <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${selectedPatient ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold mb-3">
              Сообщения
              {totalUnread > 0 && (
                <span className="ml-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск пациентов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {!currentDoctorId ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>Сообщения доступны только врачам</p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchQuery ? 'Пациенты не найдены' : 'Нет сообщений'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredChats.map(chat => (
                  <button
                    key={chat.patient_id}
                    onClick={() => setSelectedPatient(chat)}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left ${
                      selectedPatient?.patient_id === chat.patient_id ? 'bg-muted' : ''
                    }`}
                  >
                    <Avatar className="h-12 w-12 flex-shrink-0">
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
                          <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex-shrink-0">
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
              messageText={messageText}
              setMessageText={setMessageText}
              pendingFile={pendingFile}
              setPendingFile={setPendingFile}
              sendMessage={sendMessage}
              messagesEndRef={messagesEndRef}
              formatMessageTime={formatMessageTime}
              formatDateHeader={formatDateHeader}
              groupMessagesByDate={groupMessagesByDate}
              handleSend={handleSend}
              handleFileSelected={handleFileSelected}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg">Выберите чат</p>
                <p className="text-sm">для просмотра сообщений</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </CRMLayout>
  );
};

export default CRMMessages;
