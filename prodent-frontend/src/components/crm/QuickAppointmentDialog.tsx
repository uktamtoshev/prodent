import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { createAppointment } from "@/lib/appointment-api";
import { listPublicClinicServices } from "@/lib/clinic-service-management-api";

// Validation messages are translated when the form is rendered.
const appointmentSchema = z.object({
  patient_id: z.string().min(1, "Patient required"),
  doctor_id: z.string().min(1, "Doctor required"),
  service_id: z.string().optional(),
  date: z.date({ required_error: "Date required" }),
  start_time: z.string().min(1, "Start time required"),
  end_time: z.string().min(1, "End time required"),
  notes: z.string().optional(),
});

type AppointmentForm = z.infer<typeof appointmentSchema>;

interface QuickAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
}

interface Patient {
  id: string;
  full_name: string;
  phone: string;
}

interface Doctor {
  id: string;
  profiles: {
    full_name: string;
  };
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export const QuickAppointmentDialog = ({
  open,
  onOpenChange,
  selectedDate,
}: QuickAppointmentDialogProps) => {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      date: selectedDate || new Date(),
      start_time: "09:00",
      end_time: "10:00",
    },
  });

  const loadPatients = useCallback(async () => {
    try {
      if (!currentClinic?.id) return;
      
      // Получаем пациентов через clinic_members
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic.id)
        .eq("role", "patient");

      if (!members || members.length === 0) {
        setPatients([]);
        return;
      }

      const patientIds = members.map(m => m.user_id);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", patientIds)
        .order("full_name");

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error("Error loading patients:", error);
      toast.error(t('crmQuickAppointment.loadPatientsError'));
    }
  }, [currentClinic?.id, t]);

  const loadDoctors = useCallback(async () => {
    try {
      if (!currentClinic?.id) return;
      
      // Получаем врачей через clinic_id
      const { data: doctorsByClinic } = await supabase
        .from("doctors")
        .select(`
          id,
          user_id,
          profiles:user_id (
            full_name
          )
        `)
        .eq("clinic_id", currentClinic.id);

      // Получаем врачей через clinic_members
      const { data: doctorMembers } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic.id)
        .eq("role", "doctor");

      const memberUserIds = doctorMembers?.map(m => m.user_id) || [];

      let doctorsByMembers: Doctor[] = [];
      if (memberUserIds.length > 0) {
        const { data } = await supabase
          .from("doctors")
          .select(`
            id,
            profiles:user_id (
              full_name
            )
          `)
          .in("user_id", memberUserIds);
        
        doctorsByMembers = (data || []) as Doctor[];
      }

      // Объединяем и убираем дубликаты
      const allDoctors = [...(doctorsByClinic || [])] as Doctor[];
      doctorsByMembers.forEach(doc => {
        if (!allDoctors.some(d => d.id === doc.id)) {
          allDoctors.push(doc);
        }
      });

      setDoctors(allDoctors);
    } catch (error) {
      console.error("Error loading doctors:", error);
      toast.error(t('crmQuickAppointment.loadDoctorsError'));
    }
  }, [currentClinic?.id, t]);

  const loadServices = useCallback(async () => {
    try {
      if (!currentClinic?.id) return;

      const rows = await listPublicClinicServices(currentClinic.id);
      setServices(rows
        .map((service) => ({
          id: service.id,
          name: service.nameRu,
          price: service.price,
          duration_minutes: service.duration,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "ru")));
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error(t('crmQuickAppointment.loadServicesError'));
    }
  }, [currentClinic?.id, t]);

  useEffect(() => {
    if (open && currentClinic) {
      loadPatients();
      loadDoctors();
      loadServices();
    }
  }, [open, currentClinic, loadPatients, loadDoctors, loadServices]);

  const checkTimeConflict = async (doctorId: string, date: Date, startTime: string, endTime: string) => {
    const appointmentDate = new Date(date);
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    
    appointmentDate.setHours(startHour, startMinute, 0, 0);
    const endDateTime = new Date(appointmentDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    const { data, error } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("clinic_id", currentClinic!.id)
      .gte("appointment_date", appointmentDate.toISOString())
      .lt("appointment_date", endDateTime.toISOString())
      .neq("status", "cancelled");

    if (error) throw error;
    return (data || []).length > 0;
  };

  const onSubmit = async (values: AppointmentForm) => {
    try {
      setLoading(true);

      // Check for time conflicts
      const hasConflict = await checkTimeConflict(
        values.doctor_id,
        values.date,
        values.start_time,
        values.end_time
      );

      if (hasConflict) {
        toast.error(t('crmQuickAppointment.doctorBusy'));
        return;
      }

      const appointmentDate = new Date(values.date);
      const [hour, minute] = values.start_time.split(":").map(Number);
      appointmentDate.setHours(hour, minute, 0, 0);

      const serviceName = values.service_id
        ? services.find((s) => s.id === values.service_id)?.name || t('crmQuickAppointment.consultation')
        : t('crmQuickAppointment.consultation');
      const appointmentData = await createAppointment({
        patientId: values.patient_id,
        doctorId: values.doctor_id,
        clinicId: currentClinic!.id,
        serviceId: values.service_id || undefined,
        serviceName,
        appointmentDate: format(values.date, "yyyy-MM-dd"),
        startTime: values.start_time,
        notes: values.notes?.trim() || undefined,
      });

      // Create notification for patient
      await supabase.from("notifications").insert({
        user_id: values.patient_id,
        type: "internal",
        title: t('crmQuickAppointment.newAppointment'),
        message: `${t('crmQuickAppointment.appointmentMessage')} ${format(appointmentDate, `d MMMM yyyy '${t('crmQuickAppointment.atTime')}' HH:mm`, { locale: ru })}`,
        metadata: { appointment_id: appointmentData.id },
      });

      toast.success(t('crmQuickAppointment.appointmentCreated'));
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error(t('crmQuickAppointment.appointmentError'));
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('crmQuickAppointment.title')}</DialogTitle>
          <DialogDescription>
            {t('crmQuickAppointment.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('crmQuickAppointment.patient')}</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        placeholder={t('crmQuickAppointment.searchByNameOrPhone')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('crmQuickAppointment.selectPatient')} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredPatients.map((patient) => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.full_name} - {patient.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="doctor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('crmQuickAppointment.doctor')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('crmQuickAppointment.selectDoctor')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.profiles?.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="service_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('crmQuickAppointment.serviceOptional')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('crmQuickAppointment.selectService')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - {service.price} UZS ({service.duration_minutes} {t('crmQuickAppointment.minShort')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('crmQuickAppointment.date')}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ru })
                          ) : (
                            <span>{t('crmQuickAppointment.selectDate')}</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crmQuickAppointment.startTime')}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crmQuickAppointment.endTime')}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('crmQuickAppointment.commentOptional')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('crmQuickAppointment.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('crmQuickAppointment.creating') : t('crmQuickAppointment.create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
