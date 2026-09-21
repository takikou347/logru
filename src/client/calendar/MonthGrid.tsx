import { useRef } from "react";
import { WEEKDAYS, dayTone, formatDay, formatTime, holidayName, onDay, sameDay } from "../lib/dates";
import type { ViewItem } from "./model";

const MAX_DOTS = 3;
const MAX_CHIPS = 3;
const LONG_PRESS_MS = 500;

export function MonthGrid({
  days,
  month,
  today,
  selected,
  items,
  onSelect,
  onLongPress,
  onOpenItem,
}: {
  days: Date[];
  month: number;
  today: Date;
  selected: Date;
  items: ViewItem[];
  onSelect: (d: Date) => void;
  onLongPress: (d: Date) => void;
  onOpenItem: (item: ViewItem) => void;
}) {
  const press = useRef<{ timer: number; fired: boolean } | null>(null);

  function startPress(d: Date) {
    const state = { timer: 0, fired: false };
    state.timer = window.setTimeout(() => {
      state.fired = true;
      navigator.vibrate?.(10);
      onLongPress(d);
    }, LONG_PRESS_MS);
    press.current = state;
  }
  function cancelPress() {
    if (press.current) window.clearTimeout(press.current.timer);
  }

  return (
    <section className="mgrid glass" aria-label="月の表">
      <div className="wk" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="days" role="grid">
        {days.map((d) => {
          const mine = items.filter((i) => onDay(i, d));
          const tone = dayTone(d);
          const hol = holidayName(d);
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selected);
          const cls = ["day", tone ?? "", d.getMonth() !== month ? "out" : "", isToday ? "now" : "", isSelected ? "selected" : ""]
            .filter(Boolean)
            .join(" ");
          const label = `${formatDay(d)}${hol ? ` ${hol}` : ""}${isToday ? " 今日" : ""}。予定 ${mine.length} 件`;
          return (
            <div key={d.getTime()} className={cls} role="gridcell" data-date={d.getDate()}>
              <button
                type="button"
                className="hit"
                aria-label={label}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                onPointerDown={() => startPress(d)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  if (press.current?.fired) return;
                  onSelect(d);
                }}
              />
              <span className="d">{d.getDate()}</span>
              {hol && <span className="hn">{hol}</span>}
              <span className="dots" aria-hidden="true">
                {mine.slice(0, MAX_DOTS).map((i) => (
                  <span key={i.id} className={`dot c-${i.color}`} />
                ))}
                {mine.length > MAX_DOTS && <span>+{mine.length - MAX_DOTS}</span>}
              </span>
              <span className="chips">
                {mine.slice(0, MAX_CHIPS).map((i) => {
                  const spans = i.allDay && i.endsAt != null && i.endsAt - i.startsAt > 24 * 60 * 60 * 1000;
                  return (
                    <button key={i.id} type="button" className={`ev c-${i.color}${spans ? " span" : ""}`} onClick={() => onOpenItem(i)}>
                      {!i.allDay && <time>{formatTime(i.startsAt)}</time>}
                      <span className="tt">{i.title}</span>
                    </button>
                  );
                })}
                {mine.length > MAX_CHIPS && (
                  <button type="button" className="ev-more" onClick={() => onSelect(d)}>
                    ほか {mine.length - MAX_CHIPS} 件
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
