import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * The cabinet frame has EXACTLY ONE top bar.
 *
 * The previous contract locked in the opposite: it required `sticky top-16` in
 * CRMLayout and `h-[calc(100dvh-7rem)]` in full-height pages, i.e. it encoded a
 * stack of three bars — a 64px decorative strip behind a floating hamburger, a
 * 48px strip holding one notification bell, and the page's own 72px header with
 * a SECOND bell aimed at a different notifications page. On an iPhone SE that
 * cost 184px, 31% of the screen, before a single appointment row.
 *
 * These tests now pin the replacement: one 56px bar whose height is a token, so
 * viewport maths cannot drift from the bar again.
 */
describe("CRM cabinet shell contract", () => {
  it("renders one unified top bar and no stacked utility strip", () => {
    const layout = readSource("src/components/crm/CRMLayout.tsx");

    expect(layout).toContain("CabinetTopBar");
    expect(layout).toContain("CabinetShellProvider");
    // The old second strip was positioned under the decorative one.
    expect(layout).not.toContain("sticky top-16");
  });

  it("keeps the bar height and the viewport maths on one token", () => {
    const css = readSource("src/index.css");
    const config = readSource("tailwind.config.ts");
    const bar = readSource("src/components/shared/CabinetTopBar.tsx");

    expect(css).toContain("--cabinet-topbar-h");
    expect(config).toContain("var(--cabinet-topbar-h)");
    // The bar measures itself with the same token everything else subtracts.
    expect(bar).toContain("h-cabinet-topbar");
  });

  it.each([
    "src/pages/doctor/DoctorMessages.tsx",
    "src/pages/doctor/DoctorVisit.tsx",
    "src/pages/doctor/DoctorPlanEdit.tsx",
    "src/pages/crm/Messages.tsx",
  ])("%s fills exactly what the one bar leaves", (file) => {
    const page = readSource(file);

    expect(page, file).toContain("h-cabinet");
    // No hand-rolled viewport arithmetic: these are the four formulas that
    // previously disagreed with each other and with the actual bar heights.
    expect(page, file).not.toContain("100dvh-7rem");
    expect(page, file).not.toContain("100dvh-3rem");
    expect(page, file).not.toContain("100vh-3rem");
    expect(page, file).not.toContain("100vh-5rem");
  });

  it("keeps exactly one notification bell in the cabinet frame", () => {
    // Two bells on one screen, pointing at two different notification pages,
    // is what the doctor cabinet used to show.
    const bar = readSource("src/components/shared/CabinetTopBar.tsx");
    const topbar = readSource("src/components/doctor/DoctorTopbar.tsx");
    const layout = readSource("src/components/crm/CRMLayout.tsx");

    expect(bar).toContain("NotificationBell");
    expect(topbar).not.toContain("NotificationBell");
    expect(layout).not.toContain("NotificationBell");
  });

  it("routes the bell through the route catalog, not a literal path", () => {
    const bar = readSource("src/components/shared/CabinetTopBar.tsx");
    expect(bar).toContain("CABINET_SECTIONS.notifications.path");
  });

  it("leaves un-migrated cabinets their own mobile trigger", () => {
    // admin/patient/seller/technician still render RoleSidebar without the
    // shell provider; removing their trigger would strand them without a menu.
    const sidebar = readSource("src/components/shared/RoleSidebar.tsx");
    expect(sidebar).toContain("role-sidebar-mobile-toolbar");
    expect(sidebar).toContain("{!shell && (");
  });
});
