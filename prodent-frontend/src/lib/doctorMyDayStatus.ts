export type DoctorMyDayStatus = "done" | "now" | "next" | "upcoming";

export function getDoctorMyDayStatus(
  status: string | null | undefined,
  start: Date,
  now = Date.now(),
): DoctorMyDayStatus {
  const value = (status || "").toLowerCase();
  if (value === "completed" || value === "done") return "done";
  if (value === "in_progress" || value === "in-progress") return "now";

  const startTime = start.getTime();
  if (startTime >= now && startTime < now + 30 * 60_000) return "next";
  return "upcoming";
}
