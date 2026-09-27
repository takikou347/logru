import { describe, expect, it } from "vitest";
import { knownNotificationKinds } from "../../src/extensions/server/registry";
import { isNotificationCleanupWindow, uniqueUserIds } from "../../src/server/core/notifications/send";
import {
  buildPage,
  decodeCursor,
  encodeCursor,
  NOTIFICATIONS_PAGE_SIZE,
} from "../../src/server/modules/notifications/pagination";

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

  it("26 件読めたら 25 件だけ返し、25 件目の (created_at, id) を次のカーソルにする", () => {
    const rows = rowsWithCreatedAt(NOTIFICATIONS_PAGE_SIZE + 1);
    const { items, nextCursor } = buildPage(rows);
    expect(items).toHaveLength(25);
    expect(items.at(-1)?.id).toBe("n24");
    expect(nextCursor).toBe(`${rows[24]?.createdAt.getTime()}_n24`);
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

describe("お知らせのカーソルの形。#32", () => {
  it("行から作ったカーソルを、そのまま読み戻せる", () => {
    const row = { id: "abc-123", createdAt: new Date(1_695_000_000_000) };
    const decoded = decodeCursor(encodeCursor(row));
    expect(decoded).toEqual({ createdAt: row.createdAt, id: "abc-123" });
  });

  it("同じミリ秒の行が 2 件あっても、id で境が分かれる", () => {
    const rows = [
      { id: "b", createdAt: new Date(1_000_000) },
      { id: "a", createdAt: new Date(1_000_000) },
    ];
    // created_at が同じでも並びは (created_at, id) の 2 つなので、境の id まで一致して初めて次が分かる
    expect(encodeCursor(rows[0]!)).toBe("1000000_b");
    expect(encodeCursor(rows[1]!)).toBe("1000000_a");
  });

  it("`?cursor=abc` のような数字で始まらない壊れた値は null にする", () => {
    expect(decodeCursor("abc")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("123_")).toBeNull();
    expect(decodeCursor("NaN_n1")).toBeNull();
  });
});

describe("unread-count が数える kind の一覧。#32", () => {
  it("describeNotification を持つ拡張の kind だけを集める", () => {
    const kinds = knownNotificationKinds();
    expect(kinds).toContain("events.invite_accepted");
    expect(kinds).toContain("memories.like");
    // 外部のカレンダーは notify() を呼ばない拡張なので、ここには出ない
    expect(kinds).not.toContain("external.something");
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

describe("お知らせの掃除の枠。1 日 1 回だけにする。0066、#162", () => {
  it("協定世界時 18 時台の最初の 5 分だけ、枠の中とみなす", () => {
    expect(isNotificationCleanupWindow(new Date("2026-09-24T18:00:00Z"))).toBe(true);
    expect(isNotificationCleanupWindow(new Date("2026-09-24T18:04:59Z"))).toBe(true);
  });

  it("枠の外は掃除しない", () => {
    expect(isNotificationCleanupWindow(new Date("2026-09-24T18:05:00Z"))).toBe(false);
    expect(isNotificationCleanupWindow(new Date("2026-09-24T12:00:00Z"))).toBe(false);
    expect(isNotificationCleanupWindow(new Date("2026-09-24T17:59:00Z"))).toBe(false);
  });
});
