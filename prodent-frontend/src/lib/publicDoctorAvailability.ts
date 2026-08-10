const PUBLIC_DOCTOR_ROOT = "/api/v1/public/doctors";

export interface PublicDoctorAvailabilityInput {
  doctorId: string;
  clinicId: string;
  /**
   * Optional — mirrors the backend (`@RequestParam(required = false)`).
   * Without a service the backend falls back to the default slot duration,
   * which is exactly what the staff booking modal needs before a service is
   * picked.
   */
  serviceId?: string;
  date: string;
}

export interface PublicDoctorAvailabilitySlot {
  startTime: string;
  endTime: string;
}

export interface PublicDoctorAvailability {
  doctorId: string;
  clinicId: string;
  serviceId?: string | null;
  date: string;
  timezone: "Asia/Tashkent";
  durationMinutes: number;
  manualTimeRequestAllowed: boolean;
  slots: PublicDoctorAvailabilitySlot[];
}

export interface PublicDoctorAvailabilityOptions {
  signal?: AbortSignal;
}

export class PublicDoctorAvailabilityError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PublicDoctorAvailabilityError";
  }
}

export function buildPublicDoctorAvailabilityUrl(
  input: PublicDoctorAvailabilityInput,
): string {
  const params = new URLSearchParams({ clinicId: input.clinicId });
  // Omitted entirely when absent: an empty serviceId= would rely on Spring
  // coercing "" to null for a UUID param, which is not worth depending on.
  // Inserted between clinicId and date to keep the historical param order
  // that the URL contract test pins.
  if (input.serviceId) params.set("serviceId", input.serviceId);
  params.set("date", input.date);
  return `${PUBLIC_DOCTOR_ROOT}/${encodeURIComponent(input.doctorId)}/availability?${params}`;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof body.message === "string" && body.message) return body.message;
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // Keep a stable fallback for non-JSON proxy errors.
  }
  return `HTTP ${response.status}`;
}

export async function getPublicDoctorAvailability(
  input: PublicDoctorAvailabilityInput,
  options: PublicDoctorAvailabilityOptions = {},
): Promise<PublicDoctorAvailability> {
  const response = await fetch(buildPublicDoctorAvailabilityUrl(input), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new PublicDoctorAvailabilityError(await readError(response), response.status);
  }

  return (await response.json()) as PublicDoctorAvailability;
}
