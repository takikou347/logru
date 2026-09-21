import { WEEKDAYS, dayTone, holidayName, onDay, sameDay } from "../lib/dates";
import { ItemList } from "./DayItems";
import type { ViewItem } from "./model";

/** 週と日の表示。日ごとに予定を並べる */
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
    <section className="weeklist glass" aria-label={days.length === 1 ? "日の予定" : "週の予定"}>
      {days.map((d) => {
        const tone = dayTone(d);
        const hol = holidayName(d);
        return (
          <div key={d.getTime()} className={`weekrow${tone ? ` ${tone}` : ""}${sameDay(d, today) ? " now" : ""}`}>
            <button
              type="button"
              className="wday"
              onClick={() => onSelect(d)}
              aria-current={sameDay(d, today) ? "date" : undefined}
            >
              <span className="n">{d.getDate()}</span>
              <span className="w">
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
