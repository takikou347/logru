import { defineConfig, devices } from "@playwright/test";

// 並べて流すときは、E2E_PORT で番号を変える。例は E2E_PORT=4174 pnpm e2e
const PORT = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://localhost:${PORT}`;

/**
 * 本番と同じ形に組み立てたものに向けて流す。ブラウザは入っている Chrome を使う。
 * ログインは Firebase の Auth エミュレーターにつなぐ。メールはエミュレーターの控えから読む。手元の D1 を使う。
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel: "chrome",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      testIgnore: /\.desktop\.spec\.ts$/,
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
    {
      name: "desktop",
      testMatch: /\.desktop\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "pnpm emulator",
      url: "http://127.0.0.1:9099/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm build --mode test && pnpm db:migrate:local && pnpm preview --port ${PORT}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
