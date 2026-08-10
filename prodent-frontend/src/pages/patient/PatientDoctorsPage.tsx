import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import {
  CalendarDays,
  Loader2,
  MessageCircle,
  Stethoscope,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface DoctorVisit {
  doctor_id: string;
  doctor: {
    id: string;
    specialty: string;
    rating: number;
    experience_years: number;
    user_id: string;
    clinic: {
      name: string;
    } | null;
  };
  visit_count: number;
  last_visit: string;
}

const PatientDoctorsPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<DoctorVisit[]>([]);
  const [doctorProfiles, setDoctorProfiles] = useState<
    Record<string, { full_name: string; avatar_url: string }>
  >({});
  const [loading, setLoading] = useState(true);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const { data: appointments } = await supabase
        .from("appointments")
        .select(
          `doctor_id, appointment_date,
           doctor:doctors(id, specialty, rating, experience_years, user_id,
                          clinic:clinics(name))`
        )
        .eq("patient_id", user?.id)
        .eq("status", "completed")
        .order("appointment_date", { ascending: false });

      if (appointments) {
        const doctorMap = new Map<string, DoctorVisit>();
        appointments.forEach((apt) => {
          if (apt.doctor) {
            const existing = doctorMap.get(apt.doctor_id);
            if (existing) existing.visit_count++;
            else
              doctorMap.set(apt.doctor_id, {
                doctor_id: apt.doctor_id,
                doctor: apt.doctor,
                visit_count: 1,
                last_visit: apt.appointment_date,
              });
          }
        });

        const doctorsList = Array.from(doctorMap.values());
        setDoctors(doctorsList);

        const userIds = doctorsList
          .map((d) => d.doctor.user_id)
          .filter(Boolean);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds);

          if (profiles) {
            const profileMap: Record<
              string,
              { full_name: string; avatar_url: string }
            > = {};
            profiles.forEach((p) => {
              profileMap[p.id] = {
                full_name: p.full_name || "",
                avatar_url: p.avatar_url || "",
              };
            });
            setDoctorProfiles(profileMap);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching doctors:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void fetchDoctors();
    }
  }, [user?.id, fetchDoctors]);

  const primaryDoctorId = useMemo(() => {
    if (doctors.length === 0) return null;
    return [...doctors].sort((a, b) => b.visit_count - a.visit_count)[0]
      .doctor_id;
  }, [doctors]);

  const specialistsWord = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t("patientCabinet.specialist1");
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100))
      return t("patientCabinet.specialistFew");
    return t("patientCabinet.specialistMany");
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--brand))]" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="mx-auto max-w-[1100px] p-6">
        {/* Header */}
        <div className="mb-5">
          <div className="text-[12.5px] text-slate-500">{t("patientCabinet.myDoctors")}</div>
          <h2 className="font-heading text-[24px] font-bold tracking-tight text-slate-900">
            {doctors.length > 0
              ? `${doctors.length} ${specialistsWord(doctors.length)}`
              : t("patientCabinet.doctors")}
          </h2>
        </div>

        {doctors.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {doctors.map((item) => {
              const profile = doctorProfiles[item.doctor.user_id];
              const fullName = profile?.full_name || t("patientCabinet.doctor");
              const isPrimary = item.doctor_id === primaryDoctorId;
              const lastVisit = format(
                new Date(item.last_visit),
                "dd.MM.yy",
                { locale: ru }
              );
              return (
                <div
                  key={item.doctor_id}
                  className="rounded-[14px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:-translate-y-[1px] hover:border-slate-300"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={fullName} size={52} fallbackInitial="D" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate font-heading text-[15px] font-bold text-slate-900">
                          {fullName}
                        </div>
                        {isPrimary && (
                          <span className="inline-flex items-center rounded-full bg-[hsl(var(--brand-50))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--brand-700))] ring-1 ring-[hsl(var(--brand)_/_0.2)]">
                            {t("patientCabinet.treatingDoctor")}
                          </span>
                        )}
                      </div>
                      <div className="text-[12.5px] text-slate-500">
                        {item.doctor.specialty}
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-400">
                        {item.doctor.clinic?.name || "—"}
                        {item.doctor.rating ? ` · ★ ${item.doctor.rating}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-[12px]">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
                        {t("patientCabinet.visitsCount")}
                      </div>
                      <div className="font-heading text-[16px] font-bold tabular-nums text-slate-900">
                        {item.visit_count}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-slate-500">
                        {t("patientCabinet.lastVisit")}
                      </div>
                      <div className="text-[13px] font-semibold tabular-nums text-slate-900">
                        {lastVisit}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => navigate(`/book/${item.doctor_id}`)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[hsl(var(--brand-700))]"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {t("patientCabinet.bookWithDoctor")}
                    </button>
                    <button
                      onClick={() => navigate(`/doctor/${item.doctor_id}`)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t("patientCabinet.writeMessage")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <Stethoscope className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <div className="font-heading text-[16px] font-semibold text-slate-900">
              {t("patientCabinet.noDoctors")}
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              {t("patientCabinet.noDoctorsDesc")}
            </div>
            <button
              onClick={() => navigate("/patient/book")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-white hover:bg-[hsl(var(--brand-700))]"
            >
              <CalendarDays className="h-4 w-4" />
              {t("patientCabinet.bookAppointment")}
            </button>
          </div>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientDoctorsPage;
