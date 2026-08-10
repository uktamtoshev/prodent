import "./styles.css";
import { ToothViewer } from "./viewer/ToothViewer";

const root = document.querySelector<HTMLElement>("#tooth-viewer-root");

if (!root) {
  throw new Error("Tooth viewer root element was not found.");
}

const params = new URLSearchParams(window.location.search);
const requestedPixelRatio = Number(params.get("pixelRatio"));
const pixelRatio = Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0
  ? requestedPixelRatio
  : undefined;

const viewer = new ToothViewer(root, {
  modelUrl: "/models/tooth.glb",
  useDemoPlaceholder: params.get("model") === "mock",
  motionEnabled: params.get("motion") !== "off",
  pixelRatio,
});

void viewer.init();

const handlePageHide = (event: PageTransitionEvent): void => {
  if (!event.persisted) viewer.destroy();
};
const handlePageShow = (event: PageTransitionEvent): void => {
  if (event.persisted) viewer.resume();
};
window.addEventListener("pagehide", handlePageHide);
window.addEventListener("pageshow", handlePageShow);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("pageshow", handlePageShow);
    viewer.destroy();
  });
}
