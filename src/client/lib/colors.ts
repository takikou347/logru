import type { GroupSummary, Me } from "../../shared/api-types";

type Prefs = Me["colorPrefs"];

/** 自分の画面でのグループの色。自分で選んでいなければ、グループの色 */
export function groupColor(group: Pick<GroupSummary, "id" | "color">, prefs: Prefs): string {
  return prefs.find((p) => p.targetType === "group" && p.targetId === group.id)?.color ?? group.color;
}

/** 自分の画面での人の色。自分で選んでいなければ、その人が選んだ自分の色 */
export function memberColor(userId: string, fallback: string, prefs: Prefs): string {
  return prefs.find((p) => p.targetType === "user" && p.targetId === userId)?.color ?? fallback;
}
