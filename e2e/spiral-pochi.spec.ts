import { expect, test } from "@playwright/test";
import { signUp, tokyoDateParts } from "./helpers";

/**
 * 1 年のらせんの、インクのしずくの「ぽつ」。0075、F-42
 * 見た目のラボの裏でだけ出す。0039
 *
 * WebGL のキャンバスの中は DOM で読めないので、SpiralScene が host の div に付ける
 * data-pochi 属性(rolling → stopped)で、出ているか・止まったかを確かめる。
 * ヘッドレスの Chrome は既定では WebGL が使えないことがあるため、ソフトウェアの
 * WebGL(swiftshader)を使う引数を付ける
 */
test.use({
  launchOptions: { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("ラボで「ぽつを転がす」を入れると、らせんにぽつが出て、今日の位置で止まる。F-42", async ({ page }) => {
  await page.goto("/settings/appearance");
  await page.getByRole("region", { name: "ラボ" }).getByRole("switch", { name: "らせん: ぽつを転がす" }).click();

  const { year } = tokyoDateParts();
  await page.goto(`/spiral/${year}`);

  const pochi = page.locator("[data-pochi]");
  await expect(pochi).toHaveCount(1);
  await expect(pochi).toHaveAttribute("data-pochi", "stopped", { timeout: 10_000 });
});

test("ラボを切ったままでは、らせんにぽつが出ない。F-42", async ({ page }) => {
  const { year } = tokyoDateParts();
  await page.goto(`/spiral/${year}`);
  // WebGL の 3D 本体が読み込まれるまで待ってから、ぽつが無いことを確かめる
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("[data-pochi]")).toHaveCount(0);
});
