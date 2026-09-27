import { expect, type Page, test } from "@playwright/test";
import { addExtension, addMemories, enableNewLook, signUp } from "./helpers";

/**
 * 新しい見た目・スマホの骨組み(下のタブの帯、「+」の放射、画面ごとの Dock)が、中身や
 * ほかの操作と重ならないことを、主な画面で確かめる。紙とリキッドガラスの両方。0091
 *
 * - 押せる物(button、a、input など)どうしの四角が重ならない。一番上の状態では、浮いている物
 *   (fixed、sticky)どうしだけを見る。中身が帯の下を流れるのは、送っている途中なら正しいため
 * - 一番下まで送ったとき、押せる物どうしが重ならず、最後の中身が下のタブの帯より上にある
 * - 横にはみ出さない
 */

type Problem = string;

/** いま見えている画面の重なり、はみ出しを調べ、見つかった物を文にして返す */
async function layoutProblems(page: Page, phase: "top" | "bottom"): Promise<Problem[]> {
  return page.evaluate((phase) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const problems: string[] = [];
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}「${(el.getAttribute("aria-label") || (el as HTMLElement).innerText || "").trim().slice(0, 20)}」`;
    const hidden = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return true;
        if (e.getAttribute("aria-hidden") === "true" || e.hasAttribute("inert")) return true;
      }
      return false;
    };
    const floating = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const p = getComputedStyle(e).position;
        if (p === "fixed" || p === "sticky") return true;
      }
      return false;
    };
    /** 祖先の overflow で切られた後の、画面の中で見える四角 */
    const rectOf = (el: Element) => {
      const r = el.getBoundingClientRect();
      let [l, t, rr, b] = [r.left, r.top, r.right, r.bottom];
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const pr = e.getBoundingClientRect();
        if (cs.overflowX !== "visible") [l, rr] = [Math.max(l, pr.left), Math.min(rr, pr.right)];
        if (cs.overflowY !== "visible") [t, b] = [Math.max(t, pr.top), Math.min(b, pr.bottom)];
        if (cs.position === "fixed") break;
      }
      [l, t, rr, b] = [Math.max(l, 0), Math.max(t, 0), Math.min(rr, vw), Math.min(b, vh)];
      return { l, t, r: rr, b };
    };
    const items = [
      ...document.querySelectorAll(
        'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea, [role="radio"], [role="switch"]',
      ),
    ]
      .filter((el) => !el.closest("[data-sonner-toaster]") && !hidden(el))
      .map((el) => ({ el, r: rectOf(el), floating: floating(el) }))
      .filter(({ r }) => r.r - r.l > 2 && r.b - r.t > 2);

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const label = a.el.closest("label");
        if (label && label === b.el.closest("label")) continue;
        if (phase === "top" && !(a.floating && b.floating)) continue;
        const w = Math.min(a.r.r, b.r.r) - Math.max(a.r.l, b.r.l);
        const h = Math.min(a.r.b, b.r.b) - Math.max(a.r.t, b.r.t);
        if (w > 2 && h > 2) problems.push(`重なり: ${name(a.el)} と ${name(b.el)}`);
      }
    }
    if (document.documentElement.scrollWidth > vw + 1) {
      problems.push(`横にはみ出し: ${document.documentElement.scrollWidth}px`);
    }
    const nav = document.querySelector('nav[aria-label="下のタブ"]');
    if (phase === "bottom" && nav) {
      const barTop = nav.getBoundingClientRect().top;
      let last = 0;
      let lastName = "";
      const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const pe = n.parentElement;
        if (!pe || !n.textContent?.trim() || hidden(pe) || floating(pe)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const r = range.getBoundingClientRect();
        if (r.height > 0 && r.bottom > last) [last, lastName] = [r.bottom, name(pe)];
      }
      for (const { el, r, floating: f } of items) if (!f && r.b > last) [last, lastName] = [r.b, name(el)];
      if (last > barTop + 1) problems.push(`最後の中身 ${lastName} が下のタブの帯に隠れる`);
    }
    return problems;
  }, phase);
}

async function scrollToBottom(page: Page) {
  // 読み込みで高さが後から変わることがあるので、落ち着くまで送り直す
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
  }
}

/** 開いた画面の、一番上と一番下の両方で調べる */
async function expectClean(page: Page, screen: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.getByRole("navigation", { name: "下のタブ" })).toBeVisible();
  const top = await layoutProblems(page, "top");
  await scrollToBottom(page);
  const bottom = await layoutProblems(page, "bottom");
  expect([...top, ...bottom], screen).toEqual([]);
}

/** 「+」の放射の丸が、下のタブの帯、画面の端、ほかの丸と重ならない */
async function expectRadialClean(page: Page) {
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await tabs.getByRole("button", { name: "記録する" }).click();
  await expect(page.getByTestId("radial-scrim")).toBeVisible();
  const labels = ["予定を足す", "支出を記録する", "収入を記録する", "リストに足す", "写真を記録する", "ひとコマ"];
  const bar = (await tabs.boundingBox())!;
  const vw = page.viewportSize()!.width;
  // 丸は「+」から飛び出す動きのあとに止まる。止まった位置で測れるまで測り直す
  await expect(async () => {
    const boxes = [];
    for (const label of labels) {
      const box = (await page.getByRole("button", { name: label }).boundingBox())!;
      expect(box.y + box.height, `${label} が下のタブの帯に重なる`).toBeLessThanOrEqual(bar.y);
      expect(box.x, `${label} が左の端からはみ出す`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${label} が右の端からはみ出す`).toBeLessThanOrEqual(vw);
      boxes.push({ label, box });
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!.box;
        const b = boxes[j]!.box;
        const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(w > 0 && h > 0, `${boxes[i]!.label} と ${boxes[j]!.label} が重なる`).toBe(false);
      }
  }).toPass({ timeout: 5_000 });
  await page.getByTestId("radial-scrim").click({ position: { x: 10, y: 10 } });
}

