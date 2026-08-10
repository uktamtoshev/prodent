import { describe, expect, it } from "vitest";

import {
  AUTHENTICATED_CRM_FIXTURE_CONTRACT,
  TEST_APPOINTMENTS,
  TEST_CLINICS,
  TEST_USERS,
} from "./fixtures";

describe("deterministic test fixtures", () => {
  it("links the appointment to known doctor and patient records", () => {
    const appointment = TEST_APPOINTMENTS[0];

    expect(appointment.doctor_id).toBe(TEST_USERS[0].id);
    expect(appointment.patient_id).toBe(TEST_USERS[1].id);
    expect(appointment.appointment_date).toBe("2026-08-03T09:30:00.000+05:00");
  });

  it("uses reserved test values instead of production identities", () => {
    expect(TEST_USERS.every((user) => user.email?.endsWith(".test"))).toBe(true);
    expect(TEST_CLINICS[0].slug).toBe("prodent-test-clinic");
  });

  it("keeps fixture collections and records readonly at runtime", () => {
    expect(Object.isFrozen(TEST_USERS)).toBe(true);
    expect(Object.isFrozen(TEST_USERS[0])).toBe(true);
    expect(Object.isFrozen(TEST_CLINICS)).toBe(true);
    expect(Object.isFrozen(TEST_APPOINTMENTS)).toBe(true);
  });

  it("documents authenticated CRM without embedding credentials", () => {
    expect(AUTHENTICATED_CRM_FIXTURE_CONTRACT).toEqual({
      storageStateEnvironmentVariable: "PRODENT_E2E_STORAGE_STATE",
      requiredRole: "clinic_admin",
      targetRoute: "/crm",
      containsRealPatientData: false,
    });
  });
});
