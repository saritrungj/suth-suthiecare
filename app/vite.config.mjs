import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    // keep the same output folder name as Create React App
    outDir: "build",
    // รวม CSS ทั้งหมดเป็นไฟล์เดียว (โหลดผ่าน <link> ใน index.html ตั้งแต่แรก)
    // กัน error "Unable to preload CSS" ของ lazy-loaded chunk บน static host เช่น IIS
    cssCodeSplit: false,
  },
  // Allow JSX syntax inside plain .js files (CRA-style),
  // so App.js / index.js don't need to be renamed to .jsx
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
});
