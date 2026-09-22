import { expect, test } from "@playwright/test";

test("利用規約とプライバシーポリシーを、ログインせずに読める", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Logru 利用規約" })).toBeVisible();
  await expect(page.getByText("tkkwkut@gmail.com")).toBeVisible();
  await expect(page.getByRole("link", { name: "Logru に戻る" })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Logru プライバシーポリシー" })).toBeVisible();
});

test("奥のインクだまりは動き続けない。動き続けると、ぼかしを描き直して画面がちらつく", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Logru 利用規約" })).toBeVisible();
  const running = await page.evaluate(
    () => document.getAnimations().filter((a) => a.effect instanceof KeyframeEffect && a.effect.target?.closest('[aria-hidden="true"]')).length,
  );
  expect(running).toBe(0);
});

test("規約の長い面は奥を読み直さない。ガラスの色は、組み立てたあとも Chrome に効く", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Logru 利用規約" })).toBeVisible();
  const article = await page.locator("article").evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(article).toBe("none");
  // 同じ glass を付けた、長くない面なら色を濃くする。-webkit- だけが残ると Chrome では none になる
  const panel = await page.evaluate(() => {
    const el = document.createElement("section");
    el.className = "glass";
    document.body.append(el);
    return getComputedStyle(el).backdropFilter;
  });
  expect(panel).toContain("saturate");
});

test("見つからない画面は、そう伝える", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
});

test("ホーム画面に置ける。manifest と Service Worker がある", async ({ page }) => {
  await page.goto("/login");
  const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifest).toBeTruthy();
  const res = await page.request.get(manifest!);
  const json = await res.json();
  expect(json.name).toBe("Logru");
  expect(json.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
});

test("静的ファイルにもセキュリティのヘッダーが付く", async ({ request }) => {
  const res = await request.get("/login");
  expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
});

test("開いた瞬間から、保存した明るさで描く", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("logru-theme", JSON.stringify({ mode: "dark", accent: "beni" })));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "beni");
});
