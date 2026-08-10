import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appointmentStartsAt,
  clearPatientDraft,
  loadPatientDraft,
  openPrivatePatientFile,
  savePatientDraft,
} from "./patient-cabinet";

describe("patient cabinet contracts", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps a later appointment today in the upcoming list", () => {
    const now = new Date("2026-07-24T09:00:00+05:00");

    expect(
      appointmentStartsAt("2026-07-24", "14:30:00").getTime(),
    ).toBeGreaterThan(now.getTime());
  });

  it("stores, restores and clears a user-scoped draft", () => {
    savePatientDraft("message", "patient-1", { text: "Не потерять" });

    expect(loadPatientDraft("message", "patient-1", { text: "" })).toEqual({
      text: "Не потерять",
    });
    expect(loadPatientDraft("message", "patient-2", { text: "" })).toEqual({
      text: "",
    });

    clearPatientDraft("message", "patient-1");
    expect(loadPatientDraft("message", "patient-1", { text: "" })).toEqual({
      text: "",
    });
  });

  it("downloads a private file with an Authorization header and opens a blob URL", async () => {
    localStorage.setItem("prodent_access_token", "secret-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["document"])),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:patient-file");
    const clickMock = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    await openPrivatePatientFile("/api/v1/storage/documents/patient-1/report.pdf");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/storage/documents/patient-1/report.pdf",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret-token" },
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("secret-token");
    expect(clickMock).toHaveBeenCalledOnce();
  });
});
