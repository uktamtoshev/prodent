import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { format, startOfDay, addHours, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  pointerWithin,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DraggableAppointmentCard } from "../calendar/DraggableAppointmentCard";
import { DroppableTimeSlot } from "../calendar/DroppableTimeSlot";
import {
  AppointmentData,
  appointmentMatchesStatus,
  getAppointmentHour,
} from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";
import { DoorOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { placeAppointment } from "@/lib/appointment-api";
import { fetchClinicSetting, readClinicRooms } from "@/lib/clinic-settings";

const AppointmentModal = lazy(() =>
  import("../calendar/AppointmentModal").then((module) => ({
    default: module.AppointmentModal,
  })),
);

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
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [appointments, setAppointments] = useState<
    (AppointmentData & { room_id?: string | null })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
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
      const rooms = await fetchClinicSetting(currentClinic.id, "rooms");
      return readClinicRooms(rooms).filter((room) => room.is_active);
    },
    enabled: !!currentClinic?.id,
  });

  const loadAppointments = useCallback(async () => {
    if (!currentClinic) return;
    try {
      setLoading(true);
      const startOfDayDate = startOfDay(selectedDate);
      const endOfDayDate = addHours(startOfDayDate, 24);

      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id, appointment_date, start_time, service, status, notes, doctor_id, patient_id,
          guest_patient_id, total_price, room_id,
          profiles:patient_id (full_name, phone),
          guest_patients:guest_patient_id (id, name, phone, status),
          doctors:doctor_id (id, profiles:user_id (full_name))
        `,
        )
        .eq("clinic_id", currentClinic.id)
        .gte("appointment_date", startOfDayDate.toISOString())
        .lt("appointment_date", endOfDayDate.toISOString())
        .order("appointment_date");

      if (error) throw error;
      setAppointments(
        (data ?? []) as (AppointmentData & { room_id?: string | null })[],
      );
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic, selectedDate]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (scrollRef.current && currentHour >= 8 && currentHour <= 20) {
      const hourIndex = currentHour - 8;
      scrollRef.current.scrollTop = Math.max(0, hourIndex * 100 - 100);
    }
  }, [loading, currentHour]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const appointmentId = active.id as string;
    const [roomId, hourStr] = (over.id as string).split("__");
    const hour = parseInt(hourStr);
    const newDate = setMinutes(setHours(new Date(selectedDate), hour), 0);

    try {
      await placeAppointment({
        appointmentId,
        roomId: roomId === "unassigned" ? null : roomId,
        appointmentDate: format(newDate, "yyyy-MM-dd"),
        startTime: format(newDate, "HH:mm"),
      });
      toast.success(t("crmScheduleHeader.apptMoved"));
      loadAppointments();
    } catch {
      toast.error(t("crmScheduleHeader.moveError"));
    }
  };

  const getAppointmentsForSlot = (roomId: string | null, hour: number) => {
    return appointments.filter((apt) => {
      const matchesRoom =
        roomId === null ? !apt.room_id : apt.room_id === roomId;
      const matchesHour = getAppointmentHour(apt) === hour;
      const matchesStatus = appointmentMatchesStatus(
        apt.status,
        selectedStatus,
      );
      const matchesDoctor =
        selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
      const matchesSearch =
        !searchQuery ||
        apt.profiles?.full_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        apt.service?.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        matchesRoom &&
        matchesHour &&
        matchesStatus &&
        matchesDoctor &&
        matchesSearch
      );
    });
  };

  const isCurrentHour = (hour: number) => {
    const now = new Date();
    return (
      startOfDay(selectedDate).getTime() === startOfDay(now).getTime() &&
      hour === currentHour
    );
  };

  const activeAppointment = activeId
    ? appointments.find((a) => a.id === activeId)
    : null;

  // Columns: rooms + "unassigned"
  const columns = [
    ...rooms.map((r) => ({ id: r.id, name: r.name })),
    { id: "unassigned", name: t("crmScheduleHeader.noRoom") },
  ];

  if (rooms.length === 0 && !loading) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/80 p-8 text-center shadow-soft">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <DoorOpen className="h-7 w-7" />
        </div>
        <h3 className="mb-1 font-semibold text-foreground">
          {t("crmScheduleHeader.roomsNotConfigured")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("crmScheduleHeader.addRoomsHint")}{" "}
          <a href="/crm/settings" className="text-primary underline">
            {t("crmScheduleHeader.settingsRooms")}
          </a>
          {t("crmScheduleHeader.toUseRoomsView")}
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
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/90 shadow-soft">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Header with rooms */}
            <div
              className="sticky top-0 z-10 grid border-b border-border/60 bg-muted/80 backdrop-blur-sm"
              style={{
                gridTemplateColumns: `80px repeat(${columns.length}, minmax(160px, 1fr))`,
              }}
            >
              <div className="p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("crmScheduleHeader.time")}
              </div>
              {columns.map((col) => (
                <div
                  key={col.id}
                  className={cn(
                    "border-l border-border/60 p-3 text-center text-sm font-semibold",
                    col.id === "unassigned" && "text-muted-foreground italic",
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <DoorOpen className="h-4 w-4" />
                    {col.name}
                  </div>
                  {col.id !== "unassigned" && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {getOccupancyForRoom(col.id)}{" "}
                      {t("crmScheduleHeader.apptsOf")}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Time slots */}
            <div
              ref={scrollRef}
              className="max-h-[calc(100vh-350px)] overflow-y-auto bg-background/30"
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    "grid border-t border-border/40 transition-colors",
                    isCurrentHour(hour) && "bg-primary/5",
                  )}
                  style={{
                    gridTemplateColumns: `80px repeat(${columns.length}, minmax(160px, 1fr))`,
                  }}
                >
                  <div
                    className={cn(
                      "bg-card/45 p-3 text-sm font-medium",
                      isCurrentHour(hour)
                        ? "text-primary"
                        : "text-muted-foreground",
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
                        className="min-h-[104px] border-l border-border/40 p-1.5 transition-colors hover:bg-muted/30"
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
        </div>
      </div>

      <DragOverlay>
        {activeAppointment && (
          <div className="opacity-80">
            <DraggableAppointmentCard
              appointment={activeAppointment}
              onUpdate={() => {}}
            />
          </div>
        )}
      </DragOverlay>

      {isModalOpen && selectedAppointment && (
        <Suspense fallback={null}>
          <AppointmentModal
            appointment={selectedAppointment}
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            onUpdate={loadAppointments}
          />
        </Suspense>
      )}
    </DndContext>
  );

  function getOccupancyForRoom(roomId: string) {
    return appointments.filter((a) => a.room_id === roomId).length;
  }
};
