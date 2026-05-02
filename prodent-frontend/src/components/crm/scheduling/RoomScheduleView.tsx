import { useState, useEffect, useRef } from "react";
import { format, startOfDay, addHours, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DraggableAppointmentCard } from "../calendar/DraggableAppointmentCard";
import { DroppableTimeSlot } from "../calendar/DroppableTimeSlot";
import { AppointmentModal } from "../calendar/AppointmentModal";
import { AppointmentData } from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";
import { DoorOpen, AlertCircle } from "lucide-react";

interface Room {
  id: string;
  name: string;
  is_active: boolean;
  equipment?: string[];
}

interface RoomScheduleViewProps {
  selectedDate: Date;
  searchQuery: string;
  selectedDoctor: string;
  selectedStatus: string;
}

export const RoomScheduleView = ({
  selectedDate,
  searchQuery,
  selectedDoctor,
  selectedStatus,
}: RoomScheduleViewProps) => {
  const { currentClinic } = useClinic();
  const [appointments, setAppointments] = useState<(AppointmentData & { room_id?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 13 }, (_, i) => i + 8);
  const currentHour = new Date().getHours();

  // Load rooms from clinic_settings
  const { data: rooms = [] } = useQuery({
    queryKey: ["clinic-rooms-settings", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("clinic_settings")
        .select("value")
        .eq("clinic_id", currentClinic.id)
        .eq("key", "rooms")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      const allRooms = ((data?.value as unknown) as Room[]) || [];
      return allRooms.filter((r) => r.is_active);
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    if (currentClinic) loadAppointments();
  }, [currentClinic, selectedDate]);

  useEffect(() => {
    if (scrollRef.current && currentHour >= 8 && currentHour <= 20) {
      const hourIndex = currentHour - 8;
      scrollRef.current.scrollTop = Math.max(0, hourIndex * 100 - 100);
    }
  }, [loading]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const startOfDayDate = startOfDay(selectedDate);
      const endOfDayDate = addHours(startOfDayDate, 24);

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, service, status, notes, doctor_id, patient_id,
          guest_patient_id, price, room_id,
          profiles:patient_id (full_name, phone),
          guest_patients:guest_patient_id (id, name, phone, status),
          doctors:doctor_id (id, profiles:user_id (full_name))
        `)
        .eq("clinic_id", currentClinic!.id)
        .gte("appointment_date", startOfDayDate.toISOString())
        .lt("appointment_date", endOfDayDate.toISOString())
        .order("appointment_date");

      if (error) throw error;
      setAppointments((data as any) || []);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const appointmentId = active.id as string;
    const [roomId, hourStr] = (over.id as string).split("__");
    const hour = parseInt(hourStr);
    const newDate = setMinutes(setHours(new Date(selectedDate), hour), 0);

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          room_id: roomId === "unassigned" ? null : roomId,
          appointment_date: newDate.toISOString(),
        })
        .eq("id", appointmentId);

      if (error) throw error;
      toast.success("Запись перемещена");
      loadAppointments();
    } catch {
      toast.error("Ошибка переноса");
    }
  };

  const getAppointmentsForSlot = (roomId: string | null, hour: number) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_date);
      const matchesRoom = roomId === null ? !apt.room_id : apt.room_id === roomId;
      const matchesHour = aptDate.getHours() === hour;
      const matchesStatus = selectedStatus === "all" || apt.status === selectedStatus;
      const matchesDoctor = selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
      const matchesSearch =
        !searchQuery ||
        apt.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.service?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRoom && matchesHour && matchesStatus && matchesDoctor && matchesSearch;
    });
  };

  const isCurrentHour = (hour: number) => {
    const now = new Date();
    return startOfDay(selectedDate).getTime() === startOfDay(now).getTime() && hour === currentHour;
  };

  const activeAppointment = activeId ? appointments.find((a) => a.id === activeId) : null;

  // Columns: rooms + "unassigned"
  const columns = [
    ...rooms.map((r) => ({ id: r.id, name: r.name })),
    { id: "unassigned", name: "Без кабинета" },
  ];

  if (rooms.length === 0 && !loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <DoorOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-foreground mb-1">Кабинеты не настроены</h3>
        <p className="text-sm text-muted-foreground">
          Добавьте кабинеты в разделе{" "}
          <a href="/crm/settings" className="text-primary underline">Настройки → Кабинеты</a>,
          чтобы использовать режим просмотра по кабинетам.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Header with rooms */}
        <div
          className="grid bg-muted/50 border-b border-border"
          style={{ gridTemplateColumns: `80px repeat(${columns.length}, minmax(160px, 1fr))` }}
        >
          <div className="p-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
            Время
          </div>
          {columns.map((col) => (
            <div
              key={col.id}
              className={cn(
                "p-3 font-medium text-sm text-center border-l border-border",
                col.id === "unassigned" && "text-muted-foreground italic"
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                <DoorOpen className="w-4 h-4" />
                {col.name}
              </div>
              {col.id !== "unassigned" && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {getOccupancyForRoom(col.id)} записей
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div ref={scrollRef} className="max-h-[calc(100vh-350px)] overflow-y-auto">
          {hours.map((hour) => (
            <div
              key={hour}
              className={cn(
                "grid border-t border-border/50",
                isCurrentHour(hour) && "bg-primary/5"
              )}
              style={{ gridTemplateColumns: `80px repeat(${columns.length}, minmax(160px, 1fr))` }}
            >
              <div
                className={cn(
                  "p-3 text-sm font-medium",
                  isCurrentHour(hour) ? "text-primary" : "text-muted-foreground"
                )}
              >
                {`${hour}:00`}
              </div>
              {columns.map((col) => {
                const roomId = col.id === "unassigned" ? null : col.id;
                return (
                  <DroppableTimeSlot
                    key={`${col.id}__${hour}`}
                    id={`${col.id}__${hour}`}
                    className="border-l border-border/50 min-h-[100px]"
                  >
                    {getAppointmentsForSlot(roomId, hour).map((apt) => (
                      <DraggableAppointmentCard
                        key={apt.id}
                        appointment={apt}
                        onUpdate={loadAppointments}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setIsModalOpen(true);
                        }}
                      />
                    ))}
                  </DroppableTimeSlot>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeAppointment && (
          <div className="opacity-80">
            <DraggableAppointmentCard appointment={activeAppointment} onUpdate={() => {}} />
          </div>
        )}
      </DragOverlay>

      <AppointmentModal
        appointment={selectedAppointment}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdate={loadAppointments}
      />
    </DndContext>
  );

  function getOccupancyForRoom(roomId: string) {
    return appointments.filter((a) => a.room_id === roomId).length;
  }
};
