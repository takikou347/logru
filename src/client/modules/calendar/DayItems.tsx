import { Dot } from "@/components/Panel";
import { WEEKDAYS, dayTone, formatTime, holidayName, onDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ViewItem } from "./model";

/** 土日と祝日の文字の色。日曜と祝日は朱、土曜は瑠璃 */
export const toneText = { sun: "text-sun", sat: "text-sat" } as const;

/**
 * 一覧の題名。招待への自分の返事で見た目を変える。#28
 * 返事待ちは、題名の横に「返事待ち」をグループの色の枠で添える。参加しないは取り消し線を引き、読み上げにも伝える。
 */
export function ItemTitle({ item }: { item: Pick<ViewItem, "title" | "myResponse" | "color"> }) {
  if (item.myResponse === "declined") {
    return (
      <span className="truncate line-through decoration-ink-2">
        {item.title}
        <span className="sr-only">（参加しない）</span>
      </span>
    );
  }
  return (
    <>
      <span className="truncate">{item.title}</span>
      {item.myResponse === "pending" && (
        <span
          className={cn(
            "flex-none rounded-full px-1.5 py-px text-[10px] leading-4 font-bold text-ink-2 shadow-[inset_0_0_0_1px_var(--c)]",
            `c-${item.color}`,
          )}
        >
          返事待ち
        </span>
      )}
    </>
  );
}

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
          <button
            type="button"
            data-response={i.myResponse}
            className={cn("grid min-h-11 w-full grid-cols-[46px_1fr] items-center gap-1 py-1 text-left", i.myResponse === "declined" && "opacity-55")}
            onClick={() => onOpen(i)}
          >
            <time className="text-sm font-medium text-ink-2">{i.allDay ? "終日" : formatTime(i.startsAt)}</time>
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Dot color={i.color} response={i.myResponse} />
              <ItemTitle item={i} />
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
      data-testid="day-panel"
      className="glass grid grid-cols-[auto_1fr] items-start gap-4 rounded-panel px-4.5 py-4 xl:grid-cols-1"
      aria-label={`${day.getMonth() + 1}月${day.getDate()}日の予定`}
    >
      <div data-tone={tone ?? undefined} className={cn("flex min-w-[72px] flex-col xl:flex-row xl:items-end xl:gap-3", tone && toneText[tone])}>
        <span data-testid="big-day" className="text-[72px] leading-[0.9] font-bold tracking-[-0.04em] xl:text-[88px]">{day.getDate()}</span>
        <div>
          <div className="mt-2 text-sm font-bold">{WEEKDAYS[day.getDay()]}曜</div>
          {hol && <div className="mt-0.5 text-[11px] text-ink-2">{hol}</div>}
        </div>
      </div>
      <ItemList items={mine} onOpen={onOpen} empty="予定はありません。日付を押すと、その日の予定を足せます。" />
    </section>
  );
}
