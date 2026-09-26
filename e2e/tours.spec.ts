import { expect, test } from "@playwright/test";
import { addExtension, signUp } from "./helpers";

/**
 * 画面ごとの案内(コーチマーク)は、ほかのテストの操作を隠さないよう .env.test で VITE_TOURS=off にして切っている。
 * ここだけ、client/lib/tours.ts の E2E_FORCE_TOURS_KEY と同じ値をあらかじめ立て、その上書きを使う。issue #222
 *
 * コーチマークは、はじめての案内(F-32)を閉じるまで出さない決まりなので(lib/tours.ts の shouldShowTour)、
 * ほかのテストのように案内を飛ばして素通りせず、「飛ばす」を押して案内を終える。
 *
 * 指す場所が画面の下の帯に近いと下から出るシート、そうでなければ吹き出し(Popover)になり、
 * どちらで出るかは指す場所の位置で決まる(client/components/parts/ScreenTour.tsx)。ここでは
 * 文言と「分かった」を直に見て、どちらの形でも確かめられるようにする。
 */
const FORCE_TOURS_KEY = "logru-e2e-force-tours";

// はじめての案内を素通りしない。案内を実際に終えて onboardedAt を付けないと、コーチマークが出ないため
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), FORCE_TOURS_KEY);
});

test("家計簿を初めて開くと、記録と口座・予算の案内が 1 回だけ出る。issue #222", async ({ page }) => {
  await signUp(page, { next: "/" });
  await page.getByRole("dialog").getByRole("button", { name: "飛ばす" }).click();
  await addExtension(page, "家計簿");
  await page.goto("/kakeibo");

  const text = page.getByText("「+」で支出を記録できます", { exact: false });
  await expect(text).toBeVisible();
  await page.getByRole("button", { name: "分かった" }).click();
  await expect(text).toHaveCount(0);

  // 見終えると、開き直しても出ない
  await page.reload();
  await expect(page.getByRole("heading", { name: "家計簿", level: 1 })).toBeVisible();
  await expect(text).toHaveCount(0);
});

test("共有リストを初めて開くと、項目の足し方とスワイプの案内が 1 回だけ出る。issue #222", async ({ page }) => {
  await signUp(page, { next: "/" });
  await page.getByRole("dialog").getByRole("button", { name: "飛ばす" }).click();
  await addExtension(page, "リスト");
  await page.goto("/lists");
  await page.getByRole("toolbar", { name: "リストの操作" }).getByRole("button", { name: "リストを作る" }).click();
  await page.getByRole("dialog", { name: "リストを作る" }).getByLabel("名前").fill("買い物");
  await page.getByRole("dialog", { name: "リストを作る" }).getByRole("button", { name: "作る" }).click();
  await expect(page).toHaveURL(/\/lists\/.+/);

  const text = page.getByText("左へスワイプすると、直す・消すができます", { exact: false });
  await expect(text).toBeVisible();
  await page.getByRole("button", { name: "分かった" }).click();
  await expect(text).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "買い物" })).toBeVisible();
  await expect(text).toHaveCount(0);
});
