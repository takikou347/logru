import { describe, expect, it } from "vitest";
import {
  canDeleteEvent,
  canEditEvent,
  canRespond,
  diffAttendees,
  inviteeIds,
} from "@extensions/events/shared/permissions";

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
