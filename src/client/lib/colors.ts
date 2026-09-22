import type { GroupSummary, Me } from "@shared/api-types";

type Prefs = Me["colorPrefs"];

/**
 * 自分の画面でのグループの色。自分で選んでいなければ、グループの色。F-15
 * @param group 色を知りたいグループ
 * @param prefs 自分の画面だけの色の一覧
 */
export function groupColor(group: Pick<GroupSummary, "id" | "color">, prefs: Prefs): string {
  return prefs.find((p) => p.targetType === "group" && p.targetId === group.id)?.color ?? group.color;
}

/**
 * 自分の画面での人の色。自分で選んでいなければ、その人が選んだ自分の色。F-18
 * @param userId 色を知りたい人
 * @param fallback その人が選んだ自分の色
 * @param prefs 自分の画面だけの色の一覧
 */
export function memberColor(userId: string, fallback: string, prefs: Prefs): string {
  return prefs.find((p) => p.targetType === "user" && p.targetId === userId)?.color ?? fallback;
}
