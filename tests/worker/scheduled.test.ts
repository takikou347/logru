import { runAllScheduled } from "@server/core/scheduled";
import { describe, expect, it, vi } from "vitest";

describe("runAllScheduled。定期の処理をまとめて呼ぶ。0065、#161", () => {
  it("1 つが失敗しても、ほかの処理は最後まで動く", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: string[] = [];
    await runAllScheduled([
      { name: "external-calendars", run: () => Promise.reject(new Error("timeout")) },
      { name: "weather", run: async () => void calls.push("weather") },
      { name: "memories", run: async () => void calls.push("memories") },
      { name: "notifications-cleanup", run: async () => void calls.push("notifications-cleanup") },
    ]);
    expect(calls).toEqual(["weather", "memories", "notifications-cleanup"]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("external-calendars"), expect.any(Error));
  });

  it("すべて通れば、何も記録しない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await runAllScheduled([{ name: "weather", run: async () => {} }]);
    expect(spy).not.toHaveBeenCalled();
  });
});
