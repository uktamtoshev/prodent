import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("src/pages/Auth.tsx", "utf8");
const bookingAuth = readFileSync("src/components/booking/BookingAuth.tsx", "utf8");
const callback = readFileSync("src/pages/AuthCallback.tsx", "utf8");

describe("Sprint 4 auth integration contract", () => {
  it("uses one phone contract in both auth entry points", () => {
    expect(auth).toContain('from "@/lib/authFlow"');
    expect(bookingAuth).toContain('from "@/lib/authFlow"');
  });

  it("gates main Auth resend with the OTP timer", () => {
    expect(auth).toContain("<OtpTimer");
    expect(auth).not.toContain("onClick={handleResendCode}\n                    disabled={resending}");
  });

  it("does not ignore a set-password error", () => {
    expect(auth).toMatch(/error:\s*setPasswordError/);
    expect(auth).toMatch(/if\s*\([^)]*setPasswordError/);
    expect(auth).toContain('setStep("password")');
    expect(auth).toContain('activeTab === "register" && step !== "complete"');
  });

  it("passes and consumes a safe return target for OAuth", () => {
    expect(auth).toContain("signInWithGoogle(returnTo");
    expect(callback).toContain("getSafeReturnTo");
  });
});
