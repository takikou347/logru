import { type CSSProperties, useRef } from "react";
import { WEEKDAYS, dayTone, formatDay, formatTime, holidayName, onDay, sameDay } from "@/lib/dates";
import { AvatarStack } from "@/components/Avatars";
import { cn } from "@/lib/utils";
import { toneText } from "./DayItems";
import { type SpanSegment, daySpan, hiddenPerDay, isMultiDay, layoutWeek } from "./lanes";
import type { ViewItem } from "./model";

/** スマホのマスに出す点の数 */
const MAX_DOTS = 3;
/** PC のマスに出す予定の数。帯の段と合わせた数 */
const MAX_CHIPS = 3;
/** 週の行に出す帯の段の数。あふれた帯は「ほか n 件」に数える */
const MAX_LANES = 3;
/** 長押しとみなす時間 */
const LONG_PRESS_MS = 500;

/**
 * 月の表。0010
 *
 * スマホは、マスに色の点だけを出す。何日も続く予定は、点の代わりに、かかる日をつなぐ細い線にする。
 * PC は、マスに予定の名前まで出す。何日も続く予定は、週の行ごとに 1 本の帯にする。
 * どちらの幅でも、日付を押すと、その日の予定を足すシートが開く。長押しでも同じ。0012
 *
 * 今日は丸で囲まず、マスを板にして、上端にしおりを垂らす。
 *
 * @param days 表に並べる日。週の頭から、7 日ずつ
 * @param month いまの月。前後の月の日は薄くする
 * @param onPressDay 日付のマスか「ほか n 件」を押したとき。長押しも含む
 * @param onOpenItem PC で予定を押したとき
 */
