import type { AppointmentData } from "@/components/crm/calendar/appointmentConstants";
import type { User } from "@/integrations/supabase/client";

export interface TestClinic {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly timezone: "Asia/Tashkent";
  readonly phone: string;
  readonly isActive: boolean;
}

export const TEST_USERS = Object.freeze([
  Object.freeze({
    id: "10000000-0000-4000-8000-000000000001",
    email: "doctor.fixture@prodent.test",
    phone: "+998900000001",
    role: "doctor",
    firstName: "Aziz",
    lastName: "Karimov",
    full_name: "Aziz Karimov",
    created_at: "2026-01-15T09:00:00.000Z",
    user_metadata: Object.freeze({
      first_name: "Aziz",
      last_name: "Karimov",
      full_name: "Aziz Karimov",
      roles: Object.freeze(["doctor"]),
    }),
  }),
  Object.freeze({
    id: "10000000-0000-4000-8000-000000000002",
    email: "patient.fixture@prodent.test",
    phone: "+998900000002",
    role: "patient",
    firstName: "Madina",
    lastName: "Aliyeva",
    full_name: "Madina Aliyeva",
    created_at: "2026-01-15T09:05:00.000Z",
    user_metadata: Object.freeze({
      first_name: "Madina",
      last_name: "Aliyeva",
      full_name: "Madina Aliyeva",
      roles: Object.freeze(["patient"]),
    }),
  }),
] as const satisfies readonly User[]);

export const TEST_CLINICS = Object.freeze([
  Object.freeze({
    id: "20000000-0000-4000-8000-000000000001",
    name: "Prodent Test Clinic",
    slug: "prodent-test-clinic",
    timezone: "Asia/Tashkent",
    phone: "+998712000001",
    isActive: true,
  }),
] as const satisfies readonly TestClinic[]);

export const TEST_APPOINTMENTS = Object.freeze([
  Object.freeze({
    id: "30000000-0000-4000-8000-000000000001",
    appointment_date: "2026-08-03T09:30:00.000+05:00",
    start_time: "09:30:00",
    room_id: "room-fixture-01",
    service: "Dental check-up",
    status: "confirmed",
    notes: "Deterministic test appointment",
    doctor_id: TEST_USERS[0].id,
    patient_id: TEST_USERS[1].id,
    price: 250_000,
    profiles: Object.freeze({
      full_name: TEST_USERS[1].full_name,
      phone: TEST_USERS[1].phone,
    }),
    doctors: Object.freeze({
      profiles: Object.freeze({
        full_name: TEST_USERS[0].full_name,
      }),
      cooperation_type: "staff",
    }),
  }),
] as const satisfies readonly AppointmentData[]);

export interface AuthenticatedCrmFixtureContract {
  readonly storageStateEnvironmentVariable: "PRODENT_E2E_STORAGE_STATE";
  readonly requiredRole: "clinic_admin" | "clinic_owner";
  readonly targetRoute: "/crm";
  readonly containsRealPatientData: false;
}

/**
 * Contract for a future authenticated CRM fixture.
 * No token, password or real patient data belongs in source control.
 */
export const AUTHENTICATED_CRM_FIXTURE_CONTRACT =
  Object.freeze<AuthenticatedCrmFixtureContract>({
    storageStateEnvironmentVariable: "PRODENT_E2E_STORAGE_STATE",
    requiredRole: "clinic_admin",
    targetRoute: "/crm",
    containsRealPatientData: false,
  });
