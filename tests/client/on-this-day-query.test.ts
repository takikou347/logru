import { onThisDayQuery } from "@extensions/memories/shared/schemas";
import { describe, expect, it } from "vitest";

describe("onThisDayQuery", () => {
  it("実在の日付を通す", () => {
    expect(onThisDayQuery.safeParse({ day: "2026-10-26" }).success).toBe(true);
    expect(onThisDayQuery.safeParse({ day: "2028-02-29" }).success).toBe(true);
  });

  it("実在しない日付は止める", () => {
    expect(onThisDayQuery.safeParse({ day: "9999-99-99" }).success).toBe(false);
    expect(onThisDayQuery.safeParse({ day: "2027-02-29" }).success).toBe(false);
  });
});
