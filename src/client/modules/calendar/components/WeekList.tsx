import { dayTone, holidayName, onDay, sameDay, WEEKDAYS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ViewItem } from "../model";
import { ItemList, toneText } from "./DayItems";

/**
 * 週と日の表示。日ごとに予定を並べる。今日の日付にはテーマカラーの下線を引く。
 * @param onSelect 日付を押したとき。その日の表示に移る
 */
export function WeekList({
  days,
  today,
  items,
  onSelect,
  onOpen,
}: {
  days: Date[];
  today: Date;
  items: ViewItem[];
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
        return (
          <div
            key={d.getTime()}
            data-testid="week-row"
            className="grid grid-cols-[64px_1fr] gap-2.5 border-b border-line py-2.5 last:border-b-0"
          >
            <button
              type="button"
              className={cn("flex min-h-11 flex-col items-start text-left", tone && toneText[tone])}
              onClick={() => onSelect(d)}
              aria-current={isToday ? "date" : undefined}
            >
              <span
                className={cn(
                  "text-2xl leading-none font-bold",
                  isToday && "underline decoration-primary decoration-3 underline-offset-8",
                )}
              >
                {d.getDate()}
              </span>
              <span className={cn("mt-3 text-xs", !tone && "text-ink-2")}>
                {WEEKDAYS[d.getDay()]}
                {hol ? ` ${hol}` : ""}
              </span>
            </button>
            <ItemList items={items.filter((i) => onDay(i, d))} onOpen={onOpen} empty="予定なし" />
          </div>
        );
      })}
    </section>
  );
}
