/** リストの画面で使い回す部品 */

import type { GroupSummary, Me } from "@shared/api-types";
import { Dot } from "@/components/parts/Panel";
import { groupColor } from "@/lib/colors";

/** `2026-09-22` を `9.22` の形にする */
export function formatShortDate(date: string): string {
  return date.slice(5).replace("-", ".");
}

/**
 * グループの名前と色の点。自分だけのグループは「自分だけ」。思い出のカードと同じ形。#164
 * リストの一覧のカードと、リストの画面の見出しの下に、共有先として出す
 */
export function GroupLabel({ group, me }: { group: GroupSummary | undefined; me: Me }) {
  if (!group) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
      <Dot color={groupColor(group, me.colorPrefs)} />
      <span className="truncate">{group.isPersonal ? "自分だけ" : group.name}</span>
    </span>
  );
}
