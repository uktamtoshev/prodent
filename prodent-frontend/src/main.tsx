import { createRoot } from "react-dom/client";
import { bootstrapApplication } from "./bootstrap.ts";
import { initializeLanguage } from "./contexts/LanguageContext.tsx";
import { initAnalytics } from "./lib/analytics.ts";
import "./index.css";

const root = document.getElementById("root")!;

void bootstrapApplication({
  root,
  prepareApplication: async () => {
    initAnalytics();
    // The selected/default dictionary must be ready before the first render.
    await initializeLanguage();
  },
  loadApplication: () => import("./App.tsx"),
  mountApplication: (rootElement, { default: App }) => {
    createRoot(rootElement).render(<App />);
  },
  reload: () => window.location.reload(),
});
