import { chunk, D1_CHUNK, readByChunk } from "@server/core/db/chunk";
import { describe, expect, it } from "vitest";

describe("chunk。D1 の 1 文に渡せる値の上限に収まるよう ID を分ける。#199", () => {
  it("既定では 90 個ずつに分ける", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);
    const parts = chunk(ids);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(D1_CHUNK);
    expect(parts[1]).toHaveLength(30);
    expect(parts.flat()).toEqual(ids);
  });

  it("ぴったり割れるときも、余りの空配列を作らない", () => {
    const ids = Array.from({ length: 180 }, (_, i) => `id${i}`);
    expect(chunk(ids)).toHaveLength(2);
  });

  it("90 個以下は 1 つの配列のまま", () => {
    const ids = Array.from({ length: 90 }, (_, i) => `id${i}`);
    expect(chunk(ids)).toHaveLength(1);
  });

  it("空配列は分けない", () => {
    expect(chunk([])).toEqual([]);
  });

  it("size を指定すれば、その数ずつに分ける", () => {
    const ids = Array.from({ length: 45 }, (_, i) => `id${i}`);
    const parts = chunk(ids, 20);
    expect(parts.map((p) => p.length)).toEqual([20, 20, 5]);
  });
});

describe("readByChunk。分けて読んだ結果をまとめて返す。#199", () => {
  it("120 件の ID を、90 個までの 2 回の呼び出しに分けて読む。割った記録が 120 件ある月でも通ることに当たる", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);
    const calls: string[][] = [];
    const rows = await readByChunk(ids, async (part) => {
      calls.push(part);
      // D1 は 1 回に渡せる値が 100 個までなので、1 回の呼び出しがそれを超えないことを確かめる
      expect(part.length).toBeLessThanOrEqual(100);
      return part.map((id) => ({ id }));
    });
    expect(calls).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(ids);
  });

  it("ID が無ければ読まない", async () => {
    let called = false;
    const rows = await readByChunk<string, string>([], async () => {
      called = true;
      return [];
    });
    expect(called).toBe(false);
    expect(rows).toEqual([]);
  });
});
