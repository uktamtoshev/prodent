type Html2Canvas = typeof import("html2canvas")["default"];
type JsPdfConstructor = typeof import("jspdf")["jsPDF"];

interface Html2CanvasModule {
  default: Html2Canvas;
}

interface JsPdfModule {
  jsPDF: JsPdfConstructor;
}

export interface TreatmentPlanPdfDependencies {
  html2canvas: Html2Canvas;
  JsPDF: JsPdfConstructor;
}

type ModuleImporter = () => Promise<unknown>;

const importHtml2Canvas = () => import("html2canvas");
const importJsPdf = () => import("jspdf");

export async function loadTreatmentPlanPdfDependencies(
  html2CanvasImporter: ModuleImporter = importHtml2Canvas,
  jsPdfImporter: ModuleImporter = importJsPdf,
): Promise<TreatmentPlanPdfDependencies> {
  const [html2CanvasModule, jsPdfModule] = await Promise.all([
    html2CanvasImporter(),
    jsPdfImporter(),
  ]);

  return {
    html2canvas: (html2CanvasModule as Html2CanvasModule).default,
    JsPDF: (jsPdfModule as JsPdfModule).jsPDF,
  };
}
