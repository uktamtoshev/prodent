import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const nginx = readFileSync(resolve(process.cwd(), "nginx.conf"), "utf8");

describe("Sprint 13 nginx performance and CDN readiness", () => {
  it("caches only hashed build assets as immutable for one year", () => {
    expect(nginx).toMatch(/location\s+\^~\s+\/assets\//);
    expect(nginx).toContain('Cache-Control "public, max-age=31536000, immutable"');
    expect(nginx).toMatch(/location\s+=\s+\/index\.html[\s\S]*no-cache/);
  });

  it("ships a restrictive CSP that remains ready for the approved CDN", () => {
    expect(nginx).toContain("Content-Security-Policy");
    expect(nginx).toContain("default-src 'self'");
    expect(nginx).toContain("object-src 'none'");
    expect(nginx).toContain("https://cdn.prodent.uz");
    expect(nginx).toContain("https://www.googletagmanager.com");
    expect(nginx).toContain("https://fonts.gstatic.com");
    expect(nginx).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  });

  it("enables compression and safe cross-origin static asset reuse", () => {
    expect(nginx).toMatch(/gzip\s+on;/);
    expect(nginx).toContain("gzip_vary on");
    expect(nginx).toContain("Cross-Origin-Resource-Policy");
  });
});
