import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const frontendRoot = process.cwd();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "node ./node_modules/next/dist/bin/next start --hostname localhost --port 3000",
      url: "http://localhost:3000",
      cwd: frontendRoot,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: process.platform === "win32"
        ? `"${path.resolve(frontendRoot, "..", "backend", ".venv", "Scripts", "python.exe")}" -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
        : "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000",
      url: "http://localhost:8000/health",
      cwd: path.resolve(frontendRoot, "..", "backend"),
      env: { ALLOWED_ORIGINS: '["http://localhost:3000"]' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
