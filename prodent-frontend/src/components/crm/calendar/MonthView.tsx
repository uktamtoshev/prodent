import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { fetchClinicDoctors } from "@/hooks/useClinicDoctors";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal, UserCheck, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppointmentModal } from "./AppointmentModal";
import { AppointmentData, APPOINTMENT_STATUSES, getAppointmentTime, getStatusStyle, AppointmentStatus, appointmentMatchesStatus, normalizeAppointmentStatus } from "./appointmentConstants";
import { useLanguage } from "@/contexts/LanguageContext";
import { setAppointmentStatus } from "@/lib/appointment-api";
import { a11yLabel } from "@/lib/a11y-labels";

interface MonthViewProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

interface Doctor {
  id: string;
  profiles: {
    full_name: string;
  };
}

export const MonthView = ({ selectedDate, onDateChange }: MonthViewProps) => {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [services, setServices] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadDoctors = useCallback(async () => {
    try {
      const data = await fetchClinicDoctors(currentClinic!.id);
      setDoctors(data as Doctor[]);
    } catch (error) {
      console.error("Error loading doctors:", error);
      toast.error(t('crmCalView.loadDoctorsError'));
    }
  }, [currentClinic, t]);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      // First get personal patient IDs
      const { data: personalPatients } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic!.id)
        .eq("role", "patient")
        .not("assigned_doctor_id", "is", null);
      
      const personalPatientIds = new Set(personalPatients?.map(p => p.user_id) || []);

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          start_time,
          room_id,
          service,
          status,
          notes,
          doctor_id,
          patient_id,
          total_price,
          profiles:patient_id (
            full_name,
            phone
          ),
          doctors:doctor_id (
            cooperation_type,
            profiles:user_id (
              full_name
            )
          )
        `)
        .eq("clinic_id", currentClinic!.id)
        .gte("appointment_date", monthStart.toISOString())
        .lte("appointment_date", monthEnd.toISOString())
        .order("appointment_date");

      if (error) throw error;
      
      // Mark appointments with personal patients
      const appointmentData = (data || []).map(apt => ({
        ...apt,
        isPersonalPatient: personalPatientIds.has(apt.patient_id) || 
          apt.doctors?.cooperation_type === 'chair_rental'
      }));
      
      setAppointments(appointmentData);
      
      // Extract unique services
      const uniqueServices = [
        ...new Set<string>(
          appointmentData
            .map((appointment) => appointment.service)
            .filter((service: unknown): service is string => typeof service === "string"),
        ),
      ];
      setServices(uniqueServices);
    } catch (error) {
      console.error("Error loading appointments:", error);
      toast.error(t('crmCalView.loadAppointmentsError'));
    } finally {
      setLoading(false);
    }
  }, [currentClinic, selectedDate, t]);

  useEffect(() => {
    if (currentClinic) {
      loadDoctors();
      loadAppointments();
    }
  }, [currentClinic, loadAppointments, loadDoctors]);

  const goToPreviousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const goToCurrentMonth = () => {
    onDateChange(new Date());
  };

  const updateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      await setAppointmentStatus({ appointmentId, status: newStatus });

      toast.success(t('crmEnhancedQueue.statusUpdated'));
      loadAppointments();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t('crmCalView.statusUpdateError'));
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesDoctor = selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
    const matchesStatus = appointmentMatchesStatus(apt.status, selectedStatus);
    const matchesService = selectedService === "all" || apt.service === selectedService;
    return matchesDoctor && matchesStatus && matchesService;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth} aria-label={a11yLabel("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
            {t('crmCalView.currentMonth')}
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth} aria-label={a11yLabel("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-bold ml-2 capitalize">
            {format(selectedDate, "LLLL yyyy", { locale: ru })}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('crmCalView.allDoctors')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('crmCalView.allDoctors')}</SelectItem>
              {doctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.profiles?.full_name || t('crmApptModal.doctorLabel')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('crmCalView.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('crmCalView.allStatuses')}</SelectItem>
              {Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('crmCalView.allServices')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('crmCalView.allServices')}</SelectItem>
              {services.map((service) => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('crmCalView.dateTime')}</TableHead>
              <TableHead>{t('crmApptModal.patient')}</TableHead>
              <TableHead>{t('crmCreatePlanDialog.typeColumn')}</TableHead>
              <TableHead>{t('crmApptModal.doctorLabel')}</TableHead>
              <TableHead>{t('crmTreatmentDialogs.service')}</TableHead>
              <TableHead>{t('crmTreatmentDialogs.planStatus')}</TableHead>
              <TableHead className="w-[50px]">{t('crmCalView.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAppointments.map((apt) => {
              const statusStyle = getStatusStyle(apt.status);
              const isPersonal = apt.isPersonalPatient;
              return (
                <TableRow 
                  key={apt.id} 
                  className={`cursor-pointer hover:bg-muted/50 ${isPersonal ? 'bg-status-warning/5' : ''}`}
                  onClick={() => {
                    setSelectedAppointment(apt);
                    setIsModalOpen(true);
                  }}
                >
                  <TableCell className="font-medium">
                    {format(new Date(apt.appointment_date), "d MMM yyyy", { locale: ru })}, {getAppointmentTime(apt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {isPersonal && <UserCheck className="h-4 w-4 text-status-warning mt-0.5 flex-shrink-0" />}
                      <div>
                        <div className="font-medium">{apt.profiles?.full_name || "—"}</div>
                        <div className="text-sm text-muted-foreground">{apt.profiles?.phone}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isPersonal ? (
                      <Badge variant="outline" className="bg-status-warning/10 text-status-warning border-status-warning/30">
                        {t('crmCalView.outsideCashbox')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Building2 className="h-3 w-3 mr-1" />
                        {t('crmCalView.clinic')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{apt.doctors?.profiles?.full_name || "—"}</TableCell>
                  <TableCell>{apt.service}</TableCell>
                  <TableCell>
                    <Badge 
                      className={`${statusStyle.bgColor} ${statusStyle.color} ${statusStyle.borderColor} border`}
                    >
                      {statusStyle.label}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={a11yLabel("more")}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Object.entries(APPOINTMENT_STATUSES)
                          .filter(([key]) => key !== normalizeAppointmentStatus(apt.status))
                          .map(([key, value]) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => updateStatus(apt.id, key)}
                            >
                              {value.label}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredAppointments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t('crmCalView.noAppointments')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AppointmentModal
        appointment={selectedAppointment}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdate={loadAppointments}
      />
    </div>
  );
};
