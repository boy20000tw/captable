import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const VENDOR_CHUNKS: Record<string, string[]> = {
  "vendor-react": ["react", "react-dom", "scheduler", "use-sync-external-store"],
  // Tiny helpers shared by app code AND heavy libs. Without an explicit home,
  // Rollup parks them inside vendor-charts / vendor-pdf, and the entry then has
  // to preload those whole chunks just to get clsx or a babel helper (v2.69.1).
  "vendor-shared": ["clsx", "@babel/runtime", "tslib", "prop-types", "react-is", "tiny-invariant", "eventemitter3"],
  "vendor-data": ["@tanstack/react-query", "@tanstack/query-core", "@trpc/client", "@trpc/react-query", "@trpc/server", "superjson", "wouter"],
  "vendor-charts": ["recharts"],
  "vendor-excel": ["xlsx", "exceljs"],
  "vendor-pdf": ["jspdf", "jspdf-autotable"],
  "vendor-i18n": ["i18next", "react-i18next"],
  "vendor-ui": ["framer-motion", "embla-carousel-react", "sonner", "vaul", "cmdk", "date-fns"],
};

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
        // v2.69: function form — matches every module inside a package
        // (subpaths/CJS shims included), so React always lands in
        // vendor-react and chunks can't form import cycles.
        manualChunks(id: string) {
          // Vite's own dynamic-import preload helper: jspdf's internal dynamic
          // imports made Rollup put it inside vendor-pdf, so every page
          // preloaded the whole PDF library just to get this ~1KB function.
          if (id.includes("vite/preload-helper") || id.includes("modulepreload-polyfill")) return "vendor-shared";
          const i = id.lastIndexOf("node_modules/");
          if (i === -1) return undefined;
          const parts = id.slice(i + "node_modules/".length).split("/");
          const pkg = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
          for (const [chunk, pkgs] of Object.entries(VENDOR_CHUNKS)) {
            if (pkgs.includes(pkg)) return chunk;
          }
          return undefined;
        },
      },
    },
  },
});
