import { defineConfig } from "vite";
import path from "node:path";

/**
 * Isolated build for the framework-independent anatomy viewer. Keeping its
 * dependency graph separate makes model QA and visual tests deterministic.
 */
export default defineConfig({
  appType: "mpa",
  publicDir: "public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    entries: ["tooth-anatomy/index.html"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    outDir: "dist-tooth",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        toothAnatomy: path.resolve(__dirname, "tooth-anatomy/index.html"),
      },
    },
  },
});
