import {
  canDeleteEvent,
  canEditEvent,
  canRespond,
  diffAttendees,
  inviteeIds,
  shouldNotifyAccepted,
} from "@extensions/events/shared/permissions";
import { describe, expect, it } from "vitest";

const event = {
  createdBy: "kota",
  attendees: [
    { userId: "kota", response: "accepted" as const },
    { userId: "mika", response: "pending" as const },
    { userId: "haha", response: "declined" as const },
  ],
};

describe("canEditEvent", () => {
  it("作った人と招待された人は直せる。参加しないと返した人も直せる", () => {
    expect(canEditEvent(event, "kota")).toBe(true);
    expect(canEditEvent(event, "mika")).toBe(true);
    expect(canEditEvent(event, "haha")).toBe(true);
  });

  it("招待されていないメンバーは直せない", () => {
    expect(canEditEvent(event, "chichi")).toBe(false);
  });

  it("作った人が分からない予定は、これまでどおり誰でも直せる", () => {
    expect(canEditEvent({ createdBy: null, attendees: [] }, "chichi")).toBe(true);
  });
});

describe("canDeleteEvent", () => {
  it("消せるのは作った人だけ", () => {
    expect(canDeleteEvent(event, "kota")).toBe(true);
    expect(canDeleteEvent(event, "mika")).toBe(false);
    expect(canDeleteEvent(event, "chichi")).toBe(false);
  });
});

describe("canRespond", () => {
  it("返事ができるのは、作った人を除く招待された人", () => {
    expect(canRespond(event, "mika")).toBe(true);
    expect(canRespond(event, "haha")).toBe(true);
    expect(canRespond(event, "kota")).toBe(false);
    expect(canRespond(event, "chichi")).toBe(false);
  });
});

describe("inviteeIds", () => {
  it("作った人と重なりを除く", () => {
    expect(inviteeIds(["mika", "kota", "mika", "haha"], "kota")).toEqual(["mika", "haha"]);
  });
});

describe("diffAttendees", () => {
  it("残る人はそのまま、新しい人を足し、外した人を消す。作った人はいつも残す", () => {
    expect(diffAttendees(event.attendees, ["haha", "chichi"], "kota")).toEqual({
      keep: ["kota", "haha"],
      add: ["chichi"],
      remove: ["mika"],
    });
  });

  it("作った人の行が無ければ足す", () => {
    expect(diffAttendees([], [], "kota")).toEqual({ keep: [], add: ["kota"], remove: [] });
  });
});

describe("shouldNotifyAccepted。#32", () => {
  it("返事待ちから参加するに変われば知らせる", () => {
    expect(shouldNotifyAccepted("accepted", "pending", "kota", "mika")).toBe(true);
  });

  it("参加しないから参加するに変わっても知らせる", () => {
    expect(shouldNotifyAccepted("accepted", "declined", "kota", "mika")).toBe(true);
  });

  it("前の答えが既に参加するなら、答え直しても知らせない", () => {
    expect(shouldNotifyAccepted("accepted", "accepted", "kota", "mika")).toBe(false);
  });

  it("参加、不参加、参加と往復しても、作った人に届くのは 1 件だけ", () => {
    // 1 回目: pending -> accepted で知らせる
    expect(shouldNotifyAccepted("accepted", "pending", "kota", "mika")).toBe(true);
    // 2 回目: accepted -> declined は、そもそも知らせない
    expect(shouldNotifyAccepted("declined", "accepted", "kota", "mika")).toBe(false);
    // 3 回目: declined -> accepted で、また知らせる(1 回目とは別の返事の変化)
    expect(shouldNotifyAccepted("accepted", "declined", "kota", "mika")).toBe(true);
  });

  it("参加しない、返事待ちへの変化は知らせない", () => {
    expect(shouldNotifyAccepted("declined", "pending", "kota", "mika")).toBe(false);
    expect(shouldNotifyAccepted("pending", "accepted", "kota", "mika")).toBe(false);
  });

  it("作った人自身の返事は知らせない", () => {
    expect(shouldNotifyAccepted("accepted", "pending", "kota", "kota")).toBe(false);
  });

  it("作った人が分からない予定は知らせない", () => {
    expect(shouldNotifyAccepted("accepted", "pending", null, "mika")).toBe(false);
  });
});
