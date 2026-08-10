import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ apiFetch }));

import { createPatientFile, listPatientFiles, updatePatientFile } from "./patient-files-api";

describe("patient files API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [],
    });
  });

  it("uses the dedicated list endpoint", async () => {
    await listPatientFiles("patient-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/patient-files?patientId=patient-1", undefined);
  });

  it("writes metadata through the dedicated endpoint", async () => {
    await createPatientFile({ patient_id: "patient-1", file_url: "/api/v1/storage/documents/patient-1/x.pdf", file_type: "document" });
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/patient-files", expect.objectContaining({ method: "POST" }));
    await updatePatientFile("file-1", { comments: "ok" });
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/patient-files/file-1", expect.objectContaining({ method: "PATCH" }));
  });
});
