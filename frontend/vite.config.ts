import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: [
      "@shelby-protocol/sdk",
      "@shelby-protocol/clay-codes",
      "@shelby-protocol/reed-solomon",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
