import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { loadTreatmentPlanPdfDependencies } from "./treatment-plan-pdf-dependencies";

describe("treatment plan PDF dependencies", () => {
  it("loads both heavy libraries only through the requested importers", async () => {
    const html2canvas = vi.fn();
    const JsPDF = vi.fn();
    const html2CanvasImporter = vi.fn().mockResolvedValue({ default: html2canvas });
    const jsPdfImporter = vi.fn().mockResolvedValue({ jsPDF: JsPDF });

    expect(html2CanvasImporter).not.toHaveBeenCalled();
    expect(jsPdfImporter).not.toHaveBeenCalled();

    const dependencies = await loadTreatmentPlanPdfDependencies(
      html2CanvasImporter,
      jsPdfImporter,
    );

    expect(html2CanvasImporter).toHaveBeenCalledOnce();
    expect(jsPdfImporter).toHaveBeenCalledOnce();
    expect(dependencies).toEqual({ html2canvas, JsPDF });
  });

  it("propagates a loading failure to the existing download error handler", async () => {
    const failure = new Error("PDF module unavailable");

    await expect(
      loadTreatmentPlanPdfDependencies(
        () => Promise.reject(failure),
        () => Promise.resolve({ jsPDF: vi.fn() }),
      ),
    ).rejects.toBe(failure);
  });

  it("keeps html2canvas and jsPDF out of eager imports", () => {
    const helperSource = readFileSync(
      resolve(process.cwd(), "src/lib/treatment-plan-pdf-dependencies.ts"),
      "utf8",
    );
    const dialogSource = readFileSync(
      resolve(process.cwd(), "src/components/crm/treatment/TreatmentPlanPrintDialog.tsx"),
      "utf8",
    );
    const eagerPdfImport = /import\s+(?!type\b)[\s\S]*?from\s+["'](?:html2canvas|jspdf)["']/;

    expect(helperSource).not.toMatch(eagerPdfImport);
    expect(dialogSource).not.toMatch(eagerPdfImport);
    expect(helperSource).toContain('import("html2canvas")');
    expect(helperSource).toContain('import("jspdf")');
  });
});
