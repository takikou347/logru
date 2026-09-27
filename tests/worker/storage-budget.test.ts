import { exceedsStorageBudget, STORAGE_BUDGET_BYTES } from "@server/core/storage-budget";
import { describe, expect, it } from "vitest";

describe("exceedsStorageBudget。写真とアバターの合計に上限を置く。0066、#162", () => {
  it("上限は 8 GB", () => {
    expect(STORAGE_BUDGET_BYTES).toBe(8 * 1024 * 1024 * 1024);
  });

  it("合計が上限に届かなければ、足してよい", () => {
    expect(exceedsStorageBudget(0, 100)).toBe(false);
    expect(exceedsStorageBudget(STORAGE_BUDGET_BYTES - 101, 100)).toBe(false);
  });

  it("これから足す分を入れて上限を超えるなら、断る", () => {
    expect(exceedsStorageBudget(STORAGE_BUDGET_BYTES - 99, 100)).toBe(true);
    expect(exceedsStorageBudget(STORAGE_BUDGET_BYTES, 1)).toBe(true);
  });

  it("ちょうど上限になる分までは足せる", () => {
    expect(exceedsStorageBudget(STORAGE_BUDGET_BYTES - 100, 100)).toBe(false);
  });
});
