import { lists } from "@extensions/lists/server/schema";
import { escapeLike, likeContains } from "@server/core/like";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

describe("LIKE のワイルドカードを逃がす。#277", () => {
  it("% と _ と \\ に \\ を前置く", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("_")).toBe("\\_");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("歯医者")).toBe("歯医者");
  });

  it("「%」だけの検索は、% を含むものだけに当たる条件になる", () => {
    const q = new SQLiteSyncDialect().sqlToQuery(likeContains(lists.title, "%"));
    expect(q.sql).toContain("escape '\\'");
    expect(q.params).toEqual(["%\\%%"]);
  });

  it("「100%」は 100% を含むものだけに当たる条件になる", () => {
    const q = new SQLiteSyncDialect().sqlToQuery(likeContains(lists.title, "100%"));
    expect(q.params).toEqual(["%100\\%%"]);
  });
});
