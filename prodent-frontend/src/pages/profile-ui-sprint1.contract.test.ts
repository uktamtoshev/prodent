import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateSellerProfile } from "./seller/SellerProfile";
import { validateNewLabService } from "./technician/TechnicianProfile";

const files = [
  "src/pages/seller/SellerProfile.tsx",
  "src/pages/technician/TechnicianProfile.tsx",
] as const;

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

const fixedPaletteClass =
  /\b(?:bg|text|border|ring)-(?:white|black)(?:\/\d+)?\b|\b(?:bg|text|border|ring)-(?:slate|gray|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}(?:\/\d+)?\b/;

describe("seller and technician profile UI contract", () => {
  it.each(files)("%s uses the shared semantic profile foundation", (file) => {
    const page = source(file);
    expect(page, file).toContain('from "@/components/ui/card"');
    expect(page, file).not.toContain('from "@/components/design"');
    expect(page, file).not.toMatch(fixedPaletteClass);
    expect(page, file).not.toMatch(
      /text-\[(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)px\]/,
    );
  });

  it("associates seller labels and its required error with the field", () => {
    const seller = source(files[0]);
    expect(seller).toContain("htmlFor={`seller-${String(f.key)}`}");
    expect(seller).toContain("id={`seller-${String(f.key)}`}");
    expect(seller).toContain("aria-invalid={fieldErrors[f.key] ? true : undefined}");
    expect(seller).toContain("aria-describedby={fieldErrors[f.key]");
    expect(seller).toContain('role="alert"');
  });

  it("associates technician profile, service and draft labels", () => {
    const technician = source(files[1]);
    for (const id of [
      "technician-display-name",
      "technician-phone",
      "technician-city",
      "technician-address",
      "technician-description",
      "technician-new-service-work-type",
      "technician-new-service-price",
      "technician-new-service-unit",
    ]) {
      expect(technician).toContain(`htmlFor="${id}"`);
      expect(technician).toContain(`id="${id}"`);
    }
    expect(technician).toContain("aria-invalid={newServiceErrors.work_type ? true : undefined}");
    expect(technician).toContain('id="technician-new-service-work-type-error"');
  });

  it("keeps actions touchable and mobile grids within 360px", () => {
    const combined = files.map(source).join("\n");
    expect(combined).toContain("min-h-11");
    expect(combined).toContain("min-w-11");
    expect(combined).toContain("grid-cols-1");
    expect(combined).toContain("minmax(0,1fr)");
    expect(combined).toContain("min-w-0");
    expect(combined).not.toContain("grid-cols-[1fr,");
  });

  it("inherits visible focus and 44px fields from maintained controls", () => {
    const controls = [
      "src/components/ui/input.tsx",
      "src/components/ui/textarea.tsx",
      "src/components/ui/button.tsx",
      "src/components/ui/switch.tsx",
    ].map(source).join("\n");
    expect(controls).toContain("focus-visible:ring-2");
    expect(controls).toContain("h-12 w-full");
    expect(controls).toContain("h-prodent-btn");
  });

  it("preserves owner-scoped save and upload-independent API calls", () => {
    const seller = source(files[0]);
    const technician = source(files[1]);
    expect(seller).toContain("marketplace.getMySupplier()");
    expect(seller).toContain("marketplace.upsertSupplier(payload)");
    expect(technician).toContain("lab.getProfile()");
    expect(technician).toContain("lab.listServices()");
    expect(technician).toContain("lab.updateProfile({");
    expect(technician).toContain("lab.createService({");
    expect(technician).toContain("lab.updateService(id, body)");
    expect(technician).toContain("lab.deleteService(id)");
  });

  it("returns accessible field errors without changing valid values", () => {
    expect(validateSellerProfile({ name: "  " })).toEqual({
      name: "Укажите название компании",
    });
    expect(validateSellerProfile({ name: "ДентСнаб" })).toEqual({});
    expect(validateNewLabService({ work_type: " " })).toEqual({
      work_type: "Укажите название работы",
    });
    expect(validateNewLabService({ work_type: "Коронка" })).toEqual({});
  });
});
