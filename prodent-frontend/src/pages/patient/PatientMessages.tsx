import { useCallback, useEffect, useRef, useState } from "react";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPatientDraft,
  loadPatientDraft,
  savePatientDraft,
} from "@/lib/patient-cabinet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Stethoscope,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import {
  MessageAttachment,
  MessageFileDisplay,
  MessageFilePreview,
} from "@/components/crm/messages/MessageAttachment";
import { PatientAccessRequestMessage } from "@/components/medical/PatientAccessRequestMessage";
import { useQuery } from "@tanstack/react-query";
import { usePatientAccessRequests } from "@/hooks/useMedicalAccess";

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

interface DoctorQueryRow {
  id: string;
  user_id: string;
  specialty: string;
  profiles: Doctor["profile"] | Doctor["profile"][];
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
  const savedDraft = loadPatientDraft<{
    text: string;
    pendingFile: { url: string; type: string; name: string } | null;
  }>("message", user?.id, { text: "", pendingFile: null });
  const [activeTab, setActiveTab] = useState<"doctors" | "clinics">("doctors");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState(savedDraft.text);
  const [loading, setLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [clinicsError, setClinicsError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFile, setPendingFile] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(savedDraft.pendingFile);
  const draftUserRef = useRef<string | null>(user?.id ?? null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRequestRef = useRef(0);

  const { data: allAccessRequests = [] } = usePatientAccessRequests();

  useEffect(() => {
    if (!user?.id) return;
    if (draftUserRef.current !== user.id) {
      draftUserRef.current = user.id;
      const restored = loadPatientDraft("message", user.id, {
        text: "",
        pendingFile: null,
      });
      setNewMessage(restored.text);
      setPendingFile(restored.pendingFile);
      return;
    }
    savePatientDraft("message", user?.id, {
      text: newMessage,
      pendingFile,
    });
  }, [newMessage, pendingFile, user?.id]);
  const accessRequests = allAccessRequests.filter(
    (request) =>
      request.doctor_id === selectedDoctor?.id && request.status === "pending",
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadDoctors = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    setLoading(true);
    setDoctorsError(null);
    try {
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select("doctor_id")
        .eq("patient_id", userId);
      if (appointmentsError) throw appointmentsError;
      const appointmentDoctorIds = appointments?.map((a) => a.doctor_id) || [];

      const { data: messagesWithDoctors, error: doctorMessagesError } = await supabase
        .from("doctor_messages")
        .select("doctor_id")
        .eq("patient_id", userId);
      if (doctorMessagesError) throw doctorMessagesError;
      const messageDoctorIds =
        messagesWithDoctors?.map((m) => m.doctor_id) || [];

      const allDoctorIds = [
        ...new Set([...appointmentDoctorIds, ...messageDoctorIds]),
      ];

      if (allDoctorIds.length === 0) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      const { data: doctorsData, error: doctorsError } = await supabase
        .from("doctors")
        .select(
          `id, user_id, specialty,
           profiles:user_id (full_name, avatar_url)`
        )
        .in("id", allDoctorIds);
      if (doctorsError) throw doctorsError;

      if (!doctorsData) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      const doctorRows = doctorsData as unknown as DoctorQueryRow[];
      const doctorsWithMessages = await Promise.all(
        doctorRows.map(async (doctor) => {
          const { data: lastMsgData } = await supabase
            .from("doctor_messages")
            .select("content, created_at, sender_id")
            .eq("doctor_id", doctor.id)
            .eq("patient_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count } = await supabase
            .from("doctor_messages")
            .select("*", { count: "exact", head: true })
            .eq("doctor_id", doctor.id)
            .eq("patient_id", userId)
            .neq("sender_id", userId)
            .eq("is_read", false);

          return {
            ...doctor,
            profile: Array.isArray(doctor.profiles)
              ? doctor.profiles[0]
              : doctor.profiles,
            lastMessage: lastMsgData || undefined,
            unreadCount: count || 0,
          };
        })
      );

      doctorsWithMessages.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return (
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
        );
      });

      setDoctors(doctorsWithMessages);
    } catch (error) {
      console.error("Error loading doctors:", error);
      setDoctorsError(error instanceof Error ? error.message : "Не удалось загрузить врачей");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadClinics = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    setClinicsError(null);
    try {
      const { data: messagesData, error: clinicMessagesError } = await supabase
        .from("patient_messages")
        .select("clinic_id")
        .eq("patient_id", userId);
      if (clinicMessagesError) throw clinicMessagesError;

      const clinicIds = [
        ...new Set(messagesData?.map((m) => m.clinic_id) || []),
      ];
      if (clinicIds.length === 0) {
        setClinics([]);
        return;
      }

      const { data: clinicsData, error: clinicsError } = await supabase
        .from("clinics")
        .select("id, name, images")
        .in("id", clinicIds);
      if (clinicsError) throw clinicsError;
      if (!clinicsData) {
        setClinics([]);
        return;
      }

      const clinicsWithMessages = await Promise.all(
        clinicsData.map(async (clinic) => {
          const { data: lastMsgData } = await supabase
            .from("patient_messages")
            .select("content, created_at, sender_type")
            .eq("clinic_id", clinic.id)
            .eq("patient_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count } = await supabase
            .from("patient_messages")
            .select("*", { count: "exact", head: true })
            .eq("clinic_id", clinic.id)
            .eq("patient_id", userId)
            .eq("sender_type", "clinic")
            .eq("is_read", false);

          return {
            ...clinic,
            lastMessage: lastMsgData || undefined,
            unreadCount: count || 0,
          };
        })
      );

      clinicsWithMessages.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return (
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
        );
      });

      setClinics(clinicsWithMessages);
    } catch (error) {
      console.error("Error loading clinics:", error);
      setClinicsError(error instanceof Error ? error.message : "Не удалось загрузить клиники");
    }
  }, [user?.id]);

