import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    pool: "vmThreads",
    fileParallelism: false,
    maxWorkers: 1,
    clearMocks: true,
    restoreMocks: true,
  },
});
