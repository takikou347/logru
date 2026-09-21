import type { CalendarItem, GroupSummary, Me } from "../../../shared/api-types";
import { groupColor, memberColor } from "@/lib/colors";

/** 画面で使うための、色と名前を付けた項目 */
export type ViewItem = CalendarItem & { color: string; groupName: string; creatorName: string | null; creatorColor: string | null };

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
    };
  });
}

/** インクだまりに使う 3 色。自分だけのグループを先頭に、グループの並び順 */
export function poolColorsOf(groups: GroupSummary[], me: Me | undefined): string[] {
  if (!me) return ["wakatake", "yamabuki", "asagi"];
  const colors = groups.slice(0, 3).map((g) => groupColor(g, me.colorPrefs));
  const fill = ["wakatake", "yamabuki", "asagi"].filter((c) => !colors.includes(c));
  return [...colors, ...fill].slice(0, 3);
}
