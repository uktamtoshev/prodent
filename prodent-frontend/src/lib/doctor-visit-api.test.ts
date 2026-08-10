import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DoctorVisitApiError,
  getVisitDocument,
  getVisitHistory,
  addVisitFile,
  saveVisitDraft,
} from "./doctor-visit-api";

describe("doctor visit API", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("prodent_access_token", "doctor-token");
    vi.restoreAllMocks();
  });

  it("loads the authoritative visit draft with the doctor token", async () => {
    const response = {
      id: "record-1",
      appointmentId: "appointment-1",
      status: "DRAFT",
      version: 3,
      privateNotes: "doctor only",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    await expect(getVisitDocument("appointment-1")).resolves.toMatchObject(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/appointments/appointment-1/visit",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer doctor-token",
        }),
      }),
    );
  });

  it("saves with optimistic version and all server-owned clinical fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "record-1",
        appointmentId: "appointment-1",
        status: "DRAFT",
        version: 4,
        replayed: false,
      }), { status: 200 }),
    );

    await saveVisitDraft("appointment-1", {
      expectedVersion: 3,
      diagnosis: "Diagnosis",
      treatment: "Treatment",
      anesthesia: "Anesthesia",
      notes: "Notes",
      privateNotes: "Private",
    });

    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe(
      "/api/v1/appointments/appointment-1/visit/draft",
    );
    expect(request[1]?.method).toBe("PUT");
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      expectedVersion: 3,
      privateNotes: "Private",
    });
  });

  it("exposes a 409 conflict so the UI can merge instead of overwriting", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Version conflict" }), {
        status: 409,
      }),
    );

    await expect(
      saveVisitDraft("appointment-1", {
        expectedVersion: 1,
        diagnosis: null,
        treatment: null,
        anesthesia: null,
        notes: null,
        privateNotes: null,
      }),
    ).rejects.toMatchObject<Partial<DoctorVisitApiError>>({
      status: 409,
    });
  });

  it("loads version history from the record-scoped endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );

    await getVisitHistory("record-1");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/appointments/visit-records/record-1/history",
    );
  });

  it("stores visit file metadata through the dedicated record endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "file-1" }), { status: 200 }),
    );

    await addVisitFile("record-1", {
      file_name: "xray.png",
      storage_key: "doctor-1/visits/visit-1/xray.png",
      content_type: "image/png",
      size_bytes: 42,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/appointments/visit-records/record-1/files",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      file_name: "xray.png",
      storage_key: "doctor-1/visits/visit-1/xray.png",
      content_type: "image/png",
      size_bytes: 42,
    });
  });
});
