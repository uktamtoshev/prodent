import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { addDays, startOfDay } from "date-fns";
import { kk, ru, uz, uzCyrl } from "date-fns/locale";
import { Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { analytics } from "@/lib/analytics";
import { getClinicBookingPolicy } from "@/lib/booking-policy-api";
import {
  listPublicClinicServices,
  type ClinicService,
} from "@/lib/clinic-service-management-api";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BookingPromotion } from "@/lib/bookingPromotion";
import { getPublicDoctorAvailability } from "@/lib/publicDoctorAvailability";
import { getTashkentCalendarDate, toCalendarDateKey } from "@/lib/tashkentTime";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPatientDraft,
  loadPatientDraft,
  savePatientDraft,
} from "@/lib/patient-cabinet";
import { formatAmount, formatDate } from "@/lib/localization";
import {
  getAvailableManualTimeOptions,
  MINIMUM_BOOKING_DURATION_MINUTES,
} from "@/components/booking/manualTimeOptions";

// The real REST endpoint that validates conflicts (advisory lock + overlap),
// resolves price/duration and notifies the doctor. We use the same authed-fetch
// convention as the data shim: Bearer <prodent_access_token> against /api/v1.
const API_BASE = "/api/v1";
const TOKEN_KEY = "prodent_access_token";

interface BookingFormProps {
  doctor: {
    id: string;
    clinic_id: string;
  };
  userId: string;
  promotion?: BookingPromotion | null;
}

interface BookingDraft {
  serviceId: string;
  date: string;
  time: string;
  notes: string;
  requestReason: string;
  familyMemberId: string;
}

interface FamilyMemberOption {
  id: string;
  full_name: string;
}

