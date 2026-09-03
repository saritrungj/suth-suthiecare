import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootWebConfig = path.resolve(appDirectory, "..", "web.config");

const productionWebConfig = () => ({
  name: "suthiecare-production-web-config",
  apply: "build",
  closeBundle() {
    copyFileSync(rootWebConfig, path.join(appDirectory, "build", "web.config"));
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = Number(env.VITE_DEV_PORT || 3001);
  const backendTarget =
    env.VITE_API_PROXY_TARGET ||
    env.API_PROXY_TARGET ||
    "http://127.0.0.1:5000";
  const proxy = {
    "/api": {
      target: backendTarget,
      changeOrigin: true,
    },
    "/health": {
      target: backendTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react(), productionWebConfig()],
    server: {
      port: devPort,
      strictPort: true,
      open: true,
      proxy,
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy":
          "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "X-Frame-Options": "DENY",
      },
    },
    build: {
      // Keep the same output folder name as Create React App.
      outDir: "build",
      cssCodeSplit: false,
    },
    // Allow JSX syntax inside plain .js files, matching the old CRA layout.
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: { ".js": "jsx" },
      },
    },
  };
});
