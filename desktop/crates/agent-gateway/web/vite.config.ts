import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import Icons from "unplugin-icons/vite";

const DEFAULT_PROXY_API = "http://localhost:8080";

function resolveProxyTarget() {
  const cliArg = process.argv.find((arg) => arg.startsWith("--proxy-api="));
  if (cliArg) {
    return cliArg.slice("--proxy-api=".length) || DEFAULT_PROXY_API;
  }
  return process.env.npm_config_proxy_api || DEFAULT_PROXY_API;
}

export default defineConfig(() => ({
  plugins: [react(), Icons({ compiler: "jsx", jsx: "react" })],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tauri-apps/api/core": path.resolve(__dirname, "./src/shims/tauriCore.ts"),
      "@tauri-apps/api/event": path.resolve(__dirname, "./src/shims/tauriEvent.ts"),
      "@tauri-apps/plugin-opener": path.resolve(__dirname, "./src/shims/tauriOpener.ts"),
      "node:fs": path.resolve(__dirname, "./src/shims/nodeFs.ts"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // The remaining largest chunks are indivisible upstream WASM/language modules;
    // app and vendor code is split below to a 500 kB target.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          maxSize: 500_000,
          groups: [
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 20,
            },
            {
              name: "app",
              test: /src[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: resolveProxyTarget(),
        changeOrigin: true,
      },
      "/ws": {
        target: resolveProxyTarget(),
        changeOrigin: true,
        ws: true,
      },
      "/image-proxy": {
        target: resolveProxyTarget(),
        changeOrigin: true,
      },
    },
  },
}));
