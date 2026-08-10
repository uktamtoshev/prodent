import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Записи клиники на сегодня — один запрос на всю «Главную».
 *
 * Запрос жил внутри виджета расписания, а показателям на «Главной» нужны те же
 * данные: сколько приёмов завершено и сколько ещё не подтвердили. Второй такой
 * же запрос был бы лишним обращением к серверу и, что хуже, мог разойтись с
 * первым во времени — виджет показывал бы одно, число над ним другое.
 *
 * Ключ запроса общий, поэтому оба потребителя читают ОДИН кеш.
 */
export interface TodayAppointment {
  id: string;
  appointment_date: string;
  service: string | null;
  status: string | null;
  notes: string | null;
  patient_id: string | null;
  profiles?: { full_name?: string | null; phone?: string | null; avatar_url?: string | null } | null;
}

/** Статусы, которые в базе означают «приём состоялся». */
const COMPLETED = new Set(["completed", "COMPLETED", "finished", "FINISHED"]);
/** Статусы, означающие «пациент ещё не подтвердил». */
const PENDING = new Set(["pending", "PENDING", "requested", "REQUESTED"]);

export function useTodayAppointments(clinicId?: string, doctorId?: string) {
  const query = useQuery({
    queryKey: ["timeline-appointments", clinicId, doctorId],
    queryFn: async (): Promise<TodayAppointment[]> => {
      if (!clinicId) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let request = supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          service,
          status,
          notes,
          patient_id,
          profiles:patient_id (
            full_name,
            phone,
            avatar_url
          )
        `,
        )
        .eq("clinic_id", clinicId)
        .gte("appointment_date", today.toISOString())
        .lt("appointment_date", tomorrow.toISOString())
        .order("appointment_date", { ascending: true });

      if (doctorId) {
        request = request.eq("doctor_id", doctorId);
      }

      const { data, error } = await request;

      // Ошибку НЕ глотаем. Раньше здесь бралось только `data`, и упавший
      // запрос давал пустой массив: экран показывал «Приёмов сегодня 0»,
      // «Завершено 0» — то есть уверенно врал вместо того, чтобы сказать,
      // что данные не загрузились. Для расписания это опаснее пустого места:
      // по нулю решают, что день свободен.
      if (error) {
        throw new Error(error.message || "Не удалось загрузить записи на сегодня");
      }

      return (data ?? []) as TodayAppointment[];
    },
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  const counts = useMemo(() => {
    const rows = query.data ?? [];
    let completed = 0;
    let pending = 0;
    for (const row of rows) {
      const status = row.status ?? "";
      if (COMPLETED.has(status)) completed += 1;
      else if (PENDING.has(status)) pending += 1;
    }
    return { total: rows.length, completed, pending };
  }, [query.data]);

  return { ...query, appointments: query.data ?? [], counts };
}
