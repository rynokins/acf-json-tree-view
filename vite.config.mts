import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "./extension.js",
      formats: ["cjs"],
      fileName: "extension",
    },
    rollupOptions: {
      external: ["vscode"],
    },
    sourcemap: false,
    outDir: "dist",
    minify: true
  },
  plugins: [],
});