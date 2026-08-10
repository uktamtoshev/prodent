import { afterEach, describe, expect, it, vi } from "vitest";
import { supabase } from "./client";

describe("Supabase compatibility not-in filter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("serializes both legacy patient role casings without double parentheses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await supabase
      .from("clinic_members")
      .select("user_id,role")
      .eq("is_active", true)
      .not("role", "in", ["patient", "PATIENT"]);

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    const decodedUrl = decodeURIComponent(requestedUrl);
    expect(decodedUrl).toContain("role=not.in.(patient,PATIENT)");
    expect(decodedUrl).toContain("is_active=eq.true");
    expect(decodedUrl).not.toContain("not.in.((patient,PATIENT))");
  });
});
