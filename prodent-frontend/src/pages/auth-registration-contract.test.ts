import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("src/pages/Auth.tsx", "utf8");

describe("registration verify-code contract", () => {
  it("sends a registration action and the legal document versions", () => {
    expect(auth).toContain('action: "register"');
    expect(auth).toContain("legal_consent_accepted: consentAccepted");
    expect(auth).toContain("terms_version: LEGAL_DOCUMENT_VERSION");
    expect(auth).toContain("privacy_version: LEGAL_DOCUMENT_VERSION");
    expect(auth).toContain("locale: document.documentElement.lang || \"ru\"");
  });

  it("exposes an accessible consent control before registration", () => {
    expect(auth).toContain('data-testid="auth-register-legal-consent"');
    expect(auth).toContain('id="register-consent-error"');
    expect(auth).toContain("auth.acceptTermsRequired");
  });
});