for (const look of ["glass", "paper"] as const) {
  test(`新しい見た目(${look === "glass" ? "リキッドガラス" : "紙"}): 主な画面で、帯と押せる物が重ならず、横にはみ出さない`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await signUp(page);
    await addExtension(page, "家計簿");
    await addExtension(page, "思い出");
    await addExtension(page, "リスト");
    // 思い出を 1 つ作り、1 日の画面(下のタブの帯に役目を移していない Dock がある)を見られるようにする
    await page.goto("/memories");
    await addMemories(page, "思い出を作る");
    const create = page.getByRole("dialog", { name: "思い出を作る" });
    await create.getByLabel("題名").fill("箱根 日帰り");
    await create.getByRole("button", { name: "作る" }).click();
    await expect(page).toHaveURL(/\/days\/0$/);
    const memoryDay = new URL(page.url()).pathname;

    await enableNewLook(page);
    await page.evaluate((look) => {
      localStorage.setItem("logru-look", look);
      // はじめの 3 回の名前は出さない形で見る(名前の有無は redesign-shell.spec.ts で見る)
      localStorage.setItem("logru:new-look-tab-hints-seen", "3");
    }, look);

    for (const path of [
      "/",
      "/?view=week",
      "/kakeibo",
      "/kakeibo/accounts",
      "/kakeibo/budgets",
      "/kakeibo/recurrings",
      "/kakeibo/templates",
      "/lists",
      "/memories",
      memoryDay,
      "/settings",
      "/settings/appearance",
    ]) {
      await page.goto(path);
      await expectClean(page, path);
    }

    await page.goto("/settings");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expectRadialClean(page);
    // 狭い画面でも、弧の丸が端からはみ出さない
    await page.setViewportSize({ width: 360, height: 740 });
    await page.reload();
    await page.waitForLoadState("networkidle").catch(() => {});
    await expectRadialClean(page);
  });
}
