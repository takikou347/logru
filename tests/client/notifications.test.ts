import { describeEventNotification } from "@extensions/events/shared/notifications";
import { describeKakeiboNotification } from "@extensions/kakeibo/shared/notifications";
import { describeMemoriesNotification } from "@extensions/memories/shared/notifications";
import { describe, expect, it } from "vitest";
import { describeCoreNotification } from "@/modules/notifications/describe";

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

  it("events.event_added は、その予定を開く行き先にする。issue #245", () => {
    const r = describeEventNotification("events.event_added", { eventId: "e2", title: "花見" });
    expect(r).toEqual({ text: "「花見」が予定に足されました。", path: "/?openExt=events&openId=e2" });
  });

  it("events.event_deleted は、予定がもう無いので、その日の一覧を開く行き先にする。issue #245", () => {
    const startsAt = Date.parse("2026-09-20T10:00:00+09:00");
    const r = describeEventNotification("events.event_deleted", { eventId: "e2", title: "花見", startsAt });
    expect(r).toEqual({ text: "「花見」の予定が消されました。", path: "/?date=2026-09-20&view=day" });
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

  it("いいねが 2 件以上まとまったら、件数を文言に出す。0096", () => {
    const occurredAt = Date.parse("2026-09-20T10:00:00Z");
    const r = describeMemoriesNotification("memories.like", { occurredAt, count: 3 });
    expect(r?.text).toBe("記録にいいねが 3 件付きました。");
  });

  it("memories.shiori_assigned は、そのしおりを開く行き先にする。issue #247", () => {
    const r = describeMemoriesNotification("memories.shiori_assigned", { memoryId: "m1", title: "箱根" });
    expect(r).toEqual({ text: "「箱根」の担当になりました。", path: "/memories/m1/shiori" });
  });
});

describe("家計簿の拡張の describeNotification。issue #246", () => {
  it("kakeibo.expense_shared は、金額と負担額を文言に入れる", () => {
    const r = describeKakeiboNotification("kakeibo.expense_shared", {
      expenseId: "x1",
      groupId: "g1",
      month: "2026-09",
      name: "IKEA",
      amount: 12980,
      share: 6490,
      byUserName: "みか",
    });
    expect(r?.text).toBe("みかが IKEA ¥12,980 を立て替えました。あなたの負担 ¥6,490");
    expect(r?.path).toBe("/kakeibo?month=2026-09&group=g1&edit=x1");
  });

  it("kakeibo.budget_exceeded は、予算の画面を開く行き先にする", () => {
    const r = describeKakeiboNotification("kakeibo.budget_exceeded", { groupId: "g1", name: "食費" });
    expect(r).toEqual({ text: "予算「食費」を超えました。", path: "/kakeibo/budgets?group=g1" });
  });
});

describe("土台の describeCoreNotification。groups.* の文言と行き先。0096、issue #245", () => {
  it("グループに入った", () => {
    const r = describeCoreNotification("groups.member_joined", { groupName: "ふたり", byUserName: "みか" });
    expect(r).toEqual({ text: "みかが「ふたり」に入りました。", path: "/groups" });
  });

  it("グループを抜けた", () => {
    const r = describeCoreNotification("groups.member_left", { groupName: "ふたり", byUserName: "みか" });
    expect(r).toEqual({ text: "みかが「ふたり」を抜けました。", path: "/groups" });
  });

  it("自分の kind でなければ null", () => {
    expect(describeCoreNotification("events.invite_accepted", {})).toBeNull();
  });
});
