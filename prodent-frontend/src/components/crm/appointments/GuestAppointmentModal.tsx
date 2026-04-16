import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CalendarIcon, 
  User, 
  UserPlus, 
  Phone, 
  Search, 
  AlertCircle,
  Check,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Phone validation for Uzbekistan format
const phoneRegex = /^\+998[0-9]{9}$/;

const guestAppointmentSchema = z.object({
  patientType: z.enum(["registered", "guest"]),
  // Registered patient fields
  patient_id: z.string().optional(),
  // Guest patient fields
  guest_name: z.string().optional(),
  guest_phone: z.string().optional(),
  guest_comment: z.string().optional(),
  sms_consent: z.boolean().default(true),
  // Common fields
  doctor_id: z.string().min(1, "Выберите врача"),
  service_id: z.string().optional(),
  date: z.date({ required_error: "Выберите дату" }),
  start_time: z.string().min(1, "Укажите время"),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.patientType === "registered") {
    return !!data.patient_id;
  }
  return true;
}, {
  message: "Выберите пациента",
  path: ["patient_id"],
}).refine((data) => {
  if (data.patientType === "guest") {
    return !!data.guest_name && data.guest_name.trim().length >= 2;
  }
  return true;
}, {
  message: "Укажите имя пациента (минимум 2 символа)",
  path: ["guest_name"],
}).refine((data) => {
  if (data.patientType === "guest") {
    return !!data.guest_phone && phoneRegex.test(data.guest_phone);
  }
  return true;
}, {
  message: "Введите корректный номер телефона (+998XXXXXXXXX)",
  path: ["guest_phone"],
});

type GuestAppointmentForm = z.infer<typeof guestAppointmentSchema>;

interface GuestAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  selectedDoctorId?: string;
  onSuccess?: () => void;
}

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
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

interface FoundPatient {
  id: string;
  name: string;
  phone: string;
  patient_type: "registered" | "guest";
  avatar_url?: string;
}

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"
];

