import { describe, expect, it } from "vitest";
import {
  buildMedicalRecordNotes,
  canEditDoctorVisitDraft,
  canFinishDoctorVisit,
  clearDoctorVisitDraft,
  createEmptyDoctorVisitDraft,
  loadDoctorVisitDraft,
  reconcileDoctorVisitDrafts,
  saveDoctorVisitDraft,
  shouldClearDoctorVisitDraftForAccessStatus,
} from "./doctor-visit-draft";

describe("doctor visit draft", () => {
  it("keeps the complete clinical draft on the device during a network failure", () => {
    const storage = new Map<string, string>();
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
    const draft = {
      ...createEmptyDoctorVisitDraft(),
      complaints: "Болит 46 зуб",
      examination: "Кариозная полость",
      diagnosis: "Кариес дентина",
      anesthesia: "Артикаин",
      procedures: "Препарирование и пломба",
      recommendations: "Не есть 2 часа",
      privateNotes: "Проверить при следующем визите",
    };

    saveDoctorVisitDraft(store, "doctor-1", "visit-1", draft, 4);

    const restored = loadDoctorVisitDraft(store, "doctor-1", "visit-1");
    expect(restored).toMatchObject({
      ...draft,
      serverVersion: 4,
      updatedAt: expect.any(String),
    });
  });

  it("isolates sensitive drafts by doctor and clears only the requested doctor's copy", () => {
    const storage = new Map<string, string>();
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
    const first = { ...createEmptyDoctorVisitDraft(), privateNotes: "first doctor" };
    const second = { ...createEmptyDoctorVisitDraft(), privateNotes: "second doctor" };

    saveDoctorVisitDraft(store, "doctor-1", "visit-1", first, 1);
    saveDoctorVisitDraft(store, "doctor-2", "visit-1", second, 1);
    clearDoctorVisitDraft(store, "doctor-1", "visit-1");

    expect(loadDoctorVisitDraft(store, "doctor-1", "visit-1").privateNotes).toBe("");
    expect(loadDoctorVisitDraft(store, "doctor-2", "visit-1").privateNotes).toBe("second doctor");
  });

  it("deletes an unsafe legacy unscoped draft without assigning it to the current doctor", () => {
    const storage = new Map<string, string>([
      ["prodent:doctor-visit-draft:visit-1", JSON.stringify({
        ...createEmptyDoctorVisitDraft(),
        privateNotes: "unknown owner",
      })],
    ]);
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };

    expect(loadDoctorVisitDraft(store, "doctor-1", "visit-1").privateNotes).toBe("");
    expect(storage.has("prodent:doctor-visit-draft:visit-1")).toBe(false);
  });

  it("rejects corrupt or mismatched persisted data instead of showing unsafe content", () => {
    const corrupt = {
      getItem: () => '{"version":99,"complaints":"wrong version"}',
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(loadDoctorVisitDraft(corrupt, "doctor-1", "visit-1")).toEqual(
      createEmptyDoctorVisitDraft(),
    );
  });

  it("does not silently overlay a stale local draft over a newer server version", () => {
    const server = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "server diagnosis",
      serverVersion: 5,
      updatedAt: "2026-07-25T10:00:00.000Z",
    };
    const local = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "stale local diagnosis",
      serverVersion: 4,
      updatedAt: "2026-07-25T09:00:00.000Z",
    };

    expect(reconcileDoctorVisitDrafts(server, local, 5)).toEqual({
      kind: "conflict",
      draft: local,
    });
  });

  it("requires an explicit choice when local and server both changed", () => {
    const server = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "server diagnosis",
      serverVersion: 5,
      updatedAt: "2026-07-25T10:00:00.000Z",
    };
    const local = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "local diagnosis",
      serverVersion: 4,
      updatedAt: "2026-07-25T11:00:00.000Z",
    };

    expect(reconcileDoctorVisitDrafts(server, local, 5)).toEqual({
      kind: "conflict",
      draft: local,
    });
  });

  it("keeps an offline local edit based on the current server version", () => {
    const server = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "server diagnosis",
      serverVersion: 5,
      updatedAt: "2026-07-25T10:00:00.000Z",
    };
    const local = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "offline local diagnosis",
      serverVersion: 5,
      updatedAt: "2026-07-25T11:00:00.000Z",
    };

    expect(reconcileDoctorVisitDrafts(server, local, 5)).toEqual({
      kind: "local",
      draft: local,
    });
  });

  it("does not discard a same-version offline edit when the device clock is behind", () => {
    const server = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "server diagnosis",
      serverVersion: 5,
      updatedAt: "2026-07-25T10:00:00.000Z",
    };
    const local = {
      ...createEmptyDoctorVisitDraft(),
      diagnosis: "offline edit",
      serverVersion: 5,
      updatedAt: "2020-01-01T00:00:00.000Z",
    };

    expect(reconcileDoctorVisitDrafts(server, local, 5)).toEqual({
      kind: "local",
      draft: local,
    });
  });

  it("blocks finishing until a detected conflict is explicitly resolved", () => {
    expect(canFinishDoctorVisit(false, false)).toBe(true);
    expect(canFinishDoctorVisit(true, false)).toBe(false);
    expect(canFinishDoctorVisit(false, true)).toBe(false);
  });

  it("freezes clinical editing while finish is in progress", () => {
    expect(canEditDoctorVisitDraft(false)).toBe(true);
    expect(canEditDoctorVisitDraft(true)).toBe(false);
  });

  it("clears sensitive content only for authentication and authorization errors", () => {
    expect(shouldClearDoctorVisitDraftForAccessStatus(401)).toBe(true);
    expect(shouldClearDoctorVisitDraftForAccessStatus(403)).toBe(true);
    expect(shouldClearDoctorVisitDraftForAccessStatus(404)).toBe(false);
    expect(shouldClearDoctorVisitDraftForAccessStatus(500)).toBe(false);
  });

  it("builds one deterministic medical record for the real finish-visit command", () => {
    const notes = buildMedicalRecordNotes({
        ...createEmptyDoctorVisitDraft(),
        complaints: "Боль",
        examination: "Отёк",
        procedures: "Осмотр",
        recommendations: "Полоскание",
        privateNotes: "Внутренняя заметка",
      });
    expect(notes).toBe(
      [
        "Жалобы:\nБоль",
        "Осмотр:\nОтёк",
        "Рекомендации:\nПолоскание",
      ].join("\n\n"),
    );
    expect(notes).not.toContain("Внутренняя заметка");
  });
});
