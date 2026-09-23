import type { Attendee, AttendeeResponse, CalendarItem, GroupSummary, Me } from "@shared/api-types";
import { groupColor, memberColor } from "@/lib/colors";
import { itemKey } from "./use-undoable-delete";

/** 項目の参加者を、名前と色を付けて画面で使う形にしたもの。#28 */
export type ViewAttendee = {
  id: string;
  name: string;
  color: string;
  response: AttendeeResponse;
  isMe: boolean;
  avatarUrl: string | null;
};

/**
 * 何の記録かを見分ける種類。event は CalendarItem.kind を持たない項目(予定)。0056
 * 絞り込みの帯の「種類」と、選んだ日の一覧の見出しに使う。
 */
export type ItemKind = "event" | "record" | "expense";

/** 種類の名前。見出しと、読み上げで題名の前に添える言葉に使う。0056 */
export const KIND_LABEL: Record<ItemKind, string> = { event: "予定", record: "思い出", expense: "家計簿" };

/** 種類を出す順。絞り込みの帯と、選んだ日の一覧の見出しの順。0056 */
export const KIND_ORDER: ItemKind[] = ["event", "record", "expense"];

/** 項目の種類。CalendarItem.kind が無ければ予定として扱う。0056 */
export function kindOf(item: Pick<CalendarItem, "kind">): ItemKind {
  return item.kind ?? "event";
}

/**
 * 絞り込みで外した種類の項目を除く。絞り込みの帯の「種類」で使う。0056
 * @param hiddenKinds 出さない種類
 */
export function byKind<T extends Pick<CalendarItem, "kind">>(items: T[], hiddenKinds: ReadonlySet<ItemKind>): T[] {
  if (hiddenKinds.size === 0) return items;
  return items.filter((i) => !hiddenKinds.has(kindOf(i)));
}

/** 画面で使うための、色と名前を付けた項目 */
export type ViewItem = CalendarItem & {
  color: string;
  groupName: string;
  creatorName: string | null;
  creatorColor: string | null;
  /** 参加者。作った人が先頭。招待が無い予定は作った人だけか、空。#28 */
  people: ViewAttendee[];
};

/**
 * 参加者に名前と色を付ける。グループにいない人は、名前が分からないので除く。#28
 * @param attendees 項目の参加者
 * @param group 項目のグループ
 * @param me 自分の情報
 */
export function attendeeViews(
  attendees: Attendee[] | undefined,
  group: GroupSummary | undefined,
  me: Me,
): ViewAttendee[] {
  if (!attendees || !group) return [];
  return attendees.flatMap((a) => {
    const m = group.members.find((x) => x.id === a.userId);
    if (!m) return [];
    return [
      {
        id: m.id,
        name: m.name,
        color: memberColor(m.id, m.userColor, me.colorPrefs),
        response: a.response,
        isMe: m.id === me.user.id,
        avatarUrl: m.avatarUrl,
      },
    ];
  });
}

/** 項目に色とグループ名を付ける。自分だけのグループの項目は「自分だけ」と書く。0009 */
export function decorate(items: CalendarItem[], groups: GroupSummary[], me: Me): ViewItem[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return items.map((item) => {
    const group = byId.get(item.groupId);
    const creator = group?.members.find((m) => m.id === item.createdBy) ?? null;
    return {
      ...item,
      color: item.color ?? (group ? groupColor(group, me.colorPrefs) : "nezumi"),
      groupName: item.sourceName ?? (group ? (group.isPersonal ? "自分だけ" : group.name) : ""),
      creatorName: creator?.name ?? null,
      creatorColor: creator ? memberColor(creator.id, creator.userColor, me.colorPrefs) : null,
      people: attendeeViews(item.attendees, group, me),
    };
  });
}

/**
 * 項目を「その人の予定」とする人。作った人と、招待されて「参加しない」を返していない人。F-20、#28
 * @param item カレンダーの項目
 */
export function ownersOf(item: Pick<CalendarItem, "createdBy" | "attendees">): string[] {
  const ids = new Set<string>();
  if (item.createdBy) ids.add(item.createdBy);
  for (const a of item.attendees ?? []) if (a.response !== "declined") ids.add(a.userId);
  return [...ids];
}

/** 「表示する人」に並べる 1 人 */
export type Person = { id: string; name: string; color: string; isMe: boolean; avatarUrl: string | null };

/** 共有のグループと、そのメンバー。「表示する人」でグループごとに並べる */
export type GroupPeople = { group: GroupSummary; people: Person[] };

