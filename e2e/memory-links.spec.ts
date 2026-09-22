import { expect, test } from "@playwright/test";
import { addEvent, signUp } from "./helpers";

/** グループを作り、そのグループで思い出を有効にする */
async function groupWithMemories(page: import("@playwright/test").Page, name: string) {
  await page.goto("/groups");
  await page.getByLabel("グループの名前").fill(name);
  await page.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("switch", { name: "思い出" }).click();
  await expect(page.getByRole("switch", { name: "思い出" })).toBeChecked();
}

test("思い出を作るとき、期間の予定が最初から入り、外した予定は思い出に出ない。0020", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/");
  await addEvent(page, "ロマンスカー", "ふたり");
  await addEvent(page, "歯医者", "ふたり");

  await page.goto("/memories");
  await page.getByRole("button", { name: "思い出を作る" }).click();
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("箱根 日帰り");
  await create.getByRole("radio", { name: "ふたり" }).click();
  await expect(create.getByRole("checkbox", { name: "「ロマンスカー」を入れる" })).toBeChecked();
  await create.getByRole("checkbox", { name: "「歯医者」を入れる" }).click();
  await create.getByRole("button", { name: "作る" }).click();

  const flow = page.getByRole("list", { name: "1 日の流れ" });
  await expect(flow.getByText("ロマンスカー")).toBeVisible();
  await expect(flow.getByText("歯医者")).toHaveCount(0);

  // 編集で入れ直すと、出る
  await page.getByRole("button", { name: "思い出を編集" }).click();
  const edit = page.getByRole("dialog", { name: "思い出を編集" });
  await expect(edit.getByRole("checkbox", { name: "「歯医者」を入れる" })).not.toBeChecked();
  await edit.getByRole("checkbox", { name: "「歯医者」を入れる" }).click();
  await edit.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("list", { name: "1 日の流れ" }).getByText("歯医者")).toBeVisible();
});

test("予定を足すとき、重なる思い出に入れるか選べる。0020", async ({ page }) => {
  await signUp(page);
  await groupWithMemories(page, "ふたり");
  await page.goto("/memories");
  await page.getByRole("button", { name: "思い出を作る" }).click();
  const create = page.getByRole("dialog", { name: "思い出を作る" });
  await create.getByLabel("題名").fill("鎌倉 散歩");
  await create.getByRole("radio", { name: "ふたり" }).click();
  await create.getByRole("button", { name: "作る" }).click();
  await expect(page.getByRole("heading", { name: "鎌倉 散歩" })).toBeVisible();

  // 入れる。最初から入っている
  await page.goto("/");
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  let sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("江ノ電");
  await sheet.getByRole("radio", { name: "ふたり" }).click();
  await expect(sheet.getByRole("switch", { name: "「鎌倉 散歩」に入れる" })).toBeChecked();
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("予定を足しました")).toBeVisible();

  // 入れない
  await page.getByRole("button", { name: "予定を足す" }).last().click();
  sheet = page.getByRole("dialog", { name: "新しい予定" });
  await sheet.getByLabel("題名").fill("仕事の電話");
  await sheet.getByRole("radio", { name: "ふたり" }).click();
  await sheet.getByRole("switch", { name: "「鎌倉 散歩」に入れる" }).click();
  await expect(sheet.getByRole("switch", { name: "「鎌倉 散歩」に入れる" })).not.toBeChecked();
  const excluded = page.waitForResponse(
    (r) => /\/api\/memories\/[^/]+\/events\//.test(r.url()) && r.request().method() === "PUT",
  );
  await sheet.getByRole("button", { name: "保存する" }).click();
  expect((await excluded).status()).toBe(200);
  await expect(page.getByText("予定を足しました")).toBeVisible();

  await page.goto("/memories");
  await page
    .getByRole("link", { name: /鎌倉 散歩/ })
    .first()
    .click();
  const flow = page.getByRole("list", { name: "1 日の流れ" });
  await expect(flow.getByText("江ノ電")).toBeVisible();
  await expect(flow.getByText("仕事の電話")).toHaveCount(0);
});
