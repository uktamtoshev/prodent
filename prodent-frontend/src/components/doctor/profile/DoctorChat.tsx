import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, 
  Send, 
  Paperclip,
  Image as ImageIcon,
  Loader2,
  Check,
  CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PatientAccessRequestMessage } from '@/components/medical/PatientAccessRequestMessage';

interface DoctorChatProps {
  doctorId: string; // Target doctor's ID
  patientId: string; // Current user's ID (could be patient or doctor)
  onClose: () => void;
  senderDoctorId?: string; // If sender is also a doctor, pass their doctor ID
}

export function DoctorChat({ doctorId, patientId, onClose, senderDoctorId }: DoctorChatProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Determine if this is doctor-to-doctor chat
  const isDoctorToDoctor = !!senderDoctorId;

  const { data: messages, isLoading } = useQuery({
    queryKey: ['doctor-messages', doctorId, patientId, senderDoctorId],
    queryFn: async () => {
      let query = supabase
        .from('doctor_messages')
        .select(`
          *,
          sender:profiles!doctor_messages_sender_id_fkey(full_name, avatar_url)
        `)
        .order('created_at', { ascending: true });

      if (isDoctorToDoctor) {
        // Doctor-to-doctor: get messages where either doctor is sender/recipient
        query = query
          .or(`and(doctor_id.eq.${doctorId},recipient_doctor_id.eq.${senderDoctorId}),and(doctor_id.eq.${senderDoctorId},recipient_doctor_id.eq.${doctorId})`);
      } else {
        // Patient-to-doctor
        query = query
          .eq('doctor_id', doctorId)
          .eq('patient_id', patientId)
          .is('recipient_doctor_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  const { data: doctorProfile } = useQuery({
    queryKey: ['doctor-chat-profile', doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('profile:profiles!doctors_user_id_fkey(full_name, avatar_url)')
        .eq('id', doctorId)
        .maybeSingle();
      return data;
    },
  });

  // Запросы доступа к медкарте от этого врача
  const { data: accessRequests } = useQuery({
    queryKey: ['doctor-chat-access-requests', patientId, doctorId],
    queryFn: async () => {
      if (isDoctorToDoctor) return [];
      const { data } = await supabase
        .from('medical_record_access')
        .select('*')
        .eq('patient_id', patientId)
        .eq('doctor_id', doctorId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !isDoctorToDoctor,
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim()) return;

      const messageData: any = {
        doctor_id: doctorId,
        sender_id: patientId,
        content: message.trim(),
      };

      if (isDoctorToDoctor) {
        // Doctor-to-doctor: set recipient_doctor_id instead of patient_id
        messageData.recipient_doctor_id = doctorId;
        messageData.doctor_id = senderDoctorId; // Sender's doctor ID
      } else {
        // Patient-to-doctor
        messageData.patient_id = patientId;
      }

      const { error } = await supabase.from('doctor_messages').insert(messageData);

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['doctor-messages', doctorId, patientId, senderDoctorId] });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      let query = supabase
        .from('doctor_messages')
        .update({ is_read: true })
        .neq('sender_id', patientId)
        .eq('is_read', false);

      if (isDoctorToDoctor) {
        query = query
          .eq('recipient_doctor_id', senderDoctorId)
          .eq('doctor_id', doctorId);
      } else {
        query = query
          .eq('doctor_id', doctorId)
          .eq('patient_id', patientId);
      }

      await query;
    };
    
    if (messages?.length) {
      markAsRead();
    }
  }, [messages, doctorId, patientId, senderDoctorId, isDoctorToDoctor]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage.mutate();
  };

  const groupMessagesByDate = (msgs: any[]) => {
    const groups: { [key: string]: any[] } = {};
    msgs.forEach((msg) => {
      const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const formatDateHeader = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Сегодня';
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    }
    return format(d, 'd MMMM yyyy', { locale: ru });
  };

  const groupedMessages = messages ? groupMessagesByDate(messages) : {};

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg h-[600px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={doctorProfile?.profile?.avatar_url} />
              <AvatarFallback>D</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-base">{doctorProfile?.profile?.full_name || 'Врач'}</p>
              <p className="text-sm text-muted-foreground">
                {isDoctorToDoctor ? 'Коллега' : 'Врач'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-base">
                {isDoctorToDoctor ? 'Напишите сообщение коллеге' : 'Напишите сообщение врачу'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Запросы доступа к медкарте */}
              {accessRequests && accessRequests.length > 0 && (
                <div className="space-y-2">
                  {accessRequests.map(request => (
                    <PatientAccessRequestMessage
                      key={request.id}
                      request={request}
                      requesterName={doctorProfile?.profile?.full_name || 'Врач'}
                    />
                  ))}
                </div>
              )}

              {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {formatDateHeader(date)}
                  </span>
                </div>
                <div className="space-y-2">
                  {msgs.map((msg: any) => {
                    const isOwn = msg.sender_id === patientId;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex',
                          isOwn ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-2xl px-4 py-2',
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          )}
                        >
                          {msg.file_url && (
                            <div className="mb-2">
                              {msg.file_type?.startsWith('image/') ? (
                                <img
                                  src={msg.file_url}
                                  alt=""
                                  className="rounded-lg max-w-full"
                                />
                              ) : (
                                <a
                                  href={msg.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-base underline"
                                >
                                  Скачать файл
                                </a>
                              )}
                            </div>
                          )}
                          {msg.content && <p className="text-base">{msg.content}</p>}
                          <div
                            className={cn(
                              'flex items-center gap-1 mt-1',
                              isOwn ? 'justify-end' : 'justify-start'
                            )}
                          >
                            <span
                              className={cn(
                                'text-sm',
                                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}
                            >
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            {isOwn && (
                              msg.is_read ? (
                                <CheckCheck className="w-4 h-4 text-primary-foreground/70" />
                              ) : (
                                <Check className="w-4 h-4 text-primary-foreground/70" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon">
              <Paperclip className="w-5 h-5" />
            </Button>
            <Button type="button" variant="ghost" size="icon">
              <ImageIcon className="w-5 h-5" />
            </Button>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Написать сообщение..."
              className="flex-1 text-base"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
