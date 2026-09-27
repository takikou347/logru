import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * 主な画面を、同じデータを入れてから撮る。release のレビューで、前と後を並べるために使う。
 * ふだんの `pnpm e2e` には入れない。撮り方は README の「画面を撮る」にある。
 *
 * - SHOTS_OUT: 画像を置くフォルダ。既定は test-results/shots/after
 * - E2E_PORT: 動かす番号。別のフォルダで同時に撮るときに変える
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://localhost:${PORT}`;
/** src/client/modules/onboarding/model.ts の E2E_SKIP_KEY と同じ値 */
const E2E_SKIP_ONBOARDING = "logru-e2e-skip-onboarding";
process.env.SHOTS_OUT = path.resolve(process.env.SHOTS_OUT ?? "test-results/shots/after");

const phone = {
  ...devices["Pixel 7"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  channel: "chrome",
};
const pc = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel: "chrome" };

export default defineConfig({
  testDir: "./e2e/shots",
  testMatch: /\.shots\.ts$/,
  outputDir: "test-results/shots-run",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    storageState: {
      cookies: [],
      origins: [{ origin: baseURL, localStorage: [{ name: E2E_SKIP_ONBOARDING, value: "1" }] }],
    },
    // 無い画面で長く待たないように、1 つの操作は短く切る
    actionTimeout: 15_000,
    trace: "off",
    screenshot: "off",
  },
  // seed で利用者を作ってデータを入れ、ほかはその利用者でログインして撮る
  projects: [
    { name: "seed", testMatch: /seed\.shots\.ts$/, use: { ...phone, colorScheme: "light" } },
    {
      name: "390-dark",
      testIgnore: /seed\.shots\.ts$/,
      dependencies: ["seed"],
      use: { ...phone, colorScheme: "dark" },
    },
    {
      name: "390-light",
      testIgnore: /seed\.shots\.ts$/,
      dependencies: ["seed"],
      use: { ...phone, colorScheme: "light" },
    },
    {
      name: "1440-light",
      testIgnore: /seed\.shots\.ts$/,
      dependencies: ["seed"],
      use: { ...pc, colorScheme: "light" },
    },
    { name: "1440-dark", testIgnore: /seed\.shots\.ts$/, dependencies: ["seed"], use: { ...pc, colorScheme: "dark" } },
  ],
  webServer: [
    {
      command: "pnpm emulator",
      url: "http://127.0.0.1:9099/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `pnpm build --mode test && pnpm db:migrate:local && pnpm preview --port ${PORT}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
