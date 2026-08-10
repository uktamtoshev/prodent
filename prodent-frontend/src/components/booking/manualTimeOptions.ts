import { TASHKENT_TIME_ZONE } from "@/lib/tashkentTime";

const MINUTES_PER_DAY = 24 * 60;
const MANUAL_TIME_STEP_MINUTES = 15;
export const MINIMUM_BOOKING_DURATION_MINUTES = 30;

export const MANUAL_TIME_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / MANUAL_TIME_STEP_MINUTES },
  (_, index) => {
    const totalMinutes = index * MANUAL_TIME_STEP_MINUTES;
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
    const minutes = (totalMinutes % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  },
);

interface ManualTimeOptionsInput {
  selectedDate: string;
  durationMinutes?: number | null;
  now?: Date;
}

interface TashkentDateTime {
  date: string;
  minutesSinceMidnight: number;
}

function getTashkentDateTime(now: Date): TashkentDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TASHKENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  const hours = Number(part("hour"));
  const minutes = Number(part("minute"));

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutesSinceMidnight: hours * 60 + minutes,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getAvailableManualTimeOptions({
  selectedDate,
  durationMinutes,
  now = new Date(),
}: ManualTimeOptionsInput): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return [];

  const tashkentNow = getTashkentDateTime(now);
  if (selectedDate < tashkentNow.date) return [];

  const duration = Number.isFinite(durationMinutes) && Number(durationMinutes) > 0
    ? Math.ceil(Number(durationMinutes))
    : MINIMUM_BOOKING_DURATION_MINUTES;

  return MANUAL_TIME_OPTIONS.filter((time) => {
    const startMinutes = timeToMinutes(time);
    const endsBeforeNextDay = startMinutes + duration < MINUTES_PER_DAY;
    if (!endsBeforeNextDay) return false;

    return selectedDate !== tashkentNow.date
      || startMinutes > tashkentNow.minutesSinceMidnight;
  });
}