export function GuestAppointmentModal({
  open,
  onOpenChange,
  selectedDate,
  selectedDoctorId,
  onSuccess,
}: GuestAppointmentModalProps) {
  const { currentClinic } = useClinic();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [phoneSearchTerm, setPhoneSearchTerm] = useState("");
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [foundPatient, setFoundPatient] = useState<FoundPatient | null>(null);
  const [showFoundPatient, setShowFoundPatient] = useState(false);

  const form = useForm<GuestAppointmentForm>({
    resolver: zodResolver(guestAppointmentSchema),
    defaultValues: {
      patientType: "guest",
      sms_consent: true,
      date: selectedDate || new Date(),
      start_time: "09:00",
      doctor_id: selectedDoctorId || "",
    },
  });

  const patientType = form.watch("patientType");
  const guestPhone = form.watch("guest_phone");

  useEffect(() => {
    if (open && currentClinic) {
      loadPatients();
      loadDoctors();
      loadServices();
    }
  }, [open, currentClinic]);

  useEffect(() => {
    if (selectedDoctorId) {
      form.setValue("doctor_id", selectedDoctorId);
    }
    if (selectedDate) {
      form.setValue("date", selectedDate);
    }
  }, [selectedDoctorId, selectedDate, form]);

  // Phone search with debounce
  useEffect(() => {
    if (patientType === "guest" && guestPhone && guestPhone.length >= 9) {
      const timer = setTimeout(() => {
        searchByPhone(guestPhone);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setFoundPatient(null);
      setShowFoundPatient(false);
    }
  }, [guestPhone, patientType]);

  const searchByPhone = async (phone: string) => {
    if (!currentClinic?.id) return;
    
    setSearchingPhone(true);
    try {
      // Normalize phone for search
      let normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.startsWith("998")) {
        normalizedPhone = "+" + normalizedPhone;
      } else if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = "+998" + normalizedPhone;
      }

      // 1. Search within clinic via RPC
      const { data, error } = await supabase.rpc("find_patient_by_phone", {
        p_phone: normalizedPhone,
        p_clinic_id: currentClinic.id,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setFoundPatient({
          id: data[0].id,
          name: data[0].name,
          phone: data[0].phone,
          patient_type: data[0].patient_type as "registered" | "guest",
          avatar_url: data[0].avatar_url,
        });
        setShowFoundPatient(true);
        return;
      }

      // 2. Search globally in profiles (user exists in system but not in this clinic)
      const { data: globalProfile } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (globalProfile) {
        setFoundPatient({
          id: globalProfile.id,
          name: globalProfile.full_name || "Пользователь",
          phone: globalProfile.phone || normalizedPhone,
          patient_type: "registered",
          avatar_url: globalProfile.avatar_url,
        });
        setShowFoundPatient(true);
        return;
      }

      setFoundPatient(null);
      setShowFoundPatient(false);
    } catch (error) {
      console.error("Error searching by phone:", error);
    } finally {
      setSearchingPhone(false);
    }
  };

  const loadPatients = async () => {
    try {
      if (!currentClinic?.id) return;
      
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
        .select("id, full_name, phone, avatar_url")
        .in("id", patientIds)
        .order("full_name");

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error("Error loading patients:", error);
    }
  };

  const loadDoctors = async () => {
    try {
      if (!currentClinic?.id) return;
      
      // 1. Doctors with clinic_id directly set
      const { data: doctorsByClinic } = await supabase
        .from("doctors")
        .select(`
          id,
          profiles:user_id (
            full_name
          )
        `)
        .eq("clinic_id", currentClinic.id);

      // 2. Doctors via clinic_members
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

      // 3. Doctors via doctor_clinic_affiliations (independent/affiliated)
      const { data: affiliatedDoctorIds } = await supabase
        .from("doctor_clinic_affiliations")
        .select("doctor_id")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);

      let doctorsByAffiliation: Doctor[] = [];
      const affDoctorIds = affiliatedDoctorIds?.map(a => a.doctor_id) || [];
      if (affDoctorIds.length > 0) {
        const { data } = await supabase
          .from("doctors")
          .select(`
            id,
            profiles:user_id (
              full_name
            )
          `)
          .in("id", affDoctorIds);
        
        doctorsByAffiliation = (data || []) as Doctor[];
      }

      // Merge all sources, deduplicate by id
      const allDoctors = [...(doctorsByClinic || [])] as Doctor[];
      [...doctorsByMembers, ...doctorsByAffiliation].forEach(doc => {
        if (!allDoctors.some(d => d.id === doc.id)) {
          allDoctors.push(doc);
        }
      });

      setDoctors(allDoctors);
      
      // Auto-select if only one doctor
      if (allDoctors.length === 1 && !selectedDoctorId) {
        form.setValue("doctor_id", allDoctors[0].id);
      }
    } catch (error) {
      console.error("Error loading doctors:", error);
    }
  };

  const loadServices = async () => {
    try {
      if (!currentClinic?.id) return;
      
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error loading services:", error);
    }
  };

  const useFoundPatient = () => {
    if (foundPatient) {
      if (foundPatient.patient_type === "registered") {
        form.setValue("patientType", "registered");
        form.setValue("patient_id", foundPatient.id);
      }
      // For guest, we can reuse the existing guest record
      setShowFoundPatient(false);
    }
  };

  const onSubmit = async (values: GuestAppointmentForm) => {
    try {
      setLoading(true);

      const appointmentDate = new Date(values.date);
      const [hour, minute] = values.start_time.split(":").map(Number);
      appointmentDate.setHours(hour, minute, 0, 0);

      let patientId: string | null = null;
      let guestPatientId: string | null = null;

      if (values.patientType === "registered") {
        patientId = values.patient_id!;
      } else {
        // Create or find guest patient
        let normalizedPhone = values.guest_phone!.replace(/\D/g, "");
        if (!normalizedPhone.startsWith("+")) {
          normalizedPhone = "+998" + normalizedPhone.replace(/^998/, "");
        }

        // Check if guest already exists (by phone in this clinic)
        if (foundPatient && foundPatient.patient_type === "guest") {
          guestPatientId = foundPatient.id;
          
          // Update guest info if needed
          await supabase
            .from("guest_patients")
            .update({
              name: values.guest_name,
              comment: values.guest_comment,
              sms_consent: values.sms_consent,
            })
            .eq("id", guestPatientId);
        } else {
          // Create new guest patient
          const { data: guestData, error: guestError } = await supabase
            .from("guest_patients")
            .insert({
              clinic_id: currentClinic!.id,
              name: values.guest_name,
              phone: normalizedPhone,
              comment: values.guest_comment,
              sms_consent: values.sms_consent,
              status: "guest",
            })
            .select()
            .single();

          if (guestError) throw guestError;
          guestPatientId = guestData.id;
        }
      }

      // Create appointment
      const serviceName = values.service_id
        ? services.find((s) => s.id === values.service_id)?.name || "Консультация"
        : "Консультация";

      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          clinic_id: currentClinic!.id,
          patient_id: patientId,
          guest_patient_id: guestPatientId,
          doctor_id: values.doctor_id,
          appointment_date: appointmentDate.toISOString(),
          service: serviceName,
          notes: values.notes,
          status: "pending",
        });

      if (appointmentError) throw appointmentError;

      toast.success("Запись успешно создана");
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Ошибка создания записи");
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
  );

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Новая запись
          </DialogTitle>
          <DialogDescription>
            Создайте запись для зарегистрированного пациента или гостя
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Patient Type Toggle */}
            <FormField
              control={form.control}
              name="patientType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-semibold">Тип пациента</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div>
                        <RadioGroupItem
                          value="registered"
                          id="registered"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="registered"
                          className={cn(
                            "flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all",
                            "hover:bg-muted/50",
                            field.value === "registered"
                              ? "border-primary bg-primary/5"
                              : "border-muted"
                          )}
                        >
                          <User className={cn(
                            "h-5 w-5",
                            field.value === "registered" ? "text-primary" : "text-muted-foreground"
                          )} />
                          <div>
                            <p className="font-medium">Зарегистрированный</p>
                            <p className="text-xs text-muted-foreground">Пациент с аккаунтом</p>
                          </div>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem
                          value="guest"
                          id="guest"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="guest"
                          className={cn(
                            "flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all",
                            "hover:bg-muted/50",
                            field.value === "guest"
                              ? "border-primary bg-primary/5"
                              : "border-muted"
                          )}
                        >
                          <UserPlus className={cn(
                            "h-5 w-5",
                            field.value === "guest" ? "text-primary" : "text-muted-foreground"
                          )} />
                          <div>
                            <p className="font-medium">Гость</p>
                            <p className="text-xs text-muted-foreground">Без регистрации</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Registered Patient Selection */}
            {patientType === "registered" && (
              <FormField
                control={form.control}
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пациент</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Поиск по имени или телефону..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите пациента" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredPatients.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                Пациенты не найдены
                              </div>
                            ) : (
                              filteredPatients.map((patient) => (
                                <SelectItem key={patient.id} value={patient.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{patient.full_name}</span>
                                    <span className="text-muted-foreground">— {patient.phone}</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Guest Patient Fields */}
            {patientType === "guest" && (
              <div className="space-y-4 p-4 rounded-xl bg-muted/30 border">
                <FormField
                  control={form.control}
                  name="guest_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имя пациента *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Введите имя пациента" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guest_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="+998 XX XXX XX XX" 
                            className="pl-9"
                            {...field}
                          />
                          {searchingPhone && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Found Patient Alert */}
                {showFoundPatient && foundPatient && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={foundPatient.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {getInitials(foundPatient.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">
                            В системе уже есть пользователь: {foundPatient.name}
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {foundPatient.patient_type === "registered" ? "Зарегистрирован в системе" : "Гость клиники"} • {foundPatient.phone}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-amber-300 hover:bg-amber-100 shrink-0"
                        onClick={useFoundPatient}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Выбрать
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="guest_comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Комментарий</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Дополнительная информация о пациенте..." 
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sms_consent"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        Согласен получать SMS-напоминания
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Doctor Selection - hide if only one doctor */}
            {doctors.length > 1 && (
              <FormField
                control={form.control}
                name="doctor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Врач *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите врача" />
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
            )}

            {/* Service Selection */}
            <FormField
              control={form.control}
              name="service_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Услуга</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите услугу (опционально)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} — {service.price.toLocaleString()} UZS
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Дата *</FormLabel>
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
                              format(field.value, "d MMMM", { locale: ru })
                            ) : (
                              <span>Выберите дату</span>
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
                          disabled={(date) => date < new Date() || date > addDays(new Date(), 60)}
                          locale={ru}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Время *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Время" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечание к записи</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Дополнительная информация..." 
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Создать запись
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
