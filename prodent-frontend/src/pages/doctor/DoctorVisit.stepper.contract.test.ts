import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/doctor/DoctorVisit.tsx"),
  "utf8",
);

/**
 * The visit stepper is REAL, and the payment step is honest about roles.
 *
 * Before this contract the five-step wizard was decoration: `activeStep` was
 * used only to colour the chips, "done" meant nothing more than "a later chip
 * was clicked", and the "Payment" step had no corresponding UI at all — the
 * doctor clicked it expecting a billing screen and nothing happened.
 *
 * The payment step is also where role asymmetry must not be papered over:
 * the backend admits only CLINIC_ADMIN / CLINIC_MANAGER / ACCOUNTANT (and the
 * clinic owner) to finance writes, an appointment-linked invoice requires the
 * appointment to be COMPLETED with subtotal equal to the server-computed
 * total_price, and guest patients cannot be invoiced. Each rule is a distinct
 * UI state, not a dead button.
 */
describe("DoctorVisit stepper contract", () => {
  it("derives step completion from the draft data, not chip position", () => {
    expect(source).toContain("const stepDone");
    expect(source).toContain("draft.complaints.trim()");
    expect(source).toContain("draft.examination.trim()");
    expect(source).toContain("draft.procedures.trim()");
    // The old lie — done because a later chip is active — must not return.
    expect(source).not.toContain("const done = s.id < activeStep");
  });

  it("announces the current step and navigates to the stage's section", () => {
    expect(source).toContain('aria-current={active ? "step" : undefined}');
    expect(source).toContain("goToStep(s)");
    expect(source).toContain("scrollIntoView");
  });

  it("issues the invoice against the appointment with the server-owned total", () => {
    expect(source).toContain("createClinicInvoice(appt.clinic_id");
    expect(source).toContain("appointmentId: appt.id");
    // The amount comes from the appointment; the client must not invent it.
    expect(source).toContain("Number(appt.total_price)");
    expect(source).toContain("total_price");
  });

  it("shows no invoice button to viewers who cannot issue invoices", () => {
    // Doctors lack finance write on the backend; the UI hands off instead of
    // rendering a control that can only 403.
    expect(source).toContain('canEditModule("finance")');
    expect(source).toContain('t("doctorVisit.paymentHandoff")');
    expect(source).toContain('t("doctorVisit.paymentGuest")');
    expect(source).toContain('t("doctorVisit.paymentAfterFinish")');
  });

  it("keeps the invoice creation idempotent", () => {
    expect(source).toContain("getPersistentClientRequestId");
    expect(source).toContain("clearPersistentClientRequestId");
  });

  it("localizes every payment state in all six languages", () => {
    const keys = [
      "paymentGuest",
      "paymentHandoff",
      "paymentAfterFinish",
      "paymentNoTotal",
      "paymentIssue",
      "paymentIssued",
      "paymentOpenFinance",
      "paymentError",
    ];
    for (const lang of ["ru", "uz", "uz_cyrl", "kz", "kg", "tj"]) {
      const locale = readFileSync(
        resolve(process.cwd(), `src/i18n/locales/${lang}.doctor-schedule.ts`),
        "utf8",
      );
      for (const key of keys) {
        expect(locale, `${lang} is missing doctorVisit.${key}`).toContain(
          `${key}:`,
        );
      }
    }
  });
});
