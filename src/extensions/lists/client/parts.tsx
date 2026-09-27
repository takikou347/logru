/** リストの画面で使い回す部品 */

import type { GroupSummary, Me } from "@shared/api-types";
import { Dot } from "@/components/parts/Panel";
import { groupColor } from "@/lib/colors";
import { useNewLookActive } from "@/lib/lab";
import { useMediaQuery } from "@/lib/use-media-query";

export { formatShortDate } from "@/lib/dates";

/**
 * ラボの「新しい見た目」・スマホでだけ true。直す・消す・並べ替え・足す・共有・済みにするの操作を
 * 文字からアイコンだけに変える画面で使う。入れていない人・PC では今までどおり文字も出す。issue #243
 */
export function useIconOnly(): boolean {
  const newLook = useNewLookActive();
  const desktop = useMediaQuery("(min-width: 1024px)");
  return newLook && !desktop;
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
