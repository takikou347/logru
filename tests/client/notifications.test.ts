import { describeEventNotification } from "@extensions/events/shared/notifications";
import { describeMemoriesNotification } from "@extensions/memories/shared/notifications";
import { describe, expect, it } from "vitest";

describe("予定の拡張の describeNotification。#32", () => {
  it("events.invite_accepted は、タイトルと予定を開く行き先にする", () => {
    const r = describeEventNotification("events.invite_accepted", { eventId: "e1", title: "花火大会" });
    expect(r).toEqual({ text: "「花火大会」に参加が決まりました。", path: "/?openExt=events&openId=e1" });
  });

  it("知らないタイトルは「予定」で埋める", () => {
    const r = describeEventNotification("events.invite_accepted", { eventId: "e1" });
    expect(r?.text).toBe("「予定」に参加が決まりました。");
  });

  it("自分の拡張の kind でなければ null", () => {
    expect(describeEventNotification("memories.like", {})).toBeNull();
  });
});

describe("思い出の拡張の describeNotification。F-116、#32", () => {
  it("memories.like は、記録があった日の一覧を開く行き先にする", () => {
    const occurredAt = Date.parse("2026-09-20T10:00:00Z");
    const r = describeMemoriesNotification("memories.like", { occurredAt });
    expect(r).toEqual({ text: "記録にいいねが付きました。", path: "/memories/on/2026-09-20" });
  });

  it("自分の拡張の kind でなければ null", () => {
    expect(describeMemoriesNotification("events.invite_accepted", {})).toBeNull();
  });
});