  const loadDoctorMessages = useCallback(async (doctorId: string) => {
    const userId = user?.id;
    if (!userId) return;
    const requestId = ++messageRequestRef.current;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const { data, error } = await supabase
        .from("doctor_messages")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("patient_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (requestId === messageRequestRef.current) setMessages(data || []);
    } catch (error) {
      if (requestId === messageRequestRef.current) {
        setMessages([]);
        setMessagesError(error instanceof Error ? error.message : "Не удалось загрузить сообщения");
      }
    } finally {
      if (requestId === messageRequestRef.current) setMessagesLoading(false);
    }
  }, [user?.id]);

  const loadClinicMessages = useCallback(async (clinicId: string) => {
    const userId = user?.id;
    if (!userId) return;
    const requestId = ++messageRequestRef.current;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const { data, error } = await supabase
        .from("patient_messages")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("patient_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (requestId === messageRequestRef.current) setMessages(data || []);
    } catch (error) {
      if (requestId === messageRequestRef.current) {
        setMessages([]);
        setMessagesError(error instanceof Error ? error.message : "Не удалось загрузить сообщения");
      }
    } finally {
      if (requestId === messageRequestRef.current) setMessagesLoading(false);
    }
  }, [user?.id]);

  const markDoctorMessagesAsRead = useCallback(async (doctorId: string) => {
    const userId = user?.id;
    if (!userId) return;
    await supabase
      .from("doctor_messages")
      .update({ is_read: true })
      .eq("doctor_id", doctorId)
      .eq("patient_id", userId)
      .neq("sender_id", userId)
      .eq("is_read", false);
    setDoctors((prev) =>
      prev.map((d) => (d.id === doctorId ? { ...d, unreadCount: 0 } : d))
    );
  }, [user?.id]);

  const markClinicMessagesAsRead = useCallback(async (clinicId: string) => {
    const userId = user?.id;
    if (!userId) return;
    await supabase
      .from("patient_messages")
      .update({ is_read: true })
      .eq("clinic_id", clinicId)
      .eq("patient_id", userId)
      .eq("sender_type", "clinic")
      .eq("is_read", false);
    setClinics((prev) =>
      prev.map((c) => (c.id === clinicId ? { ...c, unreadCount: 0 } : c))
    );
  }, [user?.id]);

