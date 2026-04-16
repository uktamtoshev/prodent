import { useState, useEffect, useRef } from "react";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  MessageCircle, 
  Send, 
  Search,
  Check,
  CheckCheck,
  User,
  ArrowLeft,
  Building2,
  Stethoscope,
  FileHeart
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageAttachment, MessageFileDisplay, MessageFilePreview } from "@/components/crm/messages/MessageAttachment";
import { PatientAccessRequestMessage } from "@/components/medical/PatientAccessRequestMessage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Doctor {
  id: string;
  user_id: string;
  specialty: string;
  profile: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  unreadCount?: number;
  lastMessage?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
}

interface Clinic {
  id: string;
  name: string;
  images: string[] | null;
  unreadCount?: number;
  lastMessage?: {
    content: string | null;
    created_at: string;
    sender_type: string;
  };
}

interface Message {
  id: string;
  doctor_id?: string;
  clinic_id?: string;
  patient_id: string;
  sender_id: string;
  sender_type?: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  is_read: boolean;
  created_at: string;
}

export default function PatientMessages() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'doctors' | 'clinics'>('doctors');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFile, setPendingFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Запросы доступа к медкарте от текущего врача (используем новую таблицу)
  const { data: accessRequests } = useQuery({
    queryKey: ['patient-chat-access-requests', user?.id, selectedDoctor?.id],
    queryFn: async () => {
      if (!user?.id || !selectedDoctor?.id) return [];
      const { data } = await supabase
        .from('medical_record_access')
        .select('*')
        .eq('patient_id', user.id)
        .eq('doctor_id', selectedDoctor.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id && !!selectedDoctor?.id,
    refetchInterval: 5000,
  });

  // Мутация для ответа на запрос доступа (используем новую таблицу)
  const respondToAccessMutation = useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: string; approved: boolean }) => {
      const { error } = await supabase
        .from('medical_record_access')
        .update({
          status: approved ? 'active' : 'revoked',
          patient_consent: approved,
          patient_consent_at: new Date().toISOString(),
          granted_by: 'patient'
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      toast.success(approved ? 'Доступ разрешён' : 'Запрос отклонён');
      queryClient.invalidateQueries({ queryKey: ['patient-chat-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['medical-access'] });
    },
    onError: () => {
      toast.error('Ошибка обработки запроса');
    },
  });

  // Load doctors and clinics
  useEffect(() => {
    if (user) {
      loadDoctors();
      loadClinics();
    }
  }, [user]);

  // Load messages when doctor or clinic is selected
  useEffect(() => {
    if (selectedDoctor && user) {
      loadDoctorMessages(selectedDoctor.id);
      markDoctorMessagesAsRead(selectedDoctor.id);
    }
  }, [selectedDoctor, user]);

  useEffect(() => {
    if (selectedClinic && user) {
      loadClinicMessages(selectedClinic.id);
      markClinicMessagesAsRead(selectedClinic.id);
    }
  }, [selectedClinic, user]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user) return;

    const doctorChannel = supabase
      .channel('patient-doctor-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'doctor_messages',
          filter: `patient_id=eq.${user.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          if (selectedDoctor && newMsg.doctor_id === selectedDoctor.id) {
            setMessages(prev => [...prev, newMsg]);
            scrollToBottom();
            if (newMsg.sender_id !== user.id) {
              markDoctorMessagesAsRead(selectedDoctor.id);
            }
          }
          updateDoctorLastMessage(newMsg);
        }
      )
      .subscribe();

    const clinicChannel = supabase
      .channel('patient-clinic-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_messages',
          filter: `patient_id=eq.${user.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          if (selectedClinic && newMsg.clinic_id === selectedClinic.id) {
            setMessages(prev => [...prev, newMsg]);
            scrollToBottom();
            if (newMsg.sender_type !== 'patient') {
              markClinicMessagesAsRead(selectedClinic.id);
            }
          }
          updateClinicLastMessage(newMsg);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(doctorChannel);
      supabase.removeChannel(clinicChannel);
    };
  }, [user, selectedDoctor, selectedClinic]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadDoctors = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get unique doctors from appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select("doctor_id")
        .eq("patient_id", user.id);

      const appointmentDoctorIds = appointments?.map(a => a.doctor_id) || [];

      // Also get doctors from messages (in case patient wrote from public profile)
      const { data: messagesWithDoctors } = await supabase
        .from("doctor_messages")
        .select("doctor_id")
        .eq("patient_id", user.id);

      const messageDoctorIds = messagesWithDoctors?.map(m => m.doctor_id) || [];

      // Combine and deduplicate doctor IDs
      const allDoctorIds = [...new Set([...appointmentDoctorIds, ...messageDoctorIds])];

      if (allDoctorIds.length === 0) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      // Get doctor info with profiles
      const { data: doctorsData } = await supabase
        .from("doctors")
        .select(`
          id,
          user_id,
          specialty,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .in("id", allDoctorIds);

      if (!doctorsData) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      // Get last messages and unread counts for each doctor
      const doctorsWithMessages = await Promise.all(
        doctorsData.map(async (doctor) => {
          // Get last message
          const { data: lastMsgData } = await supabase
            .from("doctor_messages")
            .select("content, created_at, sender_id")
            .eq("doctor_id", doctor.id)
            .eq("patient_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count } = await supabase
            .from("doctor_messages")
            .select("*", { count: "exact", head: true })
            .eq("doctor_id", doctor.id)
            .eq("patient_id", user.id)
            .neq("sender_id", user.id)
            .eq("is_read", false);

          return {
            ...doctor,
            profile: Array.isArray(doctor.profiles) ? doctor.profiles[0] : doctor.profiles,
            lastMessage: lastMsgData || undefined,
            unreadCount: count || 0
          };
        })
      );

      // Sort by last message time
      doctorsWithMessages.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });

      setDoctors(doctorsWithMessages);
    } catch (error) {
      console.error("Error loading doctors:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadClinics = async () => {
    if (!user) return;

    try {
      // Get unique clinic IDs from messages
      const { data: messagesData } = await supabase
        .from("patient_messages")
        .select("clinic_id")
        .eq("patient_id", user.id);

      const clinicIds = [...new Set(messagesData?.map(m => m.clinic_id) || [])];

      if (clinicIds.length === 0) {
        setClinics([]);
        return;
      }

      // Get clinic info
      const { data: clinicsData } = await supabase
        .from("clinics")
        .select("id, name, images")
        .in("id", clinicIds);

      if (!clinicsData) {
        setClinics([]);
        return;
      }

      // Get last messages and unread counts
      const clinicsWithMessages = await Promise.all(
        clinicsData.map(async (clinic) => {
          const { data: lastMsgData } = await supabase
            .from("patient_messages")
            .select("content, created_at, sender_type")
            .eq("clinic_id", clinic.id)
            .eq("patient_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count } = await supabase
            .from("patient_messages")
            .select("*", { count: "exact", head: true })
            .eq("clinic_id", clinic.id)
            .eq("patient_id", user.id)
            .eq("sender_type", "clinic")
            .eq("is_read", false);

          return {
            ...clinic,
            lastMessage: lastMsgData || undefined,
            unreadCount: count || 0
          };
        })
      );

      clinicsWithMessages.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });

      setClinics(clinicsWithMessages);
    } catch (error) {
      console.error("Error loading clinics:", error);
    }
  };

  const loadDoctorMessages = async (doctorId: string) => {
    if (!user) return;

    const { data } = await supabase
      .from("doctor_messages")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("patient_id", user.id)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  };

  const loadClinicMessages = async (clinicId: string) => {
    if (!user) return;

    const { data } = await supabase
      .from("patient_messages")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", user.id)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  };

  const markDoctorMessagesAsRead = async (doctorId: string) => {
    if (!user) return;

    await supabase
      .from("doctor_messages")
      .update({ is_read: true })
      .eq("doctor_id", doctorId)
      .eq("patient_id", user.id)
      .neq("sender_id", user.id)
      .eq("is_read", false);

    setDoctors(prev => 
      prev.map(d => 
        d.id === doctorId ? { ...d, unreadCount: 0 } : d
      )
    );
  };

  const markClinicMessagesAsRead = async (clinicId: string) => {
    if (!user) return;

    await supabase
      .from("patient_messages")
      .update({ is_read: true })
      .eq("clinic_id", clinicId)
      .eq("patient_id", user.id)
      .eq("sender_type", "clinic")
      .eq("is_read", false);

    setClinics(prev => 
      prev.map(c => 
        c.id === clinicId ? { ...c, unreadCount: 0 } : c
      )
    );
  };

  const updateDoctorLastMessage = (msg: Message) => {
    setDoctors(prev => {
      const updated = prev.map(d => {
        if (d.id === msg.doctor_id) {
          return {
            ...d,
            lastMessage: {
              content: msg.content || "",
              created_at: msg.created_at,
              sender_id: msg.sender_id
            },
            unreadCount: msg.sender_id !== user?.id 
              ? (d.unreadCount || 0) + 1 
              : d.unreadCount
          };
        }
        return d;
      });
      
      return updated.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });
    });
  };

  const updateClinicLastMessage = (msg: Message) => {
    setClinics(prev => {
      const updated = prev.map(c => {
        if (c.id === msg.clinic_id) {
          return {
            ...c,
            lastMessage: {
              content: msg.content,
              created_at: msg.created_at,
              sender_type: msg.sender_type || 'patient'
            },
            unreadCount: msg.sender_type === 'clinic' 
              ? (c.unreadCount || 0) + 1 
              : c.unreadCount
          };
        }
        return c;
      });
      
      return updated.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });
    });
  };

  const sendDoctorMessage = async (fileUrl?: string, fileType?: string) => {
    if ((!newMessage.trim() && !fileUrl) || !selectedDoctor || !user || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");
    setPendingFile(null);

    try {
      const { data, error } = await supabase
        .from("doctor_messages")
        .insert({
          doctor_id: selectedDoctor.id,
          patient_id: user.id,
          sender_id: user.id,
          content: messageContent || null,
          file_url: fileUrl || null,
          file_type: fileType || null,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages(prev => [...prev, data]);
        updateDoctorLastMessage(data);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const sendClinicMessage = async (fileUrl?: string, fileType?: string) => {
    if ((!newMessage.trim() && !fileUrl) || !selectedClinic || !user || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");
    setPendingFile(null);

    try {
      const { data, error } = await supabase
        .from("patient_messages")
        .insert({
          clinic_id: selectedClinic.id,
          patient_id: user.id,
          sender_id: user.id,
          sender_type: "patient",
          content: messageContent || null,
          file_url: fileUrl || null,
          file_type: fileType || null,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages(prev => [...prev, data]);
        updateClinicLastMessage(data);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelected = (fileUrl: string, fileType: string, fileName: string) => {
    setPendingFile({ url: fileUrl, type: fileType, name: fileName });
  };

  const handleSendMessage = () => {
    if (selectedDoctor) {
      sendDoctorMessage(pendingFile?.url, pendingFile?.type);
    } else if (selectedClinic) {
      sendClinicMessage(pendingFile?.url, pendingFile?.type);
    }
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

  const filteredDoctors = doctors.filter(d => 
    d.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.specialty?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClinics = clinics.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedClinic(null);
    setSelectedDoctor(doctor);
    setMessages([]);
  };

  const handleSelectClinic = (clinic: Clinic) => {
    setSelectedDoctor(null);
    setSelectedClinic(clinic);
    setMessages([]);
  };

  const handleBack = () => {
    setSelectedDoctor(null);
    setSelectedClinic(null);
    setMessages([]);
  };

  const selectedContact = selectedDoctor || selectedClinic;

  return (
    <PatientLayout>
      <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col">
        <div className="p-4 lg:p-6 border-b border-border/50">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            {t('patient.messages')}
          </h1>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Contacts List */}
          <div className={cn(
            "w-full md:w-80 lg:w-96 border-r border-border/50 flex flex-col",
            selectedContact && "hidden md:flex"
          )}>
            {/* Tabs */}
            <div className="p-4 border-b border-border/50">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'doctors' | 'clinics')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="doctors" className="gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Врачи
                    {doctors.reduce((sum, d) => sum + (d.unreadCount || 0), 0) > 0 && (
                      <Badge variant="destructive" className="ml-1 h-5 min-w-5">
                        {doctors.reduce((sum, d) => sum + (d.unreadCount || 0), 0)}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="clinics" className="gap-2">
                    <Building2 className="w-4 h-4" />
                    Клиники
                    {clinics.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
                      <Badge variant="destructive" className="ml-1 h-5 min-w-5">
                        {clinics.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === 'doctors' ? "Поиск врача..." : "Поиск клиники..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* List */}
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
              ) : activeTab === 'doctors' ? (
                filteredDoctors.length === 0 ? (
                  <div className="p-8 text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {doctors.length === 0 
                        ? "У вас пока нет врачей для переписки"
                        : "Врачи не найдены"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredDoctors.map(doctor => (
                      <button
                        key={doctor.id}
                        onClick={() => handleSelectDoctor(doctor)}
                        className={cn(
                          "w-full p-4 flex gap-3 hover:bg-muted/50 transition-colors text-left",
                          selectedDoctor?.id === doctor.id && "bg-muted"
                        )}
                      >
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={doctor.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(doctor.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium text-foreground truncate">
                              {doctor.profile?.full_name || "Врач"}
                            </h3>
                            {doctor.lastMessage && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatMessageTime(doctor.lastMessage.created_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {doctor.specialty}
                          </p>
                          {doctor.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {doctor.lastMessage.sender_id === user?.id && (
                                <span className="text-primary">Вы: </span>
                              )}
                              {doctor.lastMessage.content}
                            </p>
                          )}
                        </div>
                        {(doctor.unreadCount || 0) > 0 && (
                          <Badge className="bg-primary text-primary-foreground h-5 min-w-5 flex items-center justify-center">
                            {doctor.unreadCount}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                filteredClinics.length === 0 ? (
                  <div className="p-8 text-center">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {clinics.length === 0 
                        ? "У вас пока нет клиник для переписки"
                        : "Клиники не найдены"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredClinics.map(clinic => (
                      <button
                        key={clinic.id}
                        onClick={() => handleSelectClinic(clinic)}
                        className={cn(
                          "w-full p-4 flex gap-3 hover:bg-muted/50 transition-colors text-left",
                          selectedClinic?.id === clinic.id && "bg-muted"
                        )}
                      >
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={clinic.images?.[0] || undefined} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground">
                            <Building2 className="w-5 h-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium text-foreground truncate">
                              {clinic.name}
                            </h3>
                            {clinic.lastMessage && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatMessageTime(clinic.lastMessage.created_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">Клиника</p>
                          {clinic.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {clinic.lastMessage.sender_type === "patient" && (
                                <span className="text-primary">Вы: </span>
                              )}
                              {clinic.lastMessage.content || "[Файл]"}
                            </p>
                          )}
                        </div>
                        {(clinic.unreadCount || 0) > 0 && (
                          <Badge className="bg-primary text-primary-foreground h-5 min-w-5 flex items-center justify-center">
                            {clinic.unreadCount}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={cn(
            "flex-1 flex flex-col",
            !selectedContact && "hidden md:flex"
          )}>
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border/50 flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="w-10 h-10">
                    {selectedDoctor ? (
                      <>
                        <AvatarImage src={selectedDoctor.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(selectedDoctor.profile?.full_name)}
                        </AvatarFallback>
                      </>
                    ) : selectedClinic ? (
                      <>
                        <AvatarImage src={selectedClinic.images?.[0] || undefined} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          <Building2 className="w-5 h-5" />
                        </AvatarFallback>
                      </>
                    ) : null}
                  </Avatar>
                  <div>
                    <h2 className="font-medium text-foreground">
                      {selectedDoctor 
                        ? selectedDoctor.profile?.full_name || "Врач"
                        : selectedClinic?.name || "Клиника"
                      }
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedDoctor ? selectedDoctor.specialty : "Клиника"}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          {selectedDoctor ? "Начните переписку с врачом" : "Начните переписку с клиникой"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Показываем запросы доступа к медкарте */}
                      {selectedDoctor && accessRequests && accessRequests.length > 0 && (
                        <div className="space-y-2">
                          {accessRequests.map(request => (
                            <PatientAccessRequestMessage
                              key={request.id}
                              request={request}
                              requesterName={selectedDoctor.profile?.full_name || 'Врач'}
                            />
                          ))}
                        </div>
                      )}

                      {Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
                        <div key={date}>
                          <div className="flex justify-center mb-4">
                            <span className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                              {formatDateHeader(msgs[0].created_at)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {msgs.map(msg => {
                              const isOwn = selectedDoctor 
                                ? msg.sender_id === user?.id 
                                : msg.sender_type === 'patient';
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
                    Выберите контакт
                  </h2>
                  <p className="text-muted-foreground">
                    Выберите врача или клинику из списка слева
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}
