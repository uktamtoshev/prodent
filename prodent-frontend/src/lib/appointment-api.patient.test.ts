import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

import { rescheduleAppointment } from "./appointment-api";

describe("patient appointment commands", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reschedules through the scoped backend PATCH endpoint", async () => {
    localStorage.setItem("prodent_access_token", "patient-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            id: "appointment-1",
            appointmentDate: "2026-07-30",
            startTime: "15:00",
          }),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);

    await rescheduleAppointment({
      appointmentId: "appointment-1",
      appointmentDate: "2026-07-30",
      startTime: "15:00",
      notes: "После работы",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/appointments/appointment-1",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer patient-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          appointmentDate: "2026-07-30",
          startTime: "15:00",
          notes: "После работы",
        }),
      }),
    );
  });
});
