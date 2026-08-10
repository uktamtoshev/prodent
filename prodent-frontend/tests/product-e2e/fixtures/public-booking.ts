import type { Page, Route } from "@playwright/test";

export const BOOKING_DOCTOR_ID = "doctor-acceptance";
export const BOOKING_CLINIC_ID = "clinic-acceptance";
export const BOOKING_SERVICE_ID = "service-acceptance";

export interface BookingFixtureState {
  availabilityRequests: number;
  availabilityServiceIds: Array<string | null>;
  appointmentRequests: number;
  appointmentServiceIds: Array<string | null>;
  clientRequestIds: string[];
  failAvailabilityOnce: boolean;
  emptyAvailability: boolean;
  emptyServices: boolean;
  appointmentMode: "success" | "conflict-once" | "network-once";
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function preparePublicBooking(
  page: Page,
  overrides: Partial<BookingFixtureState> = {},
): Promise<BookingFixtureState> {
  const state: BookingFixtureState = {
    availabilityRequests: 0,
    availabilityServiceIds: [],
    appointmentRequests: 0,
    appointmentServiceIds: [],
    clientRequestIds: [],
    failAvailabilityOnce: false,
    emptyAvailability: false,
    emptyServices: false,
    appointmentMode: "success",
    ...overrides,
  };

  await page.addInitScript(() => {
    const payload = btoa(
      JSON.stringify({
        sub: "patient-acceptance",
        email: "patient@acceptance.test",
        roles: ["PATIENT"],
      }),
    ).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    localStorage.setItem("prodent_access_token", `test.${payload}.signature`);
    localStorage.setItem(
      "prodent_user_profile",
      JSON.stringify({ id: "patient-acceptance", email: "patient@acceptance.test" }),
    );
    localStorage.setItem("language", "ru");
  });

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === `/api/v1/data/doctors`) {
      return json(route, { data: [{
        id: BOOKING_DOCTOR_ID,
        user_id: "doctor-user",
        clinic_id: BOOKING_CLINIC_ID,
        specialty: "Терапевт",
        experience_years: 12,
        rating: 4.9,
        reviews_count: 31,
        is_verified: true,
        is_accepting_patients: true,
      }] });
    }
    if (path === "/api/v1/data/clinic_doctor_services") {
      if (state.emptyServices) return json(route, { data: [] });
      return json(route, { data: [{
        clinic_id: BOOKING_CLINIC_ID,
        doctor_id: BOOKING_DOCTOR_ID,
        service_id: BOOKING_SERVICE_ID,
        is_active: true,
      }] });
    }
    if (path === "/api/v1/data/profiles") {
      return json(route, { data: [{
        id: "doctor-user",
        full_name: "Доктор Acceptance",
        avatar_url: null,
        is_archived: false,
      }] });
    }
    if (path === "/api/v1/data/clinics") {
      return json(route, { data: [{
        id: BOOKING_CLINIC_ID,
        name: "Acceptance Clinic",
        address: "Ташкент",
        city: "Ташкент",
        is_verified: true,
        is_active: true,
      }] });
    }
    if (path === "/api/v1/data/promotions") {
      return json(route, { data: [{
        id: "promo-1",
        title: "Летняя скидка",
        discount: 15,
        active: true,
        doctor_id: BOOKING_DOCTOR_ID,
        clinic_id: BOOKING_CLINIC_ID,
      }] });
    }
    if (path === `/api/v1/clinics/${BOOKING_CLINIC_ID}/services`) {
      return json(route, [{
        id: BOOKING_SERVICE_ID,
        clinicId: BOOKING_CLINIC_ID,
        nameRu: "Консультация",
        nameUz: "Konsultatsiya",
        price: 150000,
        currency: "UZS",
        duration: 45,
        isActive: true,
      }]);
    }
    if (path === "/api/v1/clinic-settings/booking-policy") {
      return json(route, {
        clinicId: BOOKING_CLINIC_ID,
        onlineBookingEnabled: true,
        maxAdvanceBookingDays: 30,
      });
    }
    if (path === `/api/v1/public/doctors/${BOOKING_DOCTOR_ID}/availability`) {
      state.availabilityRequests += 1;
      state.availabilityServiceIds.push(url.searchParams.get("serviceId"));
      // React Query retries failed reads three times before showing its error UI.
      if (state.failAvailabilityOnce && state.availabilityRequests <= 4) {
        return json(route, { message: "temporary" }, 503);
      }
      return json(route, {
        doctorId: BOOKING_DOCTOR_ID,
        clinicId: BOOKING_CLINIC_ID,
        serviceId: state.emptyServices ? null : BOOKING_SERVICE_ID,
        date: url.searchParams.get("date"),
        timezone: "Asia/Tashkent",
        durationMinutes: state.emptyServices ? 30 : 45,
        slots: state.emptyAvailability
          ? []
          : state.appointmentRequests > 0
          ? [{ startTime: "11:30", endTime: "12:15" }]
          : [
              { startTime: "09:15", endTime: "10:00" },
              { startTime: "11:30", endTime: "12:15" },
            ],
      });
    }
    if (path === "/api/v1/appointments" && route.request().method() === "POST") {
      state.appointmentRequests += 1;
      const body = route.request().postDataJSON() as {
        clientRequestId?: unknown;
        serviceId?: unknown;
      };
      state.clientRequestIds.push(String(body.clientRequestId ?? ""));
      state.appointmentServiceIds.push(
        typeof body.serviceId === "string" ? body.serviceId : null,
      );
      if (state.appointmentMode === "conflict-once" && state.appointmentRequests === 1) {
        return json(route, { message: "slot booked" }, 409);
      }
      if (state.appointmentMode === "network-once" && state.appointmentRequests === 1) {
        return route.abort("connectionreset");
      }
      return json(route, { id: "appointment-acceptance" }, 201);
    }
    return json(route, []);
  });

  return state;
}
