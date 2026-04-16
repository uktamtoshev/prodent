import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, 
  Send, 
  Loader2,
  Check,
  CheckCheck,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MessageAttachment, MessageFileDisplay, MessageFilePreview } from '@/components/crm/messages/MessageAttachment';

interface ClinicChatProps {
  clinicId: string;
  patientId: string;
  onClose: () => void;
}

export function ClinicChat({ clinicId, patientId, onClose }: ClinicChatProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['clinic-messages', clinicId, patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_messages')
        .select(`
          *,
          sender:profiles!patient_messages_sender_id_fkey(full_name, avatar_url)
        `)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  const { data: clinicProfile } = useQuery({
    queryKey: ['clinic-chat-profile', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('name, images')
        .eq('id', clinicId)
        .maybeSingle();
      return data;
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() && !pendingFile) return;

      const { error } = await supabase.from('patient_messages').insert({
        clinic_id: clinicId,
        patient_id: patientId,
        sender_id: patientId,
        sender_type: 'patient',
        content: message.trim() || null,
        file_url: pendingFile?.url || null,
        file_type: pendingFile?.type || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      setPendingFile(null);
      queryClient.invalidateQueries({ queryKey: ['clinic-messages', clinicId, patientId] });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      await supabase
        .from('patient_messages')
        .update({ is_read: true })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .neq('sender_id', patientId)
        .eq('is_read', false);
    };
    
    if (messages?.length) {
      markAsRead();
    }
  }, [messages, clinicId, patientId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage.mutate();
  };

  const handleFileSelected = (fileUrl: string, fileType: string, fileName: string) => {
    setPendingFile({ url: fileUrl, type: fileType, name: fileName });
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
              <AvatarImage src={clinicProfile?.images?.[0]} />
              <AvatarFallback>
                <Building2 className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-base">{clinicProfile?.name || 'Клиника'}</p>
              <p className="text-sm text-muted-foreground">Клиника</p>
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
              <p className="text-base">Напишите сообщение клинике</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
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
                          {msg.file_url && msg.file_type && (
                            <div className="mb-2">
                              <MessageFileDisplay 
                                fileUrl={msg.file_url} 
                                fileType={msg.file_type}
                                isOwn={isOwn}
                              />
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
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* File Preview */}
        {pendingFile && (
          <MessageFilePreview 
            file={pendingFile} 
            onRemove={() => setPendingFile(null)} 
          />
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <MessageAttachment 
              onFileSelected={handleFileSelected}
              pendingFile={pendingFile}
              onClearFile={() => setPendingFile(null)}
              disabled={sendMessage.isPending}
            />
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Написать сообщение..."
              className="flex-1 text-base"
            />
            <Button
              type="submit"
              size="icon"
              disabled={(!message.trim() && !pendingFile) || sendMessage.isPending}
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
