/**
 * 新しい見た目・スマホの上の帯に置く、絞り込みのアイコン 1 つ。押すと、グループ・人・種類の
 * 絞り込みを 1 枚のシートにまとめて出す。今までの横に並ぶ帯(GroupFilterBand、すべて・自分だけ・種類)を
 * このアイコンにまとめる。issue #243
 *
 * シートの中身は、グループの絞り込み(単一で選ぶ)、人の絞り込み(グループごとに複数)、
 * 種類の絞り込み(拡張ごとに複数)の 3 段。人と種類は、今までのシート(PeopleChip、KindChip)と
 * 同じ部品(PeopleFilterFields、KindToggles)を使う。決定 0067
 */
import { Check, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { GroupFilterOption } from "@/components/parts/GroupFilter";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GroupPeople, Person } from "../model";
import { KindToggles } from "./KindFilter";
import { PeopleFilterFields } from "./PeopleFilter";

export function CalendarFilterButton({
  groupOptions,
  peopleSections,
  hiddenPeople,
  onTogglePerson,
  hiddenKinds,
  onToggleKind,
  tourId,
}: {
  groupOptions: GroupFilterOption[];
  peopleSections: GroupPeople[];
  hiddenPeople: Set<string>;
  onTogglePerson: (person: Person, hidden: boolean) => void;
  hiddenKinds: Set<string>;
  onToggleKind: (key: string) => void;
  /** 案内(ScreenTour)が指す data-tour。今までの GroupFilterBand と同じ名前を渡すと、新しい見た目でも同じ案内が出る */
  tourId?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtering =
    groupOptions.some((o) => o.pressed && o.key !== "all") || hiddenPeople.size > 0 || hiddenKinds.size > 0;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="絞り込み"
        aria-haspopup="dialog"
        aria-pressed={filtering}
        data-tour={tourId}
        className={cn(filtering && "text-primary")}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-5" aria-hidden="true" />
      </Button>
      {open && (
        <ResponsiveSheet title="絞り込み" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4">
            <div role="radiogroup" aria-label="表示するグループ" className="flex flex-col">
              {groupOptions.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={o.pressed}
                  onClick={o.onClick}
                  className="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
                >
                  <span className="flex-1">{o.label}</span>
                  {o.pressed && <Check className="size-4 flex-none text-primary" strokeWidth={3} aria-hidden="true" />}
                </button>
              ))}
            </div>
            {peopleSections.length > 0 && (
              <div>
                <h2 className="mb-1 px-0.5 text-xs font-bold text-ink-2">人</h2>
                <PeopleFilterFields sections={peopleSections} hidden={hiddenPeople} onToggle={onTogglePerson} />
              </div>
            )}
            <div>
              <h2 className="mb-1 px-0.5 text-xs font-bold text-ink-2">種類</h2>
              <div className="flex flex-col">
                <KindToggles
                  hidden={hiddenKinds}
                  onToggle={onToggleKind}
                  rowClass="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
                />
              </div>
            </div>
          </div>
        </ResponsiveSheet>
      )}
    </>
  );
}
