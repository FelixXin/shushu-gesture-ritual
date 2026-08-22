import { defineConfig } from "vite";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": apiTarget,
      "/health": apiTarget
    }
  }
});
