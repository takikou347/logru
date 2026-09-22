import { describe, expect, it } from "vitest";
import { uniqueUserIds } from "../../src/server/core/notifications/send";
import { buildPage, NOTIFICATIONS_PAGE_SIZE } from "../../src/server/modules/notifications/pagination";

function rowsWithCreatedAt(count: number) {
  // 新しい順。created_at はミリ秒を 1 ずつずらして、順番が分かるようにする
  return Array.from({ length: count }, (_, i) => ({ id: `n${i}`, createdAt: new Date(1_000_000 - i) }));
}

describe("お知らせの一覧のページ送り。#32", () => {
  it("25 件ちょうどなら、次のカーソルは無い", () => {
    const { items, nextCursor } = buildPage(rowsWithCreatedAt(NOTIFICATIONS_PAGE_SIZE));
    expect(items).toHaveLength(25);
    expect(nextCursor).toBeNull();
  });

  it("26 件読めたら 25 件だけ返し、25 件目の created_at を次のカーソルにする", () => {
    const rows = rowsWithCreatedAt(NOTIFICATIONS_PAGE_SIZE + 1);
    const { items, nextCursor } = buildPage(rows);
    expect(items).toHaveLength(25);
    expect(items.at(-1)?.id).toBe("n24");
    expect(nextCursor).toBe(String(rows[24]?.createdAt.getTime()));
  });

  it("25 件より少なければ、あるだけ返して次のカーソルは無い", () => {
    const { items, nextCursor } = buildPage(rowsWithCreatedAt(3));
    expect(items).toHaveLength(3);
    expect(nextCursor).toBeNull();
  });

  it("1 件も無ければ空で返す", () => {
    const { items, nextCursor } = buildPage([]);
    expect(items).toHaveLength(0);
    expect(nextCursor).toBeNull();
  });
});

describe("notify() が積む相手の重複", () => {
  it("同じ人を 2 度渡しても 1 人にする", () => {
    expect(uniqueUserIds(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("誰も渡さなければ空のまま", () => {
    expect(uniqueUserIds([])).toEqual([]);
  });
});
