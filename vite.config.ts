import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-data": [
            "@tanstack/react-query",
            "@trpc/client",
            "@trpc/react-query",
            "superjson",
            "wouter",
          ],
          "vendor-charts": ["recharts"],
          "vendor-excel": ["xlsx", "exceljs"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-auth": ["@clerk/clerk-react"],
          "vendor-i18n": ["i18next", "react-i18next"],
          "vendor-ui": [
            "framer-motion",
            "embla-carousel-react",
            "sonner",
            "vaul",
            "cmdk",
            "date-fns",
          ],
        },
      },
    },
  },
});
