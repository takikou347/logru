import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { apiUser, logIn, tokyoDateParts } from "./helpers";

const PHOTO = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/photo.jpg"));
const TINY = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const SMALL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";

/** 何年前の同じ月日か。うるう日は 4 年前にして、その日がある年に当てる */
function yearsAgoFor() {
  const t = tokyoDateParts();
  const n = t.month === 2 && t.day === 29 ? 4 : 1;
  const mm = String(t.month).padStart(2, "0");
  const dd = String(t.day).padStart(2, "0");
  return { n, key: `${t.year - n}-${mm}-${dd}`, label: `${n}年前の今日` };
}

async function setup(request: APIRequestContext) {
  const user = await apiUser(request);
  await request.post("/api/me/agreements", { headers: user.headers, data: { agreed: true } });
  const { personalGroupId } = await (await request.get("/api/extensions", { headers: user.headers })).json();
  await request.put(`/api/groups/${personalGroupId}/extensions/memories`, {
    headers: user.headers,
    data: { enabled: true },
  });
  return { ...user, groupId: personalGroupId as string };
}

/** 写真付きの記録を、日本時間のその日の昼に残す。何も付けなければ文章だけ */
async function record(
  request: APIRequestContext,
  u: { headers: Record<string, string>; groupId: string },
  key: string,
  body: string,
  withPhoto = true,
) {
  let photoIds: string[] = [];
  if (withPhoto) {
    const res = await request.post("/api/memories/photos", {
      headers: u.headers,
      multipart: {
        groupId: u.groupId,
        width: "640",
        height: "427",
        tiny: TINY,
        small: SMALL,
        full: { name: "full.jpg", mimeType: "image/jpeg", buffer: PHOTO },
      },
    });
    expect(res.status()).toBe(201);
    photoIds = [(await res.json()).id];
  }
  const res = await request.post("/api/memories/records", {
    headers: u.headers,
    data: { groupId: u.groupId, body, photoIds, occurredAt: Date.parse(`${key}T12:00:00+09:00`) },
  });
  expect(res.status()).toBe(201);
}

async function openToday(page: Page, email: string) {
  await logIn(page, email);
  // ログインが済み、今日のページが開くまで待つ
  await expect(page.getByRole("button", { name: "アカウントのメニュー" }).first()).toBeVisible({ timeout: 20_000 });
  await page.goto("/");
  return page.getByTestId("today-section-memories");
}

test("前の年の今日に写真があれば、伏せた札が出て、押すと裏返り、もう一度押すとその日へ移る。F-132", async ({
  page,
  request,
}) => {
  const u = await setup(request);
  const ago = yearsAgoFor();
  await record(request, u, ago.key, "海まで歩いた");
  const section = await openToday(page, u.email);

  const front = section.getByTestId("on-this-day-front");
  await expect(front).toBeVisible();
  await expect(front).toContainText(ago.label);
  await expect(section.getByTestId("flip-card")).toHaveAttribute("data-flipped", "false");
  await front.click();
  await expect(section.getByTestId("flip-card")).toHaveAttribute("data-flipped", "true");
  const back = section.getByTestId("on-this-day-back");
  await expect(back).toContainText("海まで歩いた");
  await expect(back.locator("img")).toBeVisible();
  // 裏返ると回っている
  await expect
    .poll(() => section.getByTestId("flip-card").evaluate((el) => getComputedStyle(el).transform))
    .not.toBe("none");
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/memories/on/${ago.key}`));
});

test("動きを減らす設定では、回らずに入れ替わる。F-132", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const u = await setup(request);
  await record(request, u, yearsAgoFor().key, "朝の散歩");
  const section = await openToday(page, u.email);
  await section.getByTestId("on-this-day-front").click();
  await expect(section.getByTestId("flip-card")).toHaveAttribute("data-flipped", "true");
  await expect(section.getByTestId("on-this-day-back")).toBeVisible();
  expect(await section.getByTestId("flip-card").evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});

test("写真が無い日、今年だけの日は、札を出さない。F-132", async ({ page, request }) => {
  const u = await setup(request);
  await record(request, u, yearsAgoFor().key, "文章だけ", false);
  const section = await openToday(page, u.email);
  await expect(section).toBeVisible({ timeout: 20_000 });
  await expect(section.getByTestId("on-this-day-front")).toHaveCount(0);
});

test("複数の年にあれば、新しい年の 1 枚。ほかの人には届かない。F-132、F-124", async ({ request }) => {
  const u = await setup(request);
  const t = tokyoDateParts();
  const mm = String(t.month).padStart(2, "0");
  const dd = String(t.day).padStart(2, "0");
  // うるう日は 4 年おきにしかないので、2 年前と 4 年前を使う
  const [newer, older] = t.month === 2 && t.day === 29 ? [4, 8] : [1, 3];
  await record(request, u, `${t.year - older}-${mm}-${dd}`, "古い方");
  await record(request, u, `${t.year - newer}-${mm}-${dd}`, "新しい方");
  const mine = await (await request.get(`/api/memories/on-this-day?day=${t.key}`, { headers: u.headers })).json();
  expect(mine.item.yearsAgo).toBe(newer);
  expect(mine.item.record.body).toBe("新しい方");

  const other = await setup(request);
  const theirs = await (await request.get(`/api/memories/on-this-day?day=${t.key}`, { headers: other.headers })).json();
  expect(theirs.item).toBeNull();
});
