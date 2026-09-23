import { dayTone, holidayName, onDay, sameDay, WEEKDAYS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ViewItem } from "../model";
import { ItemList, toneText } from "./DayItems";

/**
 * 週と日の表示。日ごとに予定を並べる。今日の行は、欄の左の縁に縦のしおりを立てて示す。大きさは月の表の今日のしおりを縦にしたもの。0012
 * @param onSelect 日付を押したとき。その日の表示に移る
 * @param selected 選んでいる日。月の表と同じ名前を付け、切り替えたときにつながって見えるようにする。#100
 */
export function WeekList({
  days,
  today,
  selected,
  items,
  leaving,
  onSelect,
  onOpen,
}: {
  days: Date[];
  today: Date;
  selected: Date;
  items: ViewItem[];
  leaving?: Set<string>;
  onSelect: (d: Date) => void;
  onOpen: (i: ViewItem) => void;
}) {
  return (
    <section
      className="glass flex flex-col rounded-panel px-4 py-2"
      aria-label={days.length === 1 ? "日の予定" : "週の予定"}
    >
      {days.map((d) => {
        const tone = dayTone(d);
        const hol = holidayName(d);
        const isToday = sameDay(d, today);
        const isSelected = sameDay(d, selected);
        return (
          <div
            key={d.getTime()}
            data-testid="week-row"
            data-today={isToday || undefined}
            style={{ viewTransitionName: isSelected ? "selected-day" : undefined }}
            className="relative grid grid-cols-[64px_1fr] gap-2.5 border-b border-line py-2.5 last:border-b-0"
          >
            {isToday && (
              <span className="absolute top-3 -left-4 h-[22px] w-[5px] rounded-r-[3px] bg-primary" aria-hidden="true" />
            )}
            <button
              type="button"
              className={cn("flex min-h-11 flex-col items-start text-left", tone && toneText[tone])}
              onClick={() => onSelect(d)}
              aria-current={isToday ? "date" : undefined}
            >
              <span className={cn("text-2xl leading-none", isToday ? "font-extrabold" : "font-bold")}>
                {d.getDate()}
              </span>
              <span className={cn("mt-1 text-xs", !tone && "text-ink-2")}>
                {WEEKDAYS[d.getDay()]}
                {hol ? ` ${hol}` : ""}
              </span>
            </button>
            <ItemList items={items.filter((i) => onDay(i, d))} onOpen={onOpen} leaving={leaving} empty="予定なし" />
          </div>
        );
      })}
    </section>
  );
}
