import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/notifications/NotificationBell.tsx"),
  "utf8",
);

describe("NotificationBell accessibility contract", () => {
  it("keeps every notification action keyboard accessible", () => {
    expect(source).toContain('type="button"');
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("notifsCenter.markRead");
    expect(source).toContain("notifsCenter.delete");
  });

  it("keeps mobile action targets at least 44px", () => {
    expect(source).toContain('className="h-11 w-11"');
    expect(source).toContain('className={cn("relative h-11 w-11"');
    expect(source).not.toMatch(/className="h-(?:6|7|8|9|10) w-(?:6|7|8|9|10)"/);
  });

  it("keeps the popover inside a narrow mobile viewport", () => {
    expect(source).toContain("w-[min(20rem,calc(100vw-2rem))]");
    expect(source).toContain("h-[min(25rem,calc(100dvh-12rem))]");
  });
});
