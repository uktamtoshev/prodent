import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const visitSource = readFileSync("src/pages/doctor/DoctorVisit.tsx", "utf8");
const myDaySource = readFileSync("src/pages/doctor/DoctorMyDay.tsx", "utf8");

describe("Sprint 6 doctor visit contract", () => {
  it("opens doctor-owned patient and visit routes from My Day", () => {
    expect(myDaySource).toContain("navigate(`/doctor/visit/${a.id}`)");
    expect(myDaySource).toContain("navigate(`/doctor/patients/${a.patientId}`)");
    expect(myDaySource).not.toContain("navigate(`/crm/visit/${a.id}`)");
  });

  it("captures the complete clinical visit and autosaves it locally", () => {
    for (const field of [
      "complaints",
      "examination",
      "diagnosis",
      "anesthesia",
      "procedures",
      "recommendations",
      "privateNotes",
    ]) {
      expect(visitSource).toContain(field);
    }
    expect(visitSource).toContain("saveDoctorVisitDraft");
    expect(visitSource).toContain('window.addEventListener("online"');
    expect(visitSource).toContain('window.addEventListener("offline"');
    expect(visitSource).toContain("clinicId={appt.clinic_id}");
    expect(visitSource).toContain("getVisitDocument");
    expect(visitSource).toContain("saveVisitDraft");
    expect(visitSource).toContain("expectedVersion");
    expect(visitSource).toContain("DoctorVisitApiError");
    expect(visitSource).toContain("status === 409");
  });

  it("completes through the real finish command and clears only a successful draft", () => {
    expect(visitSource).toContain('supabase.functions.invoke("finish-visit"');
    expect(visitSource).toContain("buildMedicalRecordNotes");
    expect(visitSource).toContain("expectedVersion: serverVersionRef.current");
    expect(visitSource).toContain("treatment: draft.procedures.trim()");
    expect(visitSource).toContain("clearDoctorVisitDraft");
    expect(visitSource).not.toContain("procedureSoon");
    expect(visitSource).not.toContain("teethMarkSoon");
  });

  it("keeps clinical uploads private and stores metadata instead of signed URLs", () => {
    expect(visitSource).toContain('.from("documents")');
    expect(visitSource).toContain("addVisitFile");
    expect(visitSource).not.toContain('.from("patient_files")');
    expect(visitSource).not.toContain("createSignedUrl");
    expect(visitSource).not.toContain("signedUrl");
  });

  it("keeps follow-up actions in doctor routes and offers real plan and print/history", () => {
    expect(visitSource).toContain("DoctorTreatmentPlanCreateFlow");
    expect(visitSource).toContain("window.print()");
    expect(visitSource).toContain("doctor/medical-records");
    expect(visitSource).not.toContain('navigate("/crm/');
  });
});
