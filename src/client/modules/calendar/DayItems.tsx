import { Dot } from "@/components/Panel";
import { WEEKDAYS, dayTone, formatTime, holidayName, onDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ViewItem } from "./model";

/** 土日と祝日の文字の色。日曜と祝日は朱、土曜は瑠璃 */
export const toneText = { sun: "text-sun", sat: "text-sat" } as const;

/**
 * 予定の一覧。色だけで見分けさせず、グループ名も出す。0012
 * @param empty 1 件も無いときに出す文
 */
export function ItemList({ items, onOpen, empty }: { items: ViewItem[]; onOpen: (i: ViewItem) => void; empty: string }) {
  if (items.length === 0) return <p className="py-2.5 text-[13px] leading-relaxed text-ink-2">{empty}</p>;
  return (
    <ul className="flex min-w-0 flex-col">
      {items.map((i) => (
        <li key={`${i.extension}:${i.id}`} className="border-line not-first:border-t">
          <button type="button" className="grid min-h-11 w-full grid-cols-[46px_1fr] items-center gap-1 py-1 text-left" onClick={() => onOpen(i)}>
            <time className="text-sm font-medium text-ink-2">{i.allDay ? "終日" : formatTime(i.startsAt)}</time>
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Dot color={i.color} />
              <span className="truncate">{i.title}</span>
              <span className="ml-auto flex-none pl-1.5 text-[11px] font-normal text-ink-2">{i.groupName}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * 選んだ日の予定。大きな日付と、その日の予定を並べる。
 * スマホは月の表の下、PC は右の列に出す。
 */
export function DayPanel({ day, items, onOpen }: { day: Date; items: ViewItem[]; onOpen: (i: ViewItem) => void }) {
  const tone = dayTone(day);
  const hol = holidayName(day);
  const mine = items.filter((i) => onDay(i, day));
  return (
    <section
      className="glass grid grid-cols-[auto_1fr] items-start gap-4 rounded-panel px-4.5 py-4 xl:grid-cols-1"
      aria-label={`${day.getMonth() + 1}月${day.getDate()}日の予定`}
    >
      <div className={cn("flex min-w-[72px] flex-col xl:flex-row xl:items-end xl:gap-3", tone && toneText[tone])}>
        <span className="text-[72px] leading-[0.9] font-bold tracking-[-0.04em] xl:text-[88px]">{day.getDate()}</span>
        <div>
          <div className="mt-2 text-sm font-bold">{WEEKDAYS[day.getDay()]}曜</div>
          {hol && <div className="mt-0.5 text-[11px] text-ink-2">{hol}</div>}
        </div>
      </div>
      <ItemList items={mine} onOpen={onOpen} empty="予定はありません。日付を長押しすると、その日の予定を足せます。" />
    </section>
  );
}