/** 自分を「表示する人」の 1 人にする */
function selfOf(me: Me): Person {
  return {
    id: me.user.id,
    name: me.user.name,
    color: memberColor(me.user.id, me.settings.userColor, me.colorPrefs),
    isMe: true,
    avatarUrl: me.user.avatarUrl,
  };
}

/**
 * 共有のグループごとに、メンバーを並べる。自分を先頭に、ほかの人を名前の順。F-20
 * 同じ人が複数のグループにいれば、それぞれに出す。自分だけのグループは含めない。
 * @param groups 入っているグループ
 * @param me 自分の情報
 */
export function groupPeopleOf(groups: GroupSummary[], me: Me): GroupPeople[] {
  const self = selfOf(me);
  return groups
    .filter((g) => !g.isPersonal)
    .map((group) => ({
      group,
      people: [
        self,
        ...group.members
          .filter((m) => m.id !== me.user.id)
          .map((m) => ({
            id: m.id,
            name: m.name,
            color: memberColor(m.id, m.userColor, me.colorPrefs),
            isMe: false,
            avatarUrl: m.avatarUrl,
          }))
          .sort((x, y) => x.name.localeCompare(y.name, "ja")),
      ],
    }));
}

/**
 * 「表示する人」に並べる人を、重ねずに 1 人ずつ。自分を先頭に、ほかの人を名前の順。F-20
 * 共有のグループが無ければ空。選べる相手がいないので、自分も並べない。
 * @param groups 入っているグループ
 * @param me 自分の情報
 */
export function peopleOf(groups: GroupSummary[], me: Me): Person[] {
  const sections = groupPeopleOf(groups, me);
  if (sections.length === 0) return [];
  const others = new Map<string, Person>();
  for (const s of sections) for (const p of s.people) if (!p.isMe && !others.has(p.id)) others.set(p.id, p);
  return [selfOf(me), ...[...others.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"))];
}

/**
 * 出さないと決めた人の ID のうち、いま並べている人だけを返す。
 * グループを抜けた人は選び直せないので、その人の予定は出したままにする。
 * @param hiddenMembers 出さないと決めた人の ID
 * @param people 「表示する人」に並べている人
 */
export function hiddenPeople(hiddenMembers: string[], people: Person[]): Set<string> {
  const ids = new Set(people.map((p) => p.id));
  return new Set(hiddenMembers.filter((id) => ids.has(id)));
}

/**
 * 出している人の予定だけを残す。F-20、#28
 * 項目は、それを「その人の予定」とする人（ownersOf）のうち、1 人でも出していれば残す。
 * 作った人も参加者も分からない項目は出す。
 * @param items カレンダーの項目
 * @param hidden 出さない人の ID
 */
export function byPeople<T extends Pick<CalendarItem, "createdBy" | "attendees">>(
  items: T[],
  hidden: Set<string>,
): T[] {
  if (hidden.size === 0) return items;
  return items.filter((i) => {
    const owners = ownersOf(i);
    return owners.length === 0 || owners.some((id) => !hidden.has(id));
  });
}

/**
 * カレンダーの生データを、画面で使う項目に仕立てる。色を付け、消した人と隠した人を除き、グループと種類で絞る。
 * CalendarPage の月・週・日の本体と、月送りの日めくり(MonthFlipDeck)が隣の月を仕立てるのに使う。#99
 * @param raw GET /calendar の応答。読み込み中は undefined
 * @param deletedKeys 消す操作の 5 秒の間、画面から隠す項目。itemKey の形
 * @param hiddenKinds 絞り込みの帯で外した種類。0056
 */
export function viewItemsOf(
  raw: CalendarItem[] | undefined,
  groups: GroupSummary[],
  me: Me | undefined,
  hiddenIds: Set<string>,
  deletedKeys: Set<string>,
  groupFilter: string | null,
  hiddenKinds: ReadonlySet<ItemKind> = new Set(),
): ViewItem[] {
  if (!raw || !me) return [];
  return byKind(byPeople(decorate(raw, groups, me), hiddenIds), hiddenKinds).filter(
    (i) => !deletedKeys.has(itemKey(i)) && (!groupFilter || i.groupId === groupFilter),
  );
}

/** インクだまりに使う 3 色。自分だけのグループを先頭に、グループの並び順 */
export function poolColorsOf(groups: GroupSummary[], me: Me | undefined): string[] {
  if (!me) return ["wakatake", "yamabuki", "asagi"];
  const colors = groups.slice(0, 3).map((g) => groupColor(g, me.colorPrefs));
  const fill = ["wakatake", "yamabuki", "asagi"].filter((c) => !colors.includes(c));
  return [...colors, ...fill].slice(0, 3);
}