export function MonthGrid({
  days,
  month,
  today,
  selected,
  items,
  onPressDay,
  onOpenItem,
}: {
  days: Date[];
  month: number;
  today: Date;
  selected: Date;
  items: ViewItem[];
  onPressDay: (d: Date) => void;
  onOpenItem: (item: ViewItem) => void;
}) {
  const press = useRef<{ timer: number; fired: boolean } | null>(null);

  // 長押しで開いたときは、指を離したときの click で 2 回目を開かない
  function startPress(d: Date) {
    const state = { timer: 0, fired: false };
    state.timer = window.setTimeout(() => {
      state.fired = true;
      navigator.vibrate?.(10);
      onPressDay(d);
    }, LONG_PRESS_MS);
    press.current = state;
  }
  function cancelPress() {
    if (press.current) window.clearTimeout(press.current.timer);
  }

  const multi = items.filter(isMultiDay);
  const singles = items.filter((i) => !isMultiDay(i));
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7));

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
      <div className="grid lg:flex-1 lg:auto-rows-[minmax(112px,1fr)]" role="grid">
        {weeks.map((week) => {
          const { segments, lanes } = layoutWeek(multi, week[0]!);
          const shown = Math.min(lanes, MAX_LANES);
          const hidden = hiddenPerDay(segments, MAX_LANES);
          const chipSlots = Math.max(1, MAX_CHIPS - shown);
          // 1 段目は日付、続く段に帯、残りにマスの中身。段の高さは幅で変わるので CSS の変数で持つ
          const rowStyle = {
            "--lanes": shown,
            "--dot-gap": shown ? "9px" : "6px",
            gridTemplateRows: `var(--head)${shown ? ` repeat(${shown}, var(--lane))` : ""} auto`,
          } as CSSProperties;
          return (
            <div
              key={week[0]!.getTime()}
              role="row"
              className="grid grid-cols-7 [--head:30px] [--lane:5px] lg:[--head:33px] lg:[--lane:27px]"
              style={rowStyle}
            >
              {week.map((d, col) => {
                const all = items.filter((i) => onDay(i, d));
                const mine = singles.filter((i) => onDay(i, d));
                const tone = dayTone(d);
                const hol = holidayName(d);
                const isToday = sameDay(d, today);
                const isSelected = sameDay(d, selected);
                const isOut = d.getMonth() !== month;
                const label = `${formatDay(d)}${hol ? ` ${hol}` : ""}${isToday ? " 今日" : ""}。予定 ${all.length} 件`;
                const moreDots = Math.max(0, mine.length - MAX_DOTS) + hidden[col]!;
                const moreChips = Math.max(0, mine.length - chipSlots) + hidden[col]!;
                return (
                  <div
                    key={d.getTime()}
                    role="gridcell"
                    data-date={d.getDate()}
                    data-today={isToday || undefined}
                    data-out={isOut || undefined}
                    style={{ gridColumn: col + 1, gridRow: "1 / -1" }}
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
                        onPressDay(d);
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
                        // 前後の月の日。色で薄く見せる。opacity を重ねると読めなくなる
                        isOut && "text-ink-3",
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
                    <span
                      className="pointer-events-none relative z-[2] mt-[calc(var(--lanes)*var(--lane)+var(--dot-gap))] flex items-center gap-[3px] text-[10px] text-ink-2 lg:hidden"
                      aria-hidden="true"
                    >
                      {mine.slice(0, MAX_DOTS).map((i) => (
                        <span
                          key={`${i.extension}:${i.id}`}
                          data-response={i.myResponse}
                          className={cn("swatch-dot size-1.5", `c-${i.color}`, responseMark[i.myResponse ?? "accepted"])}
                        />
                      ))}
                      {moreDots > 0 && <span>+{moreDots}</span>}
                    </span>
                    <span className="relative z-[2] hidden min-w-0 flex-col gap-[3px] lg:mt-[calc(var(--lanes)*var(--lane))] lg:flex">
                      {mine.slice(0, chipSlots).map((i) => (
                        <EventChip key={`${i.extension}:${i.id}`} item={i} onOpen={() => onOpenItem(i)} />
                      ))}
                      {moreChips > 0 && (
                        <button type="button" className="pl-1.5 text-left text-[11px] text-ink-2" onClick={() => onPressDay(d)}>
                          ほか {moreChips} 件
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              {segments
                .filter((s) => s.lane < MAX_LANES)
                .map((s) => (
                  <SpanMarks key={`${s.item.extension}:${s.item.id}`} segment={s} onOpen={() => onOpenItem(s.item)} />
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 招待への自分の返事を、読み上げに添える言葉 */
const responseWord = { pending: "、返事待ち", declined: "、参加しない", accepted: "" } as const;

/**
 * スマホの点の、返事ごとの見た目。#28
 * 返事待ちは塗らずに輪だけ、参加しないは薄くする。参加するか、招待の無い予定はいまのまま
 */
const responseMark = {
  accepted: "",
  pending: "bg-transparent! shadow-[inset_0_0_0_1.5px_var(--c)]",
  declined: "opacity-35",
} as const;

/** 帯の読み上げ。`出張、9月21日から9月25日まで` の形 */
function spanLabel(item: ViewItem): string {
  const { first, last } = daySpan(item);
  const day = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  const tail = responseWord[item.myResponse ?? "accepted"];
  if (item.allDay) return `${item.title}、${day(first)}から${day(last)}まで${tail}`;
  return `${item.title}、${day(first)} ${formatTime(item.startsAt)}から${day(last)} ${formatTime(item.endsAt!)}まで${tail}`;
}

/**
 * 帯に出す参加者の丸の数。1 日の幅に 2 つまで。題名の場所を残すため、1 日だけの帯には出さない。#28
 * @param span 帯がかかる日数。この週の中の分
 */
function avatarSlots(span: number): number {
  return span < 2 ? 0 : span * 2;
}

/**
 * 何日も続く予定の、1 週ぶんの印。PC は押せる帯、スマホは細い線にする。
 * 前後の週へ続く側は角を立て、マスの端まで伸ばす。題名は、続きの週でも左端に出す。
 * 終日は色で塗り、時刻のある予定は 1 日の予定と同じ薄い色に縦線を付ける。
 *
 * 招待への自分の返事で見た目を変える。#28
 * 返事待ちは塗らずにグループの色の枠線だけ。スマホの線は点線にする。参加しないは薄くし、題名に取り消し線を引く。
 * 招待した予定は、帯の始まりの週の右端に参加者の頭文字の丸を重ねて出す。
 */
function SpanMarks({ segment, onOpen }: { segment: SpanSegment<ViewItem>; onOpen: () => void }) {
  const { item, col, span, lane, before, after } = segment;
  const place = { gridColumn: `${col + 1} / span ${span}`, gridRow: lane + 2 };
  const pending = item.myResponse === "pending";
  const declined = item.myResponse === "declined";
  const avatars = !before && item.people.length > 1 ? avatarSlots(span) : 0;
  return (
    <>
      <span
        aria-hidden="true"
        style={place}
        data-response={item.myResponse}
        className={cn(
          "pointer-events-none relative z-[2] h-[3px] self-start opacity-80 lg:hidden",
          before ? "ml-0" : "ml-2.5 rounded-l-full",
          after ? "mr-0" : "mr-2.5 rounded-r-full",
          pending ? "bg-[repeating-linear-gradient(90deg,var(--c)_0_4px,transparent_4px_7px)]" : "bg-(--c)",
          declined && "opacity-30",
          `c-${item.color}`,
        )}
      />
      <button
        type="button"
        style={place}
        data-response={item.myResponse}
        className={cn(
          "relative z-[2] hidden h-6 min-w-0 items-center gap-1.5 self-start overflow-hidden px-1.5 text-left text-xs leading-tight font-medium whitespace-nowrap lg:flex",
          before ? "ml-0" : "ml-1.5 rounded-l-md",
          after ? "mr-0" : "mr-1.5 rounded-r-md",
          pending
            ? "bg-(--glass-flat) shadow-[inset_0_0_0_1.5px_var(--c)]"
            : item.allDay
              ? "bg-(--c) text-[#17202c]"
              : "bg-[color-mix(in_srgb,var(--c)_18%,transparent)]",
          !pending && !item.allDay && !before && "before:w-[3px] before:flex-none before:self-stretch before:rounded-xs before:bg-(--c) before:content-['']",
          declined && "opacity-50",
          `c-${item.color}`,
        )}
        aria-label={spanLabel(item)}
        onClick={onOpen}
      >
        {!item.allDay && !before && <time className="flex-none text-ink-2">{formatTime(item.startsAt)}</time>}
        {item.tag && !before && <span className="flex-none rounded-[4px] bg-black/15 px-1 text-[10px] leading-4 font-bold">{item.tag}</span>}
        <span className={cn("min-w-0 truncate", declined && "line-through")}>{item.title}</span>
        {avatars > 0 && <AvatarStack people={item.people} max={avatars} size={18} className="ml-auto" />}
      </button>
    </>
  );
}

/**
 * PC のマスの中の、1 日だけの予定。左に色の縦線を引く。
 * マスが狭いときは、時刻を隠して予定名を優先する。
 * 返事待ちは塗らずに枠線だけ、参加しないは薄くして取り消し線。#28
 */
function EventChip({ item, onOpen }: { item: ViewItem; onOpen: () => void }) {
  const pending = item.myResponse === "pending";
  const declined = item.myResponse === "declined";
  return (
    <button
      type="button"
      data-response={item.myResponse}
      className={cn(
        "flex min-h-6 min-w-0 items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-1 text-left text-xs leading-tight font-medium whitespace-nowrap",
        item.secondary
          ? "text-ink-2"
          : pending
          ? "shadow-[inset_0_0_0_1.5px_var(--c)]"
          : "bg-[color-mix(in_srgb,var(--c)_18%,transparent)] before:w-[3px] before:flex-none before:self-stretch before:rounded-xs before:bg-(--c) before:content-['']",
        declined && "opacity-50",
        `c-${item.color}`,
      )}
      onClick={onOpen}
    >
      {!item.allDay && <time className="flex-none text-ink-2 @max-[90px]:hidden">{formatTime(item.startsAt)}</time>}
      {item.tag && !item.secondary && <span className="flex-none rounded-[4px] bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] px-1 text-[10px] leading-4 font-bold text-ink-2">{item.tag}</span>}
      <span className={cn("min-w-0 truncate", declined && "line-through")}>{item.title}</span>
      {item.myResponse && item.myResponse !== "accepted" && <span className="sr-only">{responseWord[item.myResponse]}</span>}
    </button>
  );
}