export function BookingForm({ doctor, userId, promotion }: BookingFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language, t } = useLanguage();
  const dateLocale = {
    ru,
    uz,
    uz_cyrl: uzCyrl,
    kz: kk,
    kg: ru,
    tj: ru,
  }[language];
  const initialDraft = loadPatientDraft<BookingDraft>("booking", userId, {
    serviceId: searchParams.get("service") || "",
    date: "",
    time: "",
    notes: "",
    requestReason: "",
    familyMemberId: "",
  });
  const [selectedService, setSelectedService] = useState(
    searchParams.get("service") || initialDraft.serviceId,
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDraft.date ? new Date(`${initialDraft.date}T00:00:00`) : undefined,
  );
  const [selectedTime, setSelectedTime] = useState(initialDraft.time);
  const [notes, setNotes] = useState(initialDraft.notes);
  // Existing users can have a draft created before requestReason existed.
  const [requestReason, setRequestReason] = useState(initialDraft.requestReason ?? "");
  const [familyMemberId, setFamilyMemberId] = useState(initialDraft.familyMemberId);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [manualTimeNow, setManualTimeNow] = useState(() => new Date());
  const requestIdentityRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const selectionHydratedRef = useRef(false);

  const { data: familyMembers = [] } = useQuery<FamilyMemberOption[]>({
    queryKey: ["patient-family-booking-options", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_family_members")
        .select("id, full_name")
        .eq("main_patient_id", userId)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data || []) as FamilyMemberOption[];
    },
  });

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    savePatientDraft<BookingDraft>("booking", userId, {
      serviceId: selectedService,
      date: selectedDate ? toCalendarDateKey(selectedDate) : "",
      time: selectedTime,
      notes,
      requestReason,
      familyMemberId,
    });
  }, [familyMemberId, notes, requestReason, selectedDate, selectedService, selectedTime, userId]);

  // Funnel: the booking form became visible for this doctor.
  useEffect(() => {
    if (doctor?.id) analytics.bookingStarted(doctor.id);
  }, [doctor?.id]);

  // Real services from the doctor's clinic — limited to 5 most relevant
  // (sorted by price ascending so cheaper / simpler services appear first).
  const {
    data: services = [],
    isLoading: servicesLoading,
    isError: servicesError,
    refetch: refetchServices,
  } = useQuery<ClinicService[]>({
    queryKey: ["clinic-services", doctor.clinic_id],
    enabled: !!doctor.clinic_id,
    queryFn: async () => {
      const { data: assignments, error: assignmentError } = await supabase
        .from("clinic_doctor_services")
        .select("service_id")
        .eq("clinic_id", doctor.clinic_id)
        .eq("doctor_id", doctor.id)
        .eq("is_active", true);
      if (assignmentError) throw assignmentError;
      const assignedIds = new Set(
        (assignments || []).map((assignment) => assignment.service_id),
      );
      const rows = await listPublicClinicServices(doctor.clinic_id);
      return rows
        .filter((service) => assignedIds.has(service.id))
        .slice()
        .sort((left, right) => left.price - right.price)
        .slice(0, 5);
    },
  });

  const {
    data: bookingPolicy,
    isLoading: bookingPolicyLoading,
    isError: bookingPolicyError,
    refetch: refetchBookingPolicy,
  } = useQuery({
    queryKey: ["clinic-booking-policy", doctor.clinic_id],
    enabled: !!doctor.clinic_id,
    queryFn: () => getClinicBookingPolicy(doctor.clinic_id),
    staleTime: 60_000,
  });

  const selectedServiceData = services.find((service) => service.id === selectedService);
  const serviceReady = Boolean(selectedServiceData);
  const canBookWithoutService = !servicesLoading && !servicesError && services.length === 0;
  const selectionReady = serviceReady || canBookWithoutService;
  const availabilityDate = selectedDate ? toCalendarDateKey(selectedDate) : "";

  const {
    data: availability,
    isLoading: availabilityLoading,
    isError: availabilityError,
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: [
      "public-doctor-availability",
      doctor.id,
      doctor.clinic_id,
      selectedServiceData?.id ?? null,
      availabilityDate,
    ],
    enabled: Boolean(
      bookingPolicy?.onlineBookingEnabled &&
        selectionReady &&
        availabilityDate,
    ),
    queryFn: ({ signal }) =>
      getPublicDoctorAvailability(
        {
          doctorId: doctor.id,
          clinicId: doctor.clinic_id,
          serviceId: selectedServiceData?.id,
          date: availabilityDate,
        },
        { signal },
      ),
    staleTime: 15_000,
  });
  const isManualTimeRequest = Boolean(availability?.manualTimeRequestAllowed);
  const manualDurationMinutes = availability?.durationMinutes
    ?? selectedServiceData?.duration
    ?? MINIMUM_BOOKING_DURATION_MINUTES;
  const manualTimeOptions = useMemo(
    () => getAvailableManualTimeOptions({
      selectedDate: availabilityDate,
      durationMinutes: manualDurationMinutes,
      now: manualTimeNow,
    }),
    [availabilityDate, manualDurationMinutes, manualTimeNow],
  );

  useEffect(() => {
    if (!isManualTimeRequest || !availabilityDate) return;

    setManualTimeNow(new Date());
    const timer = window.setInterval(() => setManualTimeNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [availabilityDate, isManualTimeRequest]);

  useEffect(() => {
    if (
      isManualTimeRequest
      && selectedTime
      && !manualTimeOptions.includes(selectedTime)
    ) {
      setSelectedTime("");
      setCreateError(null);
    }
  }, [isManualTimeRequest, manualTimeOptions, selectedTime]);

  const formatTotalPrice = () =>
    selectedServiceData ? formatAmount(Number(selectedServiceData.price), language) : null;

  const localizedServiceName = (service: ClinicService | undefined) => {
    if (!service) return "";
    if (language === "uz") return service.nameUz?.trim() || service.nameRu;
    if (language === "uz_cyrl") return service.nameUzCyrl?.trim() || service.nameRu;
    return service.nameRu;
  };

  const displayServiceName = () =>
    selectedServiceData
      ? localizedServiceName(selectedServiceData)
      : t("booking.withoutService");

  useEffect(() => {
    if (!selectionHydratedRef.current) {
      selectionHydratedRef.current = true;
      return;
    }
    setSelectedTime("");
    setCreateError(null);
  }, [selectedService, availabilityDate]);

  const handleSubmit = async () => {
    if (!bookingPolicy || bookingPolicyError || !bookingPolicy.onlineBookingEnabled) {
      toast.error(t("booking.onlineUnavailable"));
      return;
    }
    if (!selectionReady || !selectedDate || !selectedTime) {
      toast.error(t("booking.completeFields"));
      return;
    }
    if (isManualTimeRequest && !requestReason.trim()) {
      toast.error(t("booking.requestReasonRequired"));
      return;
    }
    if (
      isManualTimeRequest
      && !getAvailableManualTimeOptions({
        selectedDate: availabilityDate,
        durationMinutes: manualDurationMinutes,
        now: new Date(),
      }).includes(selectedTime)
    ) {
      setSelectedTime("");
      toast.error(t("booking.completeFields"));
      return;
    }

    const firstAllowedDay = startOfDay(getTashkentCalendarDate());
    const lastAllowedDay = addDays(firstAllowedDay, bookingPolicy.maxAdvanceBookingDays);
    if (selectedDate < firstAllowedDay || selectedDate > lastAllowedDay) {
      toast.error(t("booking.dateOutOfRange"));
      return;
    }

    setLoading(true);
    setCreateError(null);
    analytics.bookingStarted(doctor.id);

    const appointmentDateStr = toCalendarDateKey(selectedDate);
    // Backend CreateAppointmentRequest.startTime is a LocalTime (HH:mm).
    const startTimeStr = selectedTime;
    // POST to the real endpoint: it validates availability again, resolves the
    // canonical service duration/price, and protects concurrent requests.
    const baseNotes = notes || null;
    const promotionNote = promotion
      ? `PRODENT promo: ${promotion.id} · ${promotion.title} · -${promotion.discount}%`
      : null;
    const notesText = [baseNotes, promotionNote].filter(Boolean).join("\n") || null;

    const requestBody: Record<string, unknown> = {
      doctorId: doctor.id,
      clinicId: doctor.clinic_id,
      appointmentDate: appointmentDateStr,
      startTime: startTimeStr,
      notes: notesText,
      serviceId: selectedServiceData?.id ?? null,
      familyMemberId: familyMemberId || null,
      timeRequest: isManualTimeRequest,
      requestReason: isManualTimeRequest ? requestReason.trim() : null,
    };
    const requestFingerprint = JSON.stringify(requestBody);
    if (requestIdentityRef.current?.fingerprint !== requestFingerprint) {
      requestIdentityRef.current = {
        fingerprint: requestFingerprint,
        key: crypto.randomUUID(),
      };
    }
    requestBody.clientRequestId = requestIdentityRef.current.key;

    let createdId: string | null = null;
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setLoading(false);
        if (res.status === 409) {
          setCreateError(t("booking.slotTaken"));
          setSelectedTime("");
          await refetchAvailability();
        } else {
          const message = data?.message ?? data?.error;
          // The conflict check on this endpoint also returns 400 for an
          // overlapping slot — surface a clear message either way.
          if (typeof message === "string" && /booked|slot|занят/i.test(message)) {
            setCreateError(t("booking.slotTaken"));
          } else {
            const errorText = t("booking.createError") + (message ? ": " + message : "");
            setCreateError(errorText);
          }
        }
        return;
      }

      createdId = data?.id ?? null;
      clearPatientDraft("booking", userId);
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : t("booking.networkUnavailable");
      const errorText = `${t("booking.createError")}: ${message}`;
      setCreateError(errorText);
      return;
    }

    if (!createdId) {
      const errorText = t("booking.invalidCreateResponse");
      setLoading(false);
      setCreateError(errorText);
      return;
    }

    analytics.bookingCompleted(createdId);
    setAppointmentId(createdId);
    setLoading(false);
    setConfirmed(true);
    toast.success(isManualTimeRequest ? t("booking.requestSent") : t("booking.created"));
  };

  if (confirmed) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-2xl font-semibold text-white mb-2">
          {isManualTimeRequest ? t("booking.requestSent") : t("booking.confirmed")}
        </h3>
        <p className="text-slate-300 mb-4">
          {isManualTimeRequest ? t("booking.requestedFor") : t("booking.confirmedFor")}{" "}
          {formatDate(selectedDate!, language, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          {t("booking.at")} {selectedTime}
        </p>
        <p className="text-slate-400 mb-6">
          {t("booking.service")}: {displayServiceName()}
          {formatTotalPrice() ? ` — ${formatTotalPrice()} ${t("booking.currency")}` : ""}
        </p>
        {appointmentId && (
          <p className="mb-6 text-sm text-slate-300" data-testid="appointment-number">
            {t("booking.appointmentNumber")}: <span className="font-mono">{appointmentId}</span>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/patient/appointments")} variant="outline">
            {t("booking.myAppointments")}
          </Button>
          <Button onClick={() => navigate("/")}>
            {t("booking.home")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!online && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
        >
          {t("patientCabinet.offlineDraftSaved")}
        </div>
      )}
      {promotion && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-100">
          <div className="font-semibold">{promotion.title}</div>
          <div className="text-sm mt-1">
             {t("booking.promotionApplied").replace(
               "{discount}",
               String(promotion.discount),
             )}
          </div>
        </div>
      )}
      {familyMembers.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="booking-family-member" className="text-white">
            {t("patientCabinet.bookingFor")}
          </Label>
          <select
            id="booking-family-member"
            value={familyMemberId}
            onChange={(event) => setFamilyMemberId(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 text-sm text-white"
          >
            <option value="">{t("patientCabinet.forMyself")}</option>
            {familyMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </select>
        </div>
      )}
      {/* Step 1: Service Selection */}
      <div>
        <Label className="text-white text-lg mb-3 block">{t("booking.chooseService")}</Label>
        {servicesLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[60px] rounded-lg bg-slate-700/50" />
            ))}
          </div>
        ) : servicesError ? (
          <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-red-100">
            <p>{t("booking.servicesLoadError")}</p>
            <Button className="mt-3" variant="outline" onClick={() => refetchServices()}>
              {t("booking.retry")}
            </Button>
          </div>
        ) : services.length === 0 ? (
          <div
            role="status"
            data-testid="booking-no-services"
            className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-amber-100"
          >
            {t("booking.noAvailableServices")}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {services.map((service) => (
              <button
                key={service.id}
                data-testid="booking-service-option"
                onClick={() => setSelectedService(service.id)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  selectedService === service.id
                    ? "border-primary bg-primary/10"
                    : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                }`}
              >
                <div className="font-medium text-white text-sm">{localizedServiceName(service)}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                   {formatAmount(Number(service.price), language)} {t("booking.currency")}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 + 3: Date + Time side-by-side on lg, stacked on mobile */}
      {selectionReady && (
        bookingPolicyLoading ? (
          <Skeleton className="h-[360px] rounded-lg bg-slate-700/50" />
        ) : bookingPolicyError ? (
          <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-red-100">
            <p>{t("booking.policyCheckFailed")}</p>
            <Button className="mt-3" variant="outline" onClick={() => refetchBookingPolicy()}>
              {t("booking.retry")}
            </Button>
          </div>
        ) : !bookingPolicy?.onlineBookingEnabled ? (
          <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-amber-100">
            {t("booking.clinicDisabled")}
          </div>
        ) : (
        <div className="grid lg:grid-cols-[auto_1fr] gap-6">
          <div>
            <Label className="text-white text-lg mb-3 block">{t("booking.chooseDate")}</Label>
            <div className="bg-slate-700/50 rounded-lg p-4 inline-block" data-testid="booking-calendar">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                 disabled={(date) => {
                   const today = startOfDay(getTashkentCalendarDate());
                   return date < today
                     || date > addDays(today, bookingPolicy.maxAdvanceBookingDays);
                 }}
                 locale={dateLocale}
                 formatters={{
                   formatCaption: (date) =>
                     formatDate(date, language, {
                       month: "long",
                       year: "numeric",
                     }),
                   formatWeekdayName: (date) =>
                     formatDate(date, language, { weekday: "short" }),
                 }}
                 className="text-white"
              />
            </div>
          </div>

          {selectedDate && (
            <div>
              <Label className="text-white text-lg mb-3 block">{t("booking.chooseTime")}</Label>
              {availabilityLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={index} className="h-11 rounded-lg bg-slate-700/50" />
                  ))}
                </div>
              ) : availabilityError ? (
                <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-red-100">
                  <p>{t("booking.availabilityError")}</p>
                  <Button className="mt-3" variant="outline" onClick={() => refetchAvailability()}>
                    {t("booking.retry")}
                  </Button>
                </div>
              ) : isManualTimeRequest ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-amber-100">
                  <p className="mb-3 text-sm">{t("booking.manualTimeHelp")}</p>
                  <Label htmlFor="booking-requested-time" className="mb-2 block text-white">
                    {t("booking.requestedTime")}
                  </Label>
                  <select
                    id="booking-requested-time"
                    value={selectedTime}
                    onChange={(event) => {
                      setSelectedTime(event.target.value);
                      setCreateError(null);
                    }}
                    className="min-h-11 w-full rounded-md border border-slate-600 bg-slate-900 px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    required
                    aria-required="true"
                  >
                    <option value="">{t("booking.requestedTimePlaceholder")}</option>
                    {manualTimeOptions.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              ) : availability?.slots.length === 0 ? (
                <div role="status" className="rounded-lg border border-slate-600 bg-slate-700/50 p-4 text-slate-200">
                  {t("booking.noAvailableSlots")}
                </div>
              ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availability?.slots.map((slot) => (
                  <button
                    key={slot.startTime}
                    data-testid="booking-slot"
                    data-slot-time={slot.startTime}
                    onClick={() => {
                      setSelectedTime(slot.startTime);
                      setCreateError(null);
                    }}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedTime === slot.startTime
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-600 bg-slate-700/50 text-white hover:border-slate-500"
                    }`}
                  >
                    {slot.startTime}
                  </button>
                ))}
              </div>
              )}
              {availability && (
                <p className="mt-2 text-xs text-slate-400">
                  {t("booking.duration")}: {availability.durationMinutes} {t("booking.min")}
                  {" · "}{availability.timezone}
                </p>
              )}
            </div>
          )}
        </div>
        )
      )}

      {createError && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
          {createError}
        </div>
      )}

      {selectedTime && isManualTimeRequest && (
        <div>
          <Label htmlFor="request-reason" className="text-white text-lg mb-3 block">
            {t("booking.requestReasonLabel")}
          </Label>
          <Textarea
            id="request-reason"
            value={requestReason}
            onChange={(event) => setRequestReason(event.target.value)}
            placeholder={t("booking.requestReasonPlaceholder")}
            className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
            maxLength={2000}
            required
            aria-required="true"
          />
          {!requestReason.trim() && (
            <p className="mt-2 text-sm text-amber-200" role="status">
              {t("booking.requestReasonRequired")}
            </p>
          )}
        </div>
      )}

      {/* Step 4: Notes */}
      {selectedTime && (
        <div>
          <Label htmlFor="notes" className="text-white text-lg mb-3 block">
            {t("booking.notesLabel")}
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("booking.notesPlaceholder")}
            className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
          />
        </div>
      )}

      {/* Submit Button */}
      {selectionReady && selectedDate && selectedTime && (
        <div className="pt-4 border-t border-slate-700">
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
            <h4 className="text-white font-semibold mb-2">{t("booking.details")}</h4>
            <div className="space-y-1 text-sm text-slate-300">
              <p>{t("booking.service")}: {displayServiceName()}</p>
               <p>
                 {t("booking.date")}:{" "}
                 {formatDate(selectedDate, language, {
                   weekday: "long",
                   day: "numeric",
                   month: "long",
                   year: "numeric",
                 })}
               </p>
              <p>{t("booking.time")}: {selectedTime}</p>
              {formatTotalPrice() && (
                <p className="text-white font-medium mt-2">
                  {t("booking.price")}: {formatTotalPrice()} {t("booking.currency")}
                </p>
              )}
            </div>
          </div>
          <Button
            data-testid="booking-submit"
            onClick={handleSubmit}
            disabled={loading || (isManualTimeRequest && !requestReason.trim())}
            size="lg"
            className="w-full"
          >
            {loading
              ? t("booking.creating")
              : createError
                ? t("booking.retry")
                : isManualTimeRequest
                  ? t("booking.sendRequest")
                  : t("booking.confirmAppointment")}
          </Button>
        </div>
      )}
    </div>
  );
}
