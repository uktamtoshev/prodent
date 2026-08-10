import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { createAppointment, searchGuestPatients } from "@/lib/appointment-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDoctorAvailability } from "@/lib/crm-operations-api";
import { listPublicClinicServices } from "@/lib/clinic-service-management-api";
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

const normalizeUzPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return "+998" + digits.replace(/^998/, "");
};

const buildGuestAppointmentSchema = (t: (k: string) => string) =>
  z.object({
    patientType: z.enum(["registered", "guest"]),
    patient_id: z.string().optional(),
    guest_name: z.string().optional(),
    guest_phone: z.string().optional(),
    guest_comment: z.string().optional(),
    sms_consent: z.boolean().default(true),
    doctor_id: z.string().min(1, t('crmGuestAppt.validateDoctor')),
    service_id: z.string().optional(),
    date: z.date({ required_error: t('crmGuestAppt.validateDate') }),
    start_time: z.string().min(1, t('crmGuestAppt.validateTime')),
    notes: z.string().optional(),
  }).refine((data) => {
    if (data.patientType === "registered") {
      return !!data.patient_id;
    }
    return true;
  }, {
    message: t('crmGuestAppt.validatePatient'),
    path: ["patient_id"],
  }).refine((data) => {
    if (data.patientType === "guest") {
      return !!data.guest_name && data.guest_name.trim().length >= 2;
    }
    return true;
  }, {
    message: t('crmGuestAppt.validateName'),
    path: ["guest_name"],
  }).refine((data) => {
    if (data.patientType === "guest") {
      return !!data.guest_phone && phoneRegex.test(data.guest_phone);
    }
    return true;
  }, {
    message: t('crmGuestAppt.validatePhone'),
    path: ["guest_phone"],
  });

type GuestAppointmentForm = {
  patientType: "registered" | "guest";
  patient_id?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_comment?: string;
  sms_consent: boolean;
  doctor_id: string;
  service_id?: string;
  date: Date;
  start_time: string;
  notes?: string;
};

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

/**
 * Grid fallback ONLY. The picker offers the doctor's actual free slots from
 * /public/doctors/{id}/availability; this static list is what the administrator
 * sees when that call FAILS. Degrading to "all slots" instead of blocking is
 * deliberate: the server rejects a real double-booking anyway (hasConflict +
 * advisory locks), so the worst case of the fallback is the old behaviour —
 * while a hard block on an availability outage would stop all phone booking.
 */
