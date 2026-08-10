import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import {
  AppointmentData,
  APPOINTMENT_STATUSES,
  AppointmentStatus,
  appointmentMatchesStatus,
} from "../calendar/appointmentConstants";
import { AppointmentListItem } from "./AppointmentListItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { setAppointmentStatus } from "@/lib/appointment-api";

const AppointmentModal = lazy(() =>
  import("../calendar/AppointmentModal").then((module) => ({
    default: module.AppointmentModal,
  })),
);

interface MonthScheduleViewProps {
  selectedDate: Date;
  searchQuery: string;
  selectedDoctor: string;
  selectedStatus: string;
}

export const MonthScheduleView = ({
  selectedDate,
  searchQuery,
  selectedDoctor,
  selectedStatus,
}: MonthScheduleViewProps) => {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      const { data: personalPatients } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic!.id)
        .eq("role", "patient")
        .not("assigned_doctor_id", "is", null);

      const personalPatientIds = new Set(
        personalPatients?.map((p) => p.user_id) || [],
      );

      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          start_time,
          room_id,
          service,
          status,
          notes,
          doctor_id,
          patient_id,
          guest_patient_id,
          total_price,
          profiles:patient_id (
            full_name,
            phone
          ),
          guest_patients:guest_patient_id (
            id,
            name,
            phone,
            status
          ),
          doctors:doctor_id (
            cooperation_type,
            profiles:user_id (
              full_name
            )
          )
        `,
        )
        .eq("clinic_id", currentClinic!.id)
        .gte("appointment_date", monthStart.toISOString())
        .lte("appointment_date", monthEnd.toISOString())
        .order("appointment_date");

      if (error) throw error;

      const appointmentData = (data || []).map((apt) => ({
        ...apt,
        isPersonalPatient:
          personalPatientIds.has(apt.patient_id || "") ||
          apt.doctors?.cooperation_type === "chair_rental",
        isGuestPatient: !!apt.guest_patient_id,
      }));

      setAppointments(appointmentData);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic, selectedDate]);

  useEffect(() => {
    if (currentClinic) {
      loadAppointments();
    }
  }, [currentClinic, loadAppointments]);

  const handleStatusChange = async (
    appointmentId: string,
    newStatus: AppointmentStatus,
  ) => {
    try {
      await setAppointmentStatus({ appointmentId, status: newStatus });

      toast.success(t("crmStatusDropdown.statusChanged"));
      loadAppointments();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t("crmStatusDropdown.statusError"));
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesDoctor =
      selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
    const matchesStatus = appointmentMatchesStatus(apt.status, selectedStatus);
    const matchesSearch =
      !searchQuery ||
      apt.profiles?.full_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      apt.service?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDoctor && matchesStatus && matchesSearch;
  });

  // Group by date
  const groupedByDate = filteredAppointments.reduce(
    (acc, apt) => {
      const dateKey = format(new Date(apt.appointment_date), "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(apt);
      return acc;
    },
    {} as Record<string, AppointmentData[]>,
  );

  const sortedDates = Object.keys(groupedByDate).sort();

  if (loading) {
    return (
      <div className="space-y-4 rounded-2xl border border-border/50 bg-card/80 p-4 shadow-soft">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-12 text-center text-muted-foreground shadow-soft">
          <p className="text-lg font-medium text-foreground">
            {t("crmStatusDropdown.noApptsFound")}
          </p>
          <p className="mt-1 text-sm">
            {t("crmStatusDropdown.tryChangeFilters")}
          </p>
        </div>
      ) : (
        sortedDates.map((dateKey) => {
          const dayAppointments = groupedByDate[dateKey];
          const date = new Date(dateKey);
          const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;

          return (
            <div
              key={dateKey}
              className="overflow-hidden rounded-2xl border border-border/50 bg-card/90 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-border/50 bg-muted/40 px-4 py-3">
                <h3
                  className={`text-sm font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}
                >
                  {format(date, "d MMMM, EEEE", { locale: ru })}
                </h3>
                {isToday && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t("crmStatusDropdown.todayLabel")}
                  </span>
                )}
                <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border/40">
                  {dayAppointments.length}{" "}
                  {dayAppointments.length === 1
                    ? t("crmStatusDropdown.apptOne")
                    : t("crmStatusDropdown.apptsMany")}
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {dayAppointments.map((apt) => (
                  <AppointmentListItem
                    key={apt.id}
                    appointment={apt}
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setIsModalOpen(true);
                    }}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

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
    </div>
  );
};
