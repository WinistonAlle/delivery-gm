import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 4174,
    strictPort: true,
    allowedHosts: ["funcionarios.gostinhomineiro.com"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4175",
        changeOrigin: true,
      },
      "/healthz": {
        target: "http://127.0.0.1:4175",
        changeOrigin: true,
      },
    },
  },

  plugins: [
    react(),

    mode === "production" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/jspdf") || id.includes("jspdf-autotable")) {
            return "pdf-vendor";
          }

          if (id.includes("node_modules/recharts")) {
            return "charts-vendor";
          }

          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router-dom")
          ) {
            return "react-vendor";
          }

          if (
            id.includes("node_modules/@supabase") ||
            id.includes("node_modules/@tanstack/react-query")
          ) {
            return "data-vendor";
          }

          if (
            id.includes("node_modules/framer-motion") ||
            id.includes("node_modules/embla-carousel") ||
            id.includes("node_modules/lucide-react")
          ) {
            return "ui-vendor";
          }

          return undefined;
        },
      },
    },
  },
}));
