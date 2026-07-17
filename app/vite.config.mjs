import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = Number(env.VITE_DEV_PORT || 3001);

  return {
    plugins: [react()],
    server: {
      port: devPort,
      strictPort: true,
      open: true,
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
