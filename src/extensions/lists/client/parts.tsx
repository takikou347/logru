/** リストの画面で使い回す部品 */

import type { GroupSummary, Me } from "@shared/api-types";
import { SideHeading, sideItemClass } from "@/components/layout/AppLayout";
import { Chip } from "@/components/parts/Chip";
import { Dot } from "@/components/parts/Panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { groupColor } from "@/lib/colors";

/**
 * グループの絞り込み。すべて、自分だけ、共有のグループ。カレンダーと同じ形。F-202
 * スマホは横に流れるチップ。PC は左の列の SideGroupFilter を使う
 */
export function GroupFilter({
  groups,
  me,
  value,
  onChange,
}: {
  groups: GroupSummary[];
  me: Me;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <nav className="-mx-4 lg:hidden" aria-label="グループで絞る">
      <ScrollArea
        orientation="horizontal"
        className="px-4"
        viewportClassName="pb-1.5"
        scrollbarClassName="left-4! right-4!"
      >
        <div className="flex w-max gap-2">
          <Chip aria-pressed={value === null} onClick={() => onChange(null)}>
            すべて
          </Chip>
          {groups.map((g) => (
            <Chip key={g.id} aria-pressed={value === g.id} onClick={() => onChange(value === g.id ? null : g.id)}>
              <Dot color={groupColor(g, me.colorPrefs)} />
              {g.isPersonal ? "自分だけ" : g.name}
            </Chip>
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}

/** PC の左の列に置く、グループの絞り込み */
export function SideGroupFilter({
  groups,
  me,
  value,
  onChange,
}: {
  groups: GroupSummary[];
  me: Me;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div role="group" aria-label="表示するグループ" className="pr-2">
      <SideHeading>表示するグループ</SideHeading>
      <button type="button" className={sideItemClass} aria-pressed={value === null} onClick={() => onChange(null)}>
        すべて
      </button>
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          className={sideItemClass}
          aria-pressed={value === g.id}
          onClick={() => onChange(value === g.id ? null : g.id)}
        >
          <Dot color={groupColor(g, me.colorPrefs)} />
          {g.isPersonal ? "自分だけ" : g.name}
        </button>
      ))}
    </div>
  );
}

/** `2026-09-22` を `9.22` の形にする */
export function formatShortDate(date: string): string {
  return date.slice(5).replace("-", ".");
}
