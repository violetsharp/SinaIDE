import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:1420",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...(process.platform === "win32" && !process.env.CI
      ? { channel: "msedge" }
      : {}),
  },
  projects: [
    { name: "studio", use: { viewport: { width: 1440, height: 960 } } },
    {
      name: "small-studio",
      use: { viewport: { width: 1000, height: 700 }, reducedMotion: "reduce" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
  },
});
