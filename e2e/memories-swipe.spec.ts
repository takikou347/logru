import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addExtension, addMemories, signUp, touchDrag } from "./helpers";

const PHOTO = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/photo.jpg");

/** 写真 2 枚の記録を作り、アルバムの最初の写真を大きく出す */
async function openLightbox(page: Page) {
  await signUp(page, { name: "こた" });
  await addExtension(page, "思い出");
  await page.goto("/memories");
  await addMemories(page, "思い出を作る");
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("箱根 日帰り");
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "箱根 日帰り" })).toBeVisible();
  await page.getByRole("toolbar", { name: "1 日の操作" }).getByRole("button", { name: "記録する" }).click();
  const record = page.getByRole("dialog", { name: "記録する" });
  await record.locator('input[type="file"][multiple]').setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: readFileSync(PHOTO) },
    // 同じ写真は 1 枚にまとめられるので、末尾に 1 バイト足して別の写真にする
    { name: "b.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([readFileSync(PHOTO), Buffer.from([0])]) },
  ]);
  await expect(record.getByRole("button", { name: "保存する" })).toBeEnabled({ timeout: 15_000 });
  await record.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("記録しました")).toBeVisible();
  await page.getByRole("radio", { name: "アルバム" }).click();
  await page
    .getByRole("button", { name: /の写真を大きく見る/ })
    .first()
    .click();
  return page.getByRole("dialog", { name: /写真 1 \/ 2/ });
}

/** シートが開ききり、記録の知らせが消えて、写真の位置が落ち着いてから測る。開く途中で測ると指が写真から外れる */
async function settledBox(page: Page, photo: Locator) {
  await expect(page.getByText("記録しました")).toBeHidden({ timeout: 15_000 });
  let box = await photo.boundingBox();
  // 1 回の測りで済ませず、続けて同じ位置になるまで測り直す。#305
  await expect(async () => {
    await page.waitForTimeout(200);
    const now = await photo.boundingBox();
    const prev = box;
    box = now;
    expect(now?.height ?? 0).toBeGreaterThan(100);
    expect(now).toEqual(prev);
  }).toPass({ timeout: 10_000 });
  return box!;
}

test("アルバムの写真を指で左右になぞってめくる。端では移らない。#303", async ({ page }) => {
  const dialog = await openLightbox(page);
  const photo = dialog.getByTestId("lightbox-photo");
  const box = await settledBox(page, photo);
  const y = box.y + box.height / 2;
  const mid = box.x + box.width / 2;

  // 最初の写真で右へ払っても、前へは移らない
  await touchDrag(page, { x: mid, y }, { x: mid + box.width / 2, y });
  await expect(page.getByRole("dialog", { name: "写真 1 / 2" })).toBeVisible();

  // 足りない距離では元に戻る。払いと見なす最小の距離(24px)より短く動かし、速さに左右されないようにする
  await touchDrag(page, { x: mid, y }, { x: mid - 16, y });
  await expect(page.getByRole("dialog", { name: "写真 1 / 2" })).toBeVisible();

  // 幅の 1/4 を超えて左へ離すと、次の写真へ移る
  await touchDrag(page, { x: mid, y }, { x: mid - box.width / 2, y });
  await expect(page.getByRole("dialog", { name: "写真 2 / 2" })).toBeVisible();

  // 最後の写真で左へ払っても移らない。右へ戻すと前の写真
  await touchDrag(page, { x: mid, y }, { x: mid - box.width / 2, y });
  await expect(page.getByRole("dialog", { name: "写真 2 / 2" })).toBeVisible();
  await touchDrag(page, { x: mid, y }, { x: mid + box.width / 2, y });
  await expect(page.getByRole("dialog", { name: "写真 1 / 2" })).toBeVisible();
});

test("なぞっている途中は、写真が指に付いてずれる。#303", async ({ page }) => {
  const dialog = await openLightbox(page);
  const photo = dialog.getByTestId("lightbox-photo");
  const box = await settledBox(page, photo);
  const y = box.y + box.height / 2;
  const mid = box.x + box.width / 2;
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: mid, y }] });
  for (let i = 1; i <= 6; i++) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: mid - i * 12, y }] });
  }
  await expect.poll(async () => (await photo.boundingBox())!.x).toBeLessThan(box.x - 40);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
});

test("マウスで押して写真の外で離しても、次に動かしたとき写真が付いてこない。#305", async ({ page }) => {
  const dialog = await openLightbox(page);
  const photo = dialog.getByTestId("lightbox-photo");
  const box = await settledBox(page, photo);
  const y = box.y + box.height / 2;
  const mid = box.x + box.width / 2;
  // 短くなぞって、写真の外(写真の下)で離す。シートの外だと閉じてしまう
  await page.mouse.move(mid, y);
  await page.mouse.down();
  await page.mouse.move(mid - 30, y, { steps: 4 });
  await page.mouse.move(mid, box.y + box.height + 24, { steps: 4 });
  await page.mouse.up();
  // 押していないのに動かしても、写真は元の位置のまま
  await page.mouse.move(mid, y);
  await page.mouse.move(mid - 60, y, { steps: 4 });
  await page.waitForTimeout(300);
  expect((await photo.boundingBox())!.x).toBeCloseTo(box.x, 0);
});
