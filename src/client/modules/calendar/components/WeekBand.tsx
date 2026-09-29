/**
 * 新しい見た目・スマホの、上の帯の下に出す 1 週間の帯。今日は色の丸、記録のある日には点を出す。
 * 押すとその日を選ぶ(月の表の日を押すのと同じ)。0091、issue #239
 */
import { dateKey, formatDay, onDay, sameDay, WEEKDAYS, weekDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ViewItem } from "../model";

export function WeekBand({
  selected,
  today,
  items,
  onSelect,
}: {
  selected: Date;
  today: Date;
  items: ViewItem[];
  onSelect: (d: Date) => void;
}) {
  const days = weekDays(selected);
  return (
    // .nl-only は globals.css で display: flex を強く当てる(骨組み側、PR #259 の範囲)ので、
    // grid はこの中の別の要素に置く。7 日を帯の幅いっぱいに等しく並べる
    <div className="nl-only glass rounded-panel p-2">
      <div className="grid w-full grid-cols-7 gap-1">
        {days.map((d) => {
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selected);
          const hasItems = items.some((i) => !i.secondary && onDay(i, d));
          return (
            <button
              key={dateKey(d)}
              type="button"
              aria-label={`${formatDay(d)}${isToday ? "、今日" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(d)}
              className="flex flex-col items-center gap-1 rounded-2xl py-1.5 aria-pressed:bg-field"
            >
              <span className="text-[11px] font-bold text-ink-2">{WEEKDAYS[d.getDay()]}</span>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full text-[15px] font-bold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {d.getDate()}
              </span>
              <span
                aria-hidden="true"
                className={cn("size-1.5 rounded-full", hasItems ? "bg-ink-2" : "bg-transparent")}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
