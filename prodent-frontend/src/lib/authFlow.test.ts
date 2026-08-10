import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatUzPhone,
  buildAuthCallbackUrl,
  exchangeOAuthCode,
  getSafeReturnTo,
  isValidUzPhone,
  normalizeUzPhone,
} from "./authFlow";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Uzbek phone contract", () => {
  it.each([
    ["901234567", "+998901234567"],
    ["998901234567", "+998901234567"],
    ["+998 90 123 45 67", "+998901234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeUzPhone(input)).toBe(expected);
  });

  it("formats the shared +998 input shape", () => {
    expect(formatUzPhone("901234567")).toBe("+998 90 123 45 67");
  });

  it.each(["+998 90 123 45 67", "998901234567"])(
    "accepts a complete Uzbek number: %s",
    (input) => expect(isValidUzPhone(input)).toBe(true),
  );

  it.each([
    "",
    "+998",
    "+998 90 123 45",
    "+997901234567",
    "+9989012345678",
    "+99890abc1234567",
  ])(
    "rejects an invalid Uzbek number: %s",
    (input) => expect(isValidUzPhone(input)).toBe(false),
  );
});

describe("safe auth return target", () => {
  it("keeps a local path with its query", () => {
    expect(getSafeReturnTo("?returnTo=%2Fbook%2Fdoctor-1%3Fpromo%3DSUMMER")).toBe(
      "/book/doctor-1?promo=SUMMER",
    );
  });

  it("accepts the backend OAuth return_to name", () => {
    expect(getSafeReturnTo("?return_to=%2Fbook%2Fdoctor-1%3Fpromo%3DSUMMER")).toBe(
      "/book/doctor-1?promo=SUMMER",
    );
  });

  it.each([
    "?returnTo=https%3A%2F%2Fevil.example",
    "?returnTo=%2F%2Fevil.example",
    "?returnTo=%5C%5Cevil.example",
    "?returnTo=javascript%3Aalert(1)",
  ])("rejects an external redirect: %s", (search) => {
    expect(getSafeReturnTo(search)).toBeNull();
  });

  it("accepts a safe router-state target", () => {
    expect(getSafeReturnTo("", { returnTo: "/search?city=tashkent" })).toBe(
      "/search?city=tashkent",
    );
  });

  it("puts only a safe local return target into the OAuth callback", () => {
    expect(
      buildAuthCallbackUrl("https://app.prodent.uz", "/book/doctor-1?promo=SUMMER"),
    ).toBe(
      "https://app.prodent.uz/auth/callback?returnTo=%2Fbook%2Fdoctor-1%3Fpromo%3DSUMMER",
    );
    expect(buildAuthCallbackUrl("https://app.prodent.uz", "https://evil.example")).toBe(
      "https://app.prodent.uz/auth/callback",
    );
  });
});

describe("OAuth exchange", () => {
  it("exchanges the one-time code over JSON instead of reading tokens from the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 900,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeOAuthCode("one-time-code")).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/oauth/exchange", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ code: "one-time-code" }),
    });
  });

  it("rejects an expired or already-used code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Exchange code expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(exchangeOAuthCode("used-code")).rejects.toThrow(
      "Exchange code expired",
    );
  });

  it("rejects a success response without both tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: "access-only" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(exchangeOAuthCode("broken-code")).rejects.toThrow(
      "invalid session",
    );
  });
});
