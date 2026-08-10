import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "src/pages/technician/TechnicianOrders.tsx",
  "src/pages/technician/TechnicianArchive.tsx",
  "src/pages/technician/TechnicianOrder.tsx",
  "src/pages/technician/TechnicianProduction.tsx",
  "src/pages/technician/TechnicianMaterials.tsx",
] as const;

const source = (file: (typeof files)[number]) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("technician Sprint 1 UI contract", () => {
  it.each(files)("%s keeps visible text at least 12px", (file) => {
    expect(source(file)).not.toMatch(/text-\[(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)px\]/);
  });

  it.each(files)("%s uses semantic theme colors", (file) => {
    expect(source(file)).not.toMatch(fixedPaletteClass);
  });

  it.each(files)("%s exposes accessible loading and error states", (file) => {
    const page = source(file);
    expect(page).toContain('role="status"');
    expect(page).toContain('role="alert"');
  });

  it("keeps native compact controls at least 44px and keyboard-visible", () => {
    const pages = files.map(source).join("\n");

    expect(pages).toContain("min-h-11");
    expect(pages).toContain("h-11 w-11");
    expect(pages).toContain("focus-visible:ring-2");
    expect(source(files[0])).toContain('aria-pressed={priority === key}');
    expect(source(files[1])).toContain("aria-pressed={activeBtn}");
  });

  it("keeps lists usable on mobile", () => {
    const production = source(files[3]);

    expect(source(files[0])).toContain("md:grid-cols-[80px_1fr_1fr_140px_140px_44px]");
    expect(source(files[1])).toContain("md:grid-cols-[80px_1fr_1fr_120px_140px_44px]");
    expect(source(files[2])).toContain("flex-col gap-2 border-t");
    expect(production).toContain('role="region"');
    expect(production).toContain('aria-label="Этапы производства"');
    expect(production).toContain("tabIndex={0}");
    expect(production).toContain("overflow-x-auto");
    expect(production).toContain("focus-visible:ring-2");
    expect(source(files[4])).toContain('role="region"');
    expect(source(files[4])).toContain("tabIndex={0}");
  });

  it("does not nest the production action button inside the order link", () => {
    const production = source(files[3]);

    expect(production).toContain("<article");
    expect(production).toContain('to={`/technician/order?id=${o.id}`}');
    expect(production).not.toMatch(/<Link[\s\S]*?<button[\s\S]*?<\/Link>/);
  });

  it("keeps the existing order API and workflow calls unchanged", () => {
    const pages = files.map(source).join("\n");

    expect(pages).toContain("lab.listOrders()");
    expect(pages).toContain("lab.createOrder(");
    expect(pages).toContain("lab.advanceOrder(");
    expect(pages).toContain("lab.adjustMaterial(");
  });
});
