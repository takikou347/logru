import { useRef } from "react";
import { WEEKDAYS, DAY_MS, dayTone, formatDay, formatTime, holidayName, onDay, sameDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { toneText } from "./DayItems";
import type { ViewItem } from "./model";

/** スマホのマスに出す点の数 */
const MAX_DOTS = 3;
/** PC のマスに出す予定の数 */
const MAX_CHIPS = 3;
/** 長押しとみなす時間 */
const LONG_PRESS_MS = 500;

/**
 * 月の表。0010
 *
 * スマホは、マスに色の点だけを出し、押すと下にその日の予定が出る。長押しでその日の予定を足す。
 * PC は、マスに予定の名前まで出す。何日も続く終日の予定は、色で塗る。
 *
 * 今日は丸で囲まず、マスを板にして、上端にしおりを垂らす。
 *
 * @param days 表に並べる日。6 週ぶん
 * @param month いまの月。前後の月の日は薄くする
 * @param onLongPress 長押ししたとき
 * @param onOpenItem PC で予定を押したとき
 */
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
    <section className="glass rounded-panel px-2 pt-2.5 pb-2 lg:flex lg:min-h-[calc(100dvh-106px)] lg:flex-col lg:p-3 lg:pb-2.5" aria-label="月の表">
      <div className="grid grid-cols-7" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={cn(
              "pb-1 text-center text-[11px] font-medium text-ink-2 lg:px-2.5 lg:pb-2 lg:text-left lg:text-xs",
              i === 0 && "text-sun",
              i === 6 && "text-sat",
            )}
          >
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 lg:flex-1 lg:auto-rows-[minmax(112px,1fr)]" role="grid">
        {days.map((d) => {
          const mine = items.filter((i) => onDay(i, d));
          const tone = dayTone(d);
          const hol = holidayName(d);
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, selected);
          const isOut = d.getMonth() !== month;
          const label = `${formatDay(d)}${hol ? ` ${hol}` : ""}${isToday ? " 今日" : ""}。予定 ${mine.length} 件`;
          return (
            <div
              key={d.getTime()}
              role="gridcell"
              data-date={d.getDate()}
              data-today={isToday || undefined}
              className={cn(
                "relative flex min-h-[52px] touch-manipulation flex-col items-center pt-1.5 select-none [-webkit-touch-callout:none]",
                "lg:@container lg:items-stretch lg:gap-1 lg:border-t lg:border-line lg:px-1.5 lg:pt-2 lg:pb-1.5",
              )}
            >
              <button
                type="button"
                className={cn(
                  "absolute inset-0 z-[1] rounded-xl",
                  isSelected && !isToday && "bg-field shadow-[inset_0_0_0_1.5px_var(--line)]",
                  isToday && "bg-field-strong shadow-[inset_0_1px_0_var(--glass-edge),0_6px_14px_-8px_rgba(0,0,0,.45)]",
                )}
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
              {isToday && (
                <span
                  className="absolute top-0 left-1/2 z-[3] h-[5px] w-4 -translate-x-1/2 rounded-b-[3px] bg-primary lg:left-3.5 lg:w-[22px] lg:translate-x-0"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "pointer-events-none relative z-[2] text-[17px] leading-none font-medium lg:pl-1 lg:text-xl",
                  tone && toneText[tone],
                  isOut && "text-ink-3 opacity-60",
                  isToday && "pt-[3px] font-extrabold",
                )}
              >
                {d.getDate()}
              </span>
              {hol && (
                <span className="pointer-events-none absolute top-3 right-2 z-[2] hidden text-[10px] text-sun lg:block @max-[90px]:hidden">
                  {hol}
                </span>
              )}
              <span className="pointer-events-none relative z-[2] mt-1.5 flex items-center gap-[3px] text-[10px] text-ink-2 lg:hidden" aria-hidden="true">
                {mine.slice(0, MAX_DOTS).map((i) => (
                  <span key={`${i.extension}:${i.id}`} className={cn("swatch-dot size-1.5", `c-${i.color}`)} />
                ))}
                {mine.length > MAX_DOTS && <span>+{mine.length - MAX_DOTS}</span>}
              </span>
              <span className="relative z-[2] hidden min-w-0 flex-col gap-[3px] lg:flex">
                {mine.slice(0, MAX_CHIPS).map((i) => (
                  <EventChip key={`${i.extension}:${i.id}`} item={i} onOpen={() => onOpenItem(i)} />
                ))}
                {mine.length > MAX_CHIPS && (
                  <button type="button" className="pl-1.5 text-left text-[11px] text-ink-2" onClick={() => onSelect(d)}>
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

/**
 * PC のマスの中の予定。左に色の縦線を引く。
 * 何日も続く終日の予定は、縦線の代わりに全体を色で塗る。
 * マスが狭いときは、時刻を隠して予定名を優先する。
 */
function EventChip({ item, onOpen }: { item: ViewItem; onOpen: () => void }) {
  const spans = item.allDay && item.endsAt != null && item.endsAt - item.startsAt > DAY_MS;
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-6 min-w-0 items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-1 text-left text-xs leading-tight font-medium whitespace-nowrap",
        spans
          ? "bg-(--c) text-[#17202c]"
          : "bg-[color-mix(in_srgb,var(--c)_18%,transparent)] before:w-[3px] before:flex-none before:self-stretch before:rounded-xs before:bg-(--c) before:content-['']",
        `c-${item.color}`,
      )}
      onClick={onOpen}
    >
      {!item.allDay && <time className={cn("flex-none @max-[90px]:hidden", spans ? "text-[#17202c]" : "text-ink-2")}>{formatTime(item.startsAt)}</time>}
      <span className="min-w-0 truncate">{item.title}</span>
    </button>
  );
}
