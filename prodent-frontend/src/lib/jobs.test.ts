import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobs } from "./jobs";

describe("Jobs moderation API", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sends the moderator reason with a listing decision", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await jobs.moderateListing("listing-1", false, "Нарушает правила");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/jobs/moderate/listings/listing-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ publish: false, reason: "Нарушает правила" }),
      }),
    );
  });

  it("sends the resolution reason when closing a report", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await jobs.resolveReport("report-1", "reviewed", "Нарушение подтверждено");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/jobs/reports/report-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "reviewed",
          reason: "Нарушение подтверждено",
        }),
      }),
    );
  });
});
