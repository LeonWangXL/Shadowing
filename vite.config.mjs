import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadEnvFile } from 'node:process';
import { assessmentMiddleware } from './server/assessment.mjs';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react(), { name: 'echo-assessment', configureServer(server) { server.middlewares.use(assessmentMiddleware()); }, configurePreviewServer(server) { server.middlewares.use(assessmentMiddleware()); } }],
});
