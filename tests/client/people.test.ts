import type { GroupSummary, Me } from "@shared/api-types";
import { describe, expect, it } from "vitest";
import {
  attendeeViews,
  byPeople,
  groupPeopleOf,
  hiddenPeople,
  ownersOf,
  peopleOf,
} from "../../src/client/modules/calendar/model";

const me: Me = {
  user: { id: "me", name: "こた", email: "kota@example.com", image: null, avatarUrl: null },
  settings: {
    themeMode: "system",
    bgTheme: "glass",
    accentColor: "aizumi",
    userColor: "wakatake",
    avatarKind: "initial",
    toursSeen: [],
    extensionOrder: [],
  },
  needsAgreement: [],
  provider: "password",
  colorPrefs: [{ targetType: "user", targetId: "mika", color: "asagi" }],
  hiddenMembers: [],
  onboardedAt: null,
  showLab: false,
};

const group = (id: string, members: [string, string][], isPersonal = false): GroupSummary => ({
  id,
  name: id,
  color: "yamabuki",
  isPersonal,
  role: "member",
  members: members.map(([mid, name]) => ({ id: mid, name, userColor: "sango", role: "member", avatarUrl: null })),
  extensions: [],
});

const groups = [
  group("personal", [["me", "こた"]], true),
  group("ふたり", [
    ["me", "こた"],
    ["mika", "みか"],
  ]),
  group("実家", [
    ["me", "こた"],
    ["mika", "みか"],
    ["haha", "はは"],
  ]),
];

describe("peopleOf", () => {
  it("自分を先頭に、ほかの人を 1 人ずつ名前の順に並べる", () => {
    const people = peopleOf(groups, me);
    expect(people.map((p) => p.id)).toEqual(["me", "haha", "mika"]);
    expect(people[0]).toMatchObject({ isMe: true, color: "wakatake" });
  });

  it("自分の画面だけの色を使う", () => {
    const people = peopleOf(groups, me);
    expect(people.find((p) => p.id === "mika")?.color).toBe("asagi");
    expect(people.find((p) => p.id === "haha")?.color).toBe("sango");
  });

  it("共有のグループが無ければ、自分も並べない", () => {
    expect(peopleOf([groups[0]!], me)).toEqual([]);
  });
});

describe("groupPeopleOf", () => {
  it("共有のグループごとに、自分を先頭にメンバーを並べる。同じ人はどのグループにも出る", () => {
    const sections = groupPeopleOf(groups, me);
    expect(sections.map((s) => s.group.id)).toEqual(["ふたり", "実家"]);
    expect(sections[0]!.people.map((p) => p.id)).toEqual(["me", "mika"]);
    expect(sections[1]!.people.map((p) => p.id)).toEqual(["me", "haha", "mika"]);
  });
});

describe("hiddenPeople", () => {
  it("並べていない人は、出さない人に数えない", () => {
    const people = peopleOf(groups, me);
    expect([...hiddenPeople(["mika", "left"], people)]).toEqual(["mika"]);
  });
});

describe("byPeople", () => {
  const items = [
    { id: "1", createdBy: "me" },
    { id: "2", createdBy: "mika" },
    { id: "3", createdBy: null },
  ];

  it("出さない人が作った項目を除き、作った人が分からない項目は残す", () => {
    expect(byPeople(items, new Set(["mika"])).map((i) => i.id)).toEqual(["1", "3"]);
    expect(byPeople(items, new Set(["me"])).map((i) => i.id)).toEqual(["2", "3"]);
  });

  it("誰も外していなければそのまま", () => {
    expect(byPeople(items, new Set())).toBe(items);
  });

  it("招待されて参加するか返事待ちの予定は、その人の予定として残す。参加しないと返した予定は外す", () => {
    const invited = [
      {
        id: "accepted",
        createdBy: "me",
        attendees: [
          { userId: "me", response: "accepted" as const },
          { userId: "mika", response: "accepted" as const },
        ],
      },
      {
        id: "pending",
        createdBy: "me",
        attendees: [
          { userId: "me", response: "accepted" as const },
          { userId: "mika", response: "pending" as const },
        ],
      },
      {
        id: "declined",
        createdBy: "me",
        attendees: [
          { userId: "me", response: "accepted" as const },
          { userId: "mika", response: "declined" as const },
        ],
      },
      { id: "mine", createdBy: "me", attendees: [{ userId: "me", response: "accepted" as const }] },
    ];
    // みかだけを出す
    expect(byPeople(invited, new Set(["me"])).map((i) => i.id)).toEqual(["accepted", "pending"]);
  });
});

describe("ownersOf", () => {
  it("作った人と、参加しないと返していない参加者", () => {
    expect(
      ownersOf({
        createdBy: "me",
        attendees: [
          { userId: "me", response: "accepted" },
          { userId: "mika", response: "pending" },
          { userId: "haha", response: "declined" },
        ],
      }),
    ).toEqual(["me", "mika"]);
  });
});

describe("attendeeViews", () => {
  it("参加者に名前と自分の画面の色を付け、グループにいない人は除く", () => {
    const views = attendeeViews(
      [
        { userId: "me", response: "accepted" },
        { userId: "mika", response: "pending" },
        { userId: "left", response: "accepted" },
      ],
      groups[1],
      me,
    );
    expect(views).toEqual([
      { id: "me", name: "こた", color: "sango", response: "accepted", isMe: true, avatarUrl: null },
      { id: "mika", name: "みか", color: "asagi", response: "pending", isMe: false, avatarUrl: null },
    ]);
  });
});
