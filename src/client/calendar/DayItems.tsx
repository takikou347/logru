import { WEEKDAYS, dayTone, formatTime, holidayName, onDay } from "../lib/dates";
import type { ViewItem } from "./model";

/** 1 日分の予定の一覧。色だけで見分けさせず、グループ名も出す。0012 */
export function ItemList({ items, onOpen, empty }: { items: ViewItem[]; onOpen: (i: ViewItem) => void; empty: string }) {
  if (items.length === 0) return <p className="none">{empty}</p>;
  return (
    <ul className="items">
      {items.map((i) => (
        <li key={i.id}>
          <button type="button" className="item" onClick={() => onOpen(i)}>
            <time>{i.allDay ? "終日" : formatTime(i.startsAt)}</time>
            <span className="t">
              <span className={`dot c-${i.color}`} aria-hidden="true" />
              <span className="title">{i.title}</span>
              <span className="who">{i.groupName}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DayPanel({ day, items, onOpen }: { day: Date; items: ViewItem[]; onOpen: (i: ViewItem) => void }) {
  const tone = dayTone(day);
  const hol = holidayName(day);
  const mine = items.filter((i) => onDay(i, day));
  return (
    <section className="daypanel glass" aria-label={`${day.getMonth() + 1}月${day.getDate()}日の予定`}>
      <div className={`bigday${tone ? ` ${tone}` : ""}`}>
        <span className="n">{day.getDate()}</span>
        <div>
          <div className="wd">{WEEKDAYS[day.getDay()]}曜</div>
          {hol && <div className="hn">{hol}</div>}
        </div>
      </div>
      <ItemList items={mine} onOpen={onOpen} empty="予定はありません。日付を長押しすると、その日の予定を足せます。" />
    </section>
  );
}
