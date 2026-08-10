import { statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const asset = (name: string) => resolve(process.cwd(), "src/assets", name);
const landing = readFileSync(
  resolve(process.cwd(), "src/pages/Landing.tsx"),
  "utf8",
);

describe("Sprint 13 responsive image budget", () => {
  it.each([
    "hero-doctor-768.avif",
    "hero-doctor-1536.avif",
    "hero-doctor-768.webp",
    "hero-doctor-1536.webp",
  ])("%s stays below the 200 KB LCP asset budget", (name) => {
    expect(statSync(asset(name)).size).toBeLessThanOrEqual(200 * 1024);
  });

  it("serves AVIF and WebP sources without importing the legacy PNG", () => {
    expect(landing).toContain("<picture");
    expect(landing).toContain('type="image/avif"');
    expect(landing).toContain('type="image/webp"');
    expect(landing).not.toContain('from "@/assets/hero-doctor.png"');
  });

  it("reserves the hero dimensions and prioritizes the LCP image", () => {
    expect(landing).toMatch(/width=\{\d+\}/);
    expect(landing).toMatch(/height=\{\d+\}/);
    expect(landing).toContain('fetchpriority: "high"');
    expect(landing).toContain('loading="eager"');
  });
});