  const updateDoctorLastMessage = useCallback((msg: Message) => {
    setDoctors((prev) => {
      const updated = prev.map((d) => {
        if (d.id === msg.doctor_id) {
          return {
            ...d,
            lastMessage: {
              content: msg.content || "",
              created_at: msg.created_at,
              sender_id: msg.sender_id,
            },
            unreadCount:
              msg.sender_id !== user?.id
                ? (d.unreadCount || 0) + 1
                : d.unreadCount,
          };
        }
        return d;
      });
      return updated.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return (
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
        );
      });
    });
  }, [user?.id]);

  const updateClinicLastMessage = useCallback((msg: Message) => {
    setClinics((prev) => {
      const updated = prev.map((c) => {
        if (c.id === msg.clinic_id) {
          return {
            ...c,
            lastMessage: {
              content: msg.content,
              created_at: msg.created_at,
              sender_type: msg.sender_type || "patient",
            },
            unreadCount:
              msg.sender_type === "clinic"
                ? (c.unreadCount || 0) + 1
                : c.unreadCount,
          };
        }
        return c;
      });
      return updated.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return (
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
        );
      });
    });
  }, []);

  useEffect(() => {
    if (user?.id) {
      void loadDoctors();
      void loadClinics();
    }
  }, [user?.id, loadClinics, loadDoctors]);

  useEffect(() => {
    const doctorId = selectedDoctor?.id;
    if (doctorId && user?.id) {
      void loadDoctorMessages(doctorId);
      void markDoctorMessagesAsRead(doctorId);
    }
  }, [selectedDoctor?.id, user?.id, loadDoctorMessages, markDoctorMessagesAsRead]);

  useEffect(() => {
    const clinicId = selectedClinic?.id;
    if (clinicId && user?.id) {
      void loadClinicMessages(clinicId);
      void markClinicMessagesAsRead(clinicId);
    }
  }, [selectedClinic?.id, user?.id, loadClinicMessages, markClinicMessagesAsRead]);

  useEffect(() => {
    const userId = user?.id;
    const selectedDoctorId = selectedDoctor?.id;
    const selectedClinicId = selectedClinic?.id;
    if (!userId) return;

    const doctorChannel = supabase
      .channel("patient-doctor-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "doctor_messages",
          filter: `patient_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (selectedDoctorId && newMsg.doctor_id === selectedDoctorId) {
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
            if (newMsg.sender_id !== userId) {
              void markDoctorMessagesAsRead(selectedDoctorId);
            }
          }
          updateDoctorLastMessage(newMsg);
        }
      )
      .subscribe();

    const clinicChannel = supabase
      .channel("patient-clinic-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "patient_messages",
          filter: `patient_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (selectedClinicId && newMsg.clinic_id === selectedClinicId) {
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
            if (newMsg.sender_type !== "patient") {
              void markClinicMessagesAsRead(selectedClinicId);
            }
          }
          updateClinicLastMessage(newMsg);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(doctorChannel);
      void supabase.removeChannel(clinicChannel);
    };
  }, [
    user?.id,
    selectedDoctor?.id,
    selectedClinic?.id,
    markClinicMessagesAsRead,
    markDoctorMessagesAsRead,
    scrollToBottom,
    updateClinicLastMessage,
    updateDoctorLastMessage,
  ]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendDoctorMessage = async (fileUrl?: string, fileType?: string) => {
    if ((!newMessage.trim() && !fileUrl) || !selectedDoctor || !user || sending)
      return;
    setSending(true);
    setSendError(null);
    const messageContent = newMessage.trim();
    setNewMessage("");
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
          is_read: false,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setMessages((prev) => [...prev, data]);
        updateDoctorLastMessage(data);
        setPendingFile(null);
        clearPatientDraft("message", user.id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent);
      setSendError(error instanceof Error ? error.message : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const sendClinicMessage = async (fileUrl?: string, fileType?: string) => {
    if ((!newMessage.trim() && !fileUrl) || !selectedClinic || !user || sending)
      return;
    setSending(true);
    setSendError(null);
    const messageContent = newMessage.trim();
    setNewMessage("");
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
          is_read: false,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setMessages((prev) => [...prev, data]);
        updateClinicLastMessage(data);
        setPendingFile(null);
        clearPatientDraft("message", user.id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent);
      setSendError(error instanceof Error ? error.message : "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelected = (
    fileUrl: string,
    fileType: string,
    fileName: string
  ) => {
    setPendingFile({ url: fileUrl, type: fileType, name: fileName });
  };

  const handleSendMessage = () => {
    if (selectedDoctor) sendDoctorMessage(pendingFile?.url, pendingFile?.type);
    else if (selectedClinic)
      sendClinicMessage(pendingFile?.url, pendingFile?.type);
  };

  const formatMessageTime = (dateStr: string) =>
    format(new Date(dateStr), "HH:mm", { locale: ru });

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return t("common.today");
    if (isYesterday(date)) return t("common.yesterday");
    return format(date, "d MMMM yyyy", { locale: ru });
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach((msg) => {
      const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const filteredDoctors = doctors.filter(
    (d) =>
      d.profile?.full_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      d.specialty?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClinics = clinics.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectDoctor = (doctor: Doctor) => {
    messageRequestRef.current += 1;
    setSelectedClinic(null);
    setSelectedDoctor(doctor);
    setMessages([]);
  };

  const handleSelectClinic = (clinic: Clinic) => {
    messageRequestRef.current += 1;
    setSelectedDoctor(null);
    setSelectedClinic(clinic);
    setMessages([]);
  };

  const handleBack = () => {
    messageRequestRef.current += 1;
    setSelectedDoctor(null);
    setSelectedClinic(null);
    setMessages([]);
  };

  const selectedContact = selectedDoctor || selectedClinic;
  const activeListError =
    activeTab === "doctors" ? doctorsError : clinicsError;
  const doctorsUnread = doctors.reduce(
    (sum, d) => sum + (d.unreadCount || 0),
    0
  );
  const clinicsUnread = clinics.reduce(
    (sum, c) => sum + (c.unreadCount || 0),
    0
  );

  return (
    <PatientLayout>
      <div className="h-dvh min-w-0">
        <div
          className={cn(
            "grid h-full min-w-0 overflow-hidden",
            "grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]"
          )}
        >
          {/* Left: contacts */}
          <aside
            className={cn(
              "flex min-h-0 min-w-0 flex-col border-r border-border bg-white",
              selectedContact && "hidden md:flex"
            )}
          >
            <div className="border-b border-slate-100 p-4">
              <div className="font-heading text-[18px] font-bold tracking-tight text-slate-900">
                {t("patient.messages") || t("patientCabinet.messagesTitle")}
              </div>

              {/* Tab toggle */}
              <div className="mt-3 flex items-center gap-1 rounded-[10px] bg-slate-100 p-1">
                <TabButton
                  active={activeTab === "doctors"}
                  onClick={() => setActiveTab("doctors")}
                  icon={<Stethoscope className="h-3.5 w-3.5" />}
                  label={t("patientCabinet.doctorsTab")}
                  count={doctorsUnread}
                />
                <TabButton
                  active={activeTab === "clinics"}
                  onClick={() => setActiveTab("clinics")}
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label={t("patientCabinet.clinicsTab")}
                  count={clinicsUnread}
                />
              </div>

              {/* Search */}
              <div className="relative mt-3">
                <label htmlFor="patient-message-search" className="sr-only">
                  {activeTab === "doctors" ? t("patientCabinet.searchDoctor") : t("patientCabinet.searchClinic")}
                </label>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="patient-message-search"
                  placeholder={
                    activeTab === "doctors" ? t("patientCabinet.searchDoctor") : t("patientCabinet.searchClinic")
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-slate-200 bg-white pl-9 pr-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-3 p-4" role="status" aria-live="polite" aria-label={t("common.loading")}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex animate-pulse gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-32 rounded bg-slate-100" />
                        <div className="h-3 w-48 rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeListError ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
                  <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
                  <button
                    type="button"
                    className="min-h-11 rounded-[10px] border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      if (activeTab === "doctors") void loadDoctors();
                      else void loadClinics();
                    }}
                  >
                    Повторить
                  </button>
                </div>
              ) : activeTab === "doctors" ? (
                filteredDoctors.length === 0 ? (
                  <EmptyList
                    icon={<Stethoscope className="h-10 w-10 text-slate-300" />}
                    title={
                      doctors.length === 0
                        ? t("patientCabinet.noDoctorsForChat")
                        : t("patientCabinet.notFound")
                    }
                  />
                ) : (
                  filteredDoctors.map((doctor) => {
                    const name = doctor.profile?.full_name || t("patientCabinet.doctor");
                    return (
                      <ThreadButton
                        key={doctor.id}
                        active={selectedDoctor?.id === doctor.id}
                        onClick={() => handleSelectDoctor(doctor)}
                        avatar={
                          <Avatar
                            name={name}
                            size={40}
                            src={doctor.profile?.avatar_url}
                          />
                        }
                        title={name}
                        subtitle={doctor.specialty}
                        last={
                          doctor.lastMessage
                            ? (doctor.lastMessage.sender_id === user?.id
                                ? t("patientCabinet.youPrefix")
                                : "") + (doctor.lastMessage.content || "")
                            : undefined
                        }
                        time={
                          doctor.lastMessage
                            ? formatMessageTime(
                                doctor.lastMessage.created_at
                              )
                            : undefined
                        }
                        unread={doctor.unreadCount || 0}
                      />
                    );
                  })
                )
              ) : filteredClinics.length === 0 ? (
                <EmptyList
                  icon={<Building2 className="h-10 w-10 text-slate-300" />}
                  title={
                    clinics.length === 0
                      ? t("patientCabinet.noClinicsForChat")
                      : t("patientCabinet.notFound")
                  }
                />
              ) : (
                filteredClinics.map((clinic) => (
                  <ThreadButton
                    key={clinic.id}
                    active={selectedClinic?.id === clinic.id}
                    onClick={() => handleSelectClinic(clinic)}
                    avatar={
                      <Avatar
                        name={clinic.name}
                        size={40}
                        src={clinic.images?.[0]}
                        fallbackIcon={<Building2 className="h-4 w-4" />}
                      />
                    }
                    title={clinic.name}
                    subtitle={t("patientCabinet.clinic")}
                    last={
                      clinic.lastMessage
                        ? (clinic.lastMessage.sender_type === "patient"
                            ? t("patientCabinet.youPrefix")
                            : "") +
                          (clinic.lastMessage.content || t("patientCabinet.filePrefix"))
                        : undefined
                    }
                    time={
                      clinic.lastMessage
                        ? formatMessageTime(clinic.lastMessage.created_at)
                        : undefined
                    }
                    unread={clinic.unreadCount || 0}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Right: chat */}
          <section
            className={cn(
              "flex min-h-0 min-w-0 flex-col bg-slate-50",
              !selectedContact && "hidden md:flex"
            )}
          >
            {selectedContact ? (
              <>
                {/* Header */}
                <header className="flex min-h-16 min-w-0 items-center gap-2 border-b border-border bg-white px-2 sm:gap-3 sm:px-4 md:px-6">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                    aria-label={t("common.back")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  {selectedDoctor ? (
                    <Avatar
                      name={selectedDoctor.profile?.full_name || t("patientCabinet.doctor")}
                      size={38}
                      src={selectedDoctor.profile?.avatar_url}
                    />
                  ) : (
                    <Avatar
                      name={selectedClinic?.name || t("patientCabinet.clinic")}
                      size={38}
                      src={selectedClinic?.images?.[0]}
                      fallbackIcon={<Building2 className="h-4 w-4" />}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-heading text-[14px] font-semibold text-slate-900">
                      {selectedDoctor
                        ? selectedDoctor.profile?.full_name || t("patientCabinet.doctor")
                        : selectedClinic?.name || t("patientCabinet.clinic")}
                    </div>
                    <div className="truncate text-[11.5px] text-slate-500">
                      {selectedDoctor
                        ? selectedDoctor.specialty
                        : t("patientCabinet.clinic")}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button type="button" className="hidden min-h-11 items-center gap-1.5 rounded-[10px] border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {t("patientCabinet.bookFromChat")}
                    </button>
                    <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Позвонить">
                      <Phone className="h-4 w-4" />
                    </button>
                    <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Другие действия">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                {/* Messages */}
                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground" role="status" aria-live="polite">
                      {t("common.loading")}
                    </div>
                  ) : messagesError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center" role="alert">
                      <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
                      <button
                        type="button"
                        className="min-h-11 rounded-[10px] border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          if (selectedDoctor) void loadDoctorMessages(selectedDoctor.id);
                          if (selectedClinic) void loadClinicMessages(selectedClinic.id);
                        }}
                      >
                        Повторить
                      </button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                        <div className="text-[13px] text-slate-500">
                          {selectedDoctor
                            ? t("patientCabinet.startChatDoctor")
                            : t("patientCabinet.startChatClinic")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
                      {selectedDoctor &&
                        accessRequests &&
                        accessRequests.length > 0 && (
                          <div className="space-y-2">
                            {accessRequests.map((request) => (
                              <PatientAccessRequestMessage
                                key={request.id}
                                request={request}
                                requesterName={
                                  selectedDoctor.profile?.full_name || t("patientCabinet.doctor")
                                }
                              />
                            ))}
                          </div>
                        )}

                      {Object.entries(groupMessagesByDate(messages)).map(
                        ([date, msgs]) => (
                          <div key={date}>
                            <div className="mb-3 flex justify-center">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] text-slate-500">
                                {formatDateHeader(msgs[0].created_at)}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {msgs.map((msg) => {
                                const isOwn = selectedDoctor
                                  ? msg.sender_id === user?.id
                                  : msg.sender_type === "patient";
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
                                        "min-w-0 max-w-[85%] rounded-[14px] px-4 py-2.5 text-[13.5px] sm:max-w-[520px]",
                                        isOwn
                                          ? "rounded-br-[4px] bg-[hsl(var(--brand))] text-white"
                                          : "rounded-bl-[4px] border border-slate-200 bg-white text-slate-800"
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
                                          "mt-1 flex items-center gap-1 text-[10.5px] tabular-nums",
                                          isOwn
                                            ? "justify-end text-white/70"
                                            : "justify-start text-slate-400"
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
                        )
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {pendingFile && (
                  <MessageFilePreview
                    file={pendingFile}
                    onRemove={() => setPendingFile(null)}
                  />
                )}

                {/* Input */}
                <div className="border-t border-border bg-white p-3 sm:p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex min-w-0 items-end gap-2"
                    aria-busy={sending}
                  >
                    <MessageAttachment
                      onFileSelected={handleFileSelected}
                      pendingFile={pendingFile}
                      onClearFile={() => setPendingFile(null)}
                      disabled={sending}
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor="patient-message-body" className="sr-only">
                        {t("patientCabinet.writeMessagePlaceholder")}
                      </label>
                      <textarea
                        id="patient-message-body"
                        rows={1}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={t("patientCabinet.writeMessagePlaceholder")}
                        disabled={sending}
                        className="h-11 w-full resize-none rounded-[10px] border border-slate-200 px-3 py-2 text-[13.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-describedby="patient-message-send-status"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={(!newMessage.trim() && !pendingFile) || sending}
                      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-3 py-2 text-[13px] font-medium text-white hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                      aria-label={t("patientCabinet.sendMessage")}
                    >
                      <Send className="h-4 w-4" />
                      {t("patientCabinet.sendMessage")}
                    </button>
                  </form>
                  <div
                    id="patient-message-send-status"
                    className={cn("mt-2 text-xs", sendError ? "text-destructive" : "sr-only")}
                    role={sendError ? "alert" : "status"}
                    aria-live={sendError ? "assertive" : "polite"}
                  >
                    {sendError || (sending ? t("common.loading") : "")}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {t("patientCabinet.replyTime")}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                  <div className="font-heading text-[16px] font-semibold text-slate-900">
                    {t("patientCabinet.selectContact")}
                  </div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    {t("patientCabinet.selectContactDesc")}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PatientLayout>
  );
}

// ───────────────────────── TabButton ─────────────────────────
const TabButton = ({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "bg-white text-slate-900 shadow-sm"
        : "text-slate-600 hover:text-slate-800"
    )}
  >
    {icon}
    {label}
    {count ? (
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
          active
            ? "bg-[hsl(var(--brand))] text-white"
            : "bg-slate-300 text-white"
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null}
  </button>
);

// ───────────────────────── ThreadButton ─────────────────────────
const ThreadButton = ({
  active,
  onClick,
  avatar,
  title,
  subtitle,
  last,
  time,
  unread,
}: {
  active: boolean;
  onClick: () => void;
  avatar: React.ReactNode;
  title: string;
  subtitle: string;
  last?: string;
  time?: string;
  unread: number;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex min-h-11 w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      active ? "bg-[hsl(var(--brand-50))]" : "hover:bg-slate-50"
    )}
  >
    {avatar}
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <div className="truncate font-heading text-[13.5px] font-semibold text-slate-900">
          {title}
        </div>
        {time && (
          <div className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">
            {time}
          </div>
        )}
      </div>
      <div className="truncate text-[11.5px] text-slate-500">{subtitle}</div>
      {last && (
        <div className="mt-0.5 truncate text-[12.5px] text-slate-600">
          {last}
        </div>
      )}
    </div>
    {unread > 0 && (
      <span className="mt-1 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand))] px-1 text-[10px] font-bold text-white">
        {unread > 99 ? "99+" : unread}
      </span>
    )}
  </button>
);

// ───────────────────────── EmptyList ─────────────────────────
const EmptyList = ({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="p-8 text-center">
    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center">{icon}</div>
    <div className="text-[13px] text-slate-500">{title}</div>
  </div>
);