const FALLBACK_TIME_SLOTS = [
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
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const guestAppointmentSchema = useMemo(() => buildGuestAppointmentSchema(t), [t]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [foundPatient, setFoundPatient] = useState<FoundPatient | null>(null);
  const [showFoundPatient, setShowFoundPatient] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedGuestPhone, setSelectedGuestPhone] = useState<string | null>(null);
  const searchRequestSequence = useRef(0);
  const searchAbortController = useRef<AbortController | null>(null);

  const queryClient = useQueryClient();
  const form = useForm<GuestAppointmentForm>({
    resolver: zodResolver(guestAppointmentSchema),
    defaultValues: {
      patientType: "guest",
      sms_consent: true,
      date: selectedDate || new Date(),
      start_time: "",
      doctor_id: selectedDoctorId || "",
    },
  });

  const patientType = form.watch("patientType");
  const guestPhone = form.watch("guest_phone");

  /**
   * The doctor's real free slots for the chosen day.
   *
   * Before this the picker showed 18 hardcoded times with no relation to the
   * schedule: the administrator promised a caller a slot, submitted, and the
   * conflict surfaced only as a create error — or at the chair on the day.
   * Now busy times simply are not offered. The server still enforces on write,
   * so this is UX prevention on top of enforcement, not instead of it.
   */
  const watchedDoctorId = form.watch("doctor_id");
  const watchedDate = form.watch("date");
  const watchedServiceId = form.watch("service_id");
  const availabilityDate = watchedDate ? format(watchedDate, "yyyy-MM-dd") : null;
  const availability = useQuery({
    queryKey: [
      "doctor-availability",
      watchedDoctorId,
      currentClinic?.id,
      availabilityDate,
      watchedServiceId || null,
    ],
    queryFn: () =>
      getDoctorAvailability(
        currentClinic!.id,
        watchedDoctorId,
        availabilityDate!,
        watchedServiceId || undefined,
      ),
    enabled: open && !!watchedDoctorId && !!currentClinic?.id && !!availabilityDate,
    staleTime: 30 * 1000,
    // No retries — found live: with the default 3 retries the query is not yet
    // `isError` while backing off, so the picker sat DISABLED for ~7s whenever
    // the endpoint was unavailable, instead of degrading to the static grid.
    // Failing fast is safe here: the fallback grid is offered and the server
    // still rejects genuine double-bookings on write.
    retry: false,
  });

  const freeSlots = availability.data?.slots.map((slot) => slot.startTime);
  // Fall back to the static grid only when the availability call failed;
  // an EMPTY answer is real information (fully booked day), not a failure.
  const offeredSlots = availability.isError ? FALLBACK_TIME_SLOTS : freeSlots ?? [];
  const slotsPending = availability.isLoading && !!watchedDoctorId && !!availabilityDate;

  // A slot picked before the doctor/date changed may no longer be free —
  // clear it instead of letting a stale busy time ride along to submit.
  const currentStartTime = form.watch("start_time");
  useEffect(() => {
    if (!currentStartTime || availability.isError || !availability.data) return;
    if (!availability.data.slots.some((slot) => slot.startTime === currentStartTime)) {
      form.setValue("start_time", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.data]);

  const clearGuestSelection = useCallback(() => {
    setSelectedGuestId(null);
    setSelectedGuestPhone(null);
  }, []);

  const searchByPhone = useCallback(async (
    phone: string,
    requestSequence: number,
    signal: AbortSignal,
  ) => {
    if (!currentClinic?.id) return;

    setSearchingPhone(true);
    const normalizedPhone = normalizeUzPhone(phone);

    try {
      const guestMatches = await searchGuestPatients(
        currentClinic.id,
        normalizedPhone,
        signal,
      );
      if (signal.aborted || requestSequence !== searchRequestSequence.current) return;

      if (guestMatches.length > 0) {
        const guest = guestMatches[0];
        setFoundPatient({
          id: guest.id,
          name: guest.name,
          phone: guest.phone,
          patient_type: "guest",
        });
        setShowFoundPatient(true);
        return;
      }

      // A registered patient may only be suggested when already linked to this clinic.
      const clinicPatient = patients.find(
        (patient) => normalizeUzPhone(patient.phone || "") === normalizedPhone,
      );
      if (clinicPatient) {
        setFoundPatient({
          id: clinicPatient.id,
          name: clinicPatient.full_name || t('crmGuestAppt.defaultUserName'),
          phone: clinicPatient.phone || normalizedPhone,
          patient_type: "registered",
          avatar_url: clinicPatient.avatar_url,
        });
        setShowFoundPatient(true);
        return;
      }

      setFoundPatient(null);
      setShowFoundPatient(false);
    } catch (error) {
      if (signal.aborted || requestSequence !== searchRequestSequence.current) return;
      console.error("Error searching by phone:", error);
      setFoundPatient(null);
      setShowFoundPatient(false);
    } finally {
      if (requestSequence === searchRequestSequence.current) {
        setSearchingPhone(false);
      }
    }
  }, [currentClinic?.id, patients, t]);

  useEffect(() => {
    if (selectedDoctorId) {
      form.setValue("doctor_id", selectedDoctorId);
    }
    if (selectedDate) {
      form.setValue("date", selectedDate);
    }
  }, [selectedDoctorId, selectedDate, form]);

  useEffect(() => {
    clearGuestSelection();
  }, [clearGuestSelection, currentClinic?.id, guestPhone, patientType]);

  useEffect(() => {
    if (open) return;
    searchRequestSequence.current += 1;
    searchAbortController.current?.abort();
    searchAbortController.current = null;
    clearGuestSelection();
    setFoundPatient(null);
    setShowFoundPatient(false);
    setSearchingPhone(false);
  }, [clearGuestSelection, open]);

  // Phone search with debounce. Old responses are cancelled and ignored.
  useEffect(() => {
    searchRequestSequence.current += 1;
    const requestSequence = searchRequestSequence.current;
    searchAbortController.current?.abort();
    searchAbortController.current = null;

    if (
      open &&
      patientType === "guest" &&
      guestPhone &&
      guestPhone.length >= 9 &&
      selectedGuestPhone !== normalizeUzPhone(guestPhone)
    ) {
      const controller = new AbortController();
      searchAbortController.current = controller;
      const timer = setTimeout(() => {
        void searchByPhone(guestPhone, requestSequence, controller.signal);
      }, 500);
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    } else {
      setFoundPatient(null);
      setShowFoundPatient(false);
      setSearchingPhone(false);
    }
  }, [guestPhone, open, patientType, searchByPhone, selectedGuestPhone]);

  const loadPatients = useCallback(async () => {
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
  }, [currentClinic?.id]);

  const loadDoctors = useCallback(async () => {
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
  }, [currentClinic?.id, form, selectedDoctorId]);

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
    }
  }, [currentClinic?.id]);

  useEffect(() => {
    if (!open || !currentClinic) return;
    void loadPatients();
    void loadDoctors();
    void loadServices();
  }, [currentClinic, loadDoctors, loadPatients, loadServices, open]);

  const useFoundPatient = () => {
    if (foundPatient) {
      if (foundPatient.patient_type === "registered") {
        form.setValue("patientType", "registered");
        form.setValue("patient_id", foundPatient.id);
      } else {
        setSelectedGuestId(foundPatient.id);
        setSelectedGuestPhone(normalizeUzPhone(foundPatient.phone));
        form.setValue("guest_name", foundPatient.name, { shouldValidate: true });
      }
      setShowFoundPatient(false);
    }
  };

  const onSubmit = async (values: GuestAppointmentForm) => {
    try {
      setLoading(true);

      const serviceName = values.service_id
        ? services.find((s) => s.id === values.service_id)?.name || t('crmGuestAppt.defaultService')
        : t('crmGuestAppt.defaultService');
      const isRegistered = values.patientType === "registered";
      let normalizedPhone: string | undefined;
      if (!isRegistered) {
        normalizedPhone = normalizeUzPhone(values.guest_phone!);
      }
      const reusableGuestId = !isRegistered &&
        selectedGuestId &&
        selectedGuestPhone === normalizedPhone
          ? selectedGuestId
          : undefined;

      await createAppointment({
        patientId: isRegistered ? values.patient_id : undefined,
        guestPatient: isRegistered
          ? undefined
          : {
              id: reusableGuestId,
              name: values.guest_name!,
              phone: normalizedPhone!,
              comment: values.guest_comment,
              smsConsent: values.sms_consent,
            },
        doctorId: values.doctor_id,
        clinicId: currentClinic!.id,
        serviceId: values.service_id || undefined,
        serviceName,
        appointmentDate: format(values.date, "yyyy-MM-dd"),
        startTime: values.start_time,
        notes: values.notes?.trim() || undefined,
      });

      toast.success(t('crmGuestAppt.successCreated'));
      form.reset();
      clearGuestSelection();
      setFoundPatient(null);
      setShowFoundPatient(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating appointment:", error);
      // The race is real: two administrators can pick the same free slot. The
      // server wins; tell the user WHICH problem happened and refresh the
      // slots, instead of a generic failure toast.
      const message = error instanceof Error ? error.message : "";
      if (/already booked/i.test(message)) {
        toast.error(t('crmGuestAppt.errorSlotTaken'));
        form.setValue("start_time", "");
        void queryClient.invalidateQueries({ queryKey: ["doctor-availability"] });
      } else {
        toast.error(t('crmGuestAppt.errorCreated'));
      }
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
            {t('crmGuestAppt.modalTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('crmGuestAppt.modalDesc')}
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
                  <FormLabel className="text-base font-semibold">{t('crmGuestAppt.patientType')}</FormLabel>
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
                            <p className="font-medium">{t('crmGuestAppt.registered')}</p>
                            <p className="text-xs text-muted-foreground">{t('crmGuestAppt.registeredHint')}</p>
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
                            <p className="font-medium">{t('crmGuestAppt.guest')}</p>
                            <p className="text-xs text-muted-foreground">{t('crmGuestAppt.guestHint')}</p>
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
                    <FormLabel>{t('crmGuestAppt.patient')}</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={t('crmGuestAppt.searchPatient')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('crmGuestAppt.selectPatient')} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredPatients.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                {t('crmGuestAppt.patientsNotFound')}
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
                      <FormLabel>{t('crmGuestAppt.guestNameLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('crmGuestAppt.guestNamePh')}
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
                      <FormLabel>{t('crmGuestAppt.guestPhoneLabel')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={t('crmGuestAppt.guestPhonePh')}
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
                  <Alert className="border-status-warning/30 bg-status-warning-bg">
                    <AlertCircle className="h-4 w-4 text-status-warning" />
                    <AlertDescription className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={foundPatient.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {getInitials(foundPatient.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-status-warning">
                            {t('crmGuestAppt.foundExisting')} {foundPatient.name}
                          </p>
                          <p className="text-xs text-status-warning">
                            {foundPatient.patient_type === "registered" ? t('crmGuestAppt.existingRegistered') : t('crmGuestAppt.existingGuest')} • {foundPatient.phone}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-status-warning/40 hover:bg-status-warning/10 shrink-0"
                        onClick={useFoundPatient}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t('crmGuestAppt.selectBtn')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="guest_comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crmGuestAppt.commentLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('crmGuestAppt.commentPh')}
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
                        {t('crmGuestAppt.smsConsent')}
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
                    <FormLabel>{t('crmGuestAppt.doctorLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('crmGuestAppt.doctorPh')} />
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
                  <FormLabel>{t('crmGuestAppt.serviceLabel')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('crmGuestAppt.servicePh')} />
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
                    <FormLabel>{t('crmGuestAppt.dateLabel')}</FormLabel>
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
                              <span>{t('crmGuestAppt.datePh')}</span>
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
                          disabled={(date) =>
                            // startOfDay, not "now": comparing midnight against
                            // the current moment disabled booking for TODAY —
                            // the single most common phone-booking case.
                            date < startOfDay(new Date()) || date > addDays(new Date(), 60)
                          }
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
                    <FormLabel>{t('crmGuestAppt.timeLabel')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={slotsPending || (!availability.isError && offeredSlots.length === 0)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              slotsPending
                                ? t('crmGuestAppt.slotsLoading')
                                : !availability.isError && availability.data && offeredSlots.length === 0
                                  ? t('crmGuestAppt.slotsNone')
                                  : t('crmGuestAppt.timePh')
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {offeredSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* A fully booked day is information the caller needs NOW,
                        not after a failed submit. */}
                    {!availability.isError && availability.data && offeredSlots.length === 0 ? (
                      <p className="text-xs text-status-warning" role="status">
                        {t('crmGuestAppt.slotsNoneHint')}
                      </p>
                    ) : null}
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
                  <FormLabel>{t('crmGuestAppt.notesLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('crmGuestAppt.notesPh')}
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
                {t('crmGuestAppt.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('crmGuestAppt.createBtn')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
