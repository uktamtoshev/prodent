import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  server: {
    host: "::",
    // The app is looked at on :3000 — that is the address the docker frontend
    // container also publishes. `strictPort` makes the clash loud: if the
    // container is still up, the dev server refuses to start rather than
    // silently moving to 3001, where nobody would be looking.
    port: Number(process.env.VITE_DEV_PORT) || 3000,
    strictPort: true,
    /**
     * Опрос файлов вместо системных уведомлений.
     *
     * Проект лежит в папке OneDrive. Синхронизация подменяет файлы так, что
     * системное событие об изменении до Vite не доходит: на диске правка есть,
     * а сервер продолжает отдавать старую сборку. Внешне это выглядит как
     * «изменений нет» — и выглядело так трижды, пока причина не нашлась.
     *
     * Опрос дороже по процессору, но здесь важнее, чтобы правка доезжала до
     * браузера. Отключить можно переменной VITE_DEV_POLL=0, если проект
     * переедет из OneDrive.
     */
    watch:
      process.env.VITE_DEV_POLL === "0"
        ? undefined
        : { usePolling: true, interval: 300 },
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8080',
        ws: true,
      },
      '/blog-covers': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
