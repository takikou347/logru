import { useId, useState } from "react";
import { Dot } from "@/components/parts/Panel";
import { dayTone, formatTime, holidayName, onDay, sameDay, WEEKDAYS } from "@/lib/dates";
import { useDeviceTilt } from "@/lib/use-device-tilt";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { kindIconOf } from "../kind-icon";
import { type ItemKind, KIND_LABEL, KIND_ORDER, kindOf, type ViewItem } from "../model";
import { takeJustAdded } from "../recent-items";
import { itemKey } from "../use-undoable-delete";

/** 土日と祝日の文字の色。日曜と祝日は朱、土曜は瑠璃 */
export const toneText = { sun: "text-sun", sat: "text-sat" } as const;

/**
 * 一覧の題名。招待への自分の返事で見た目を変える。#28
 * 返事待ちは、題名の横に「返事待ち」をグループの色の枠で添える。参加しないは取り消し線を引き、読み上げにも伝える。
 */
function ItemTitle({ item }: { item: Pick<ViewItem, "title" | "myResponse" | "color"> }) {
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

/** 金額を `¥1,200` の形に整える。家計簿の見出しの合計に使う。カレンダーは拡張の書式を知らないので、ここに持つ。0056 */
function formatTotal(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/** 種類の見出し。家計簿は、その日の合計を右に添える。0056 */
function KindHeading({ id, kind, total }: { id: string; kind: ItemKind; total?: number }) {
  return (
    <div id={id} className="mb-1 flex items-baseline justify-between px-0.5 text-xs font-bold text-ink-2">
      <span>{KIND_LABEL[kind]}</span>
      {total !== undefined && <span className="text-ink tabular-nums">{formatTotal(total)}</span>}
    </div>
  );
}

/**
 * 予定の一覧。色だけで見分けさせず、グループ名も出す。0012
 * 「予定」「思い出」「家計簿」の見出しで分ける。家計簿の見出しには、その日の合計を出す。0056
 * @param empty 1 件も無いときに出す文
 * @param leaving 消した直後、縮んで消える動きの途中にある項目の itemKey。0044、0048、#98
 */
export function ItemList({
  items,
  onOpen,
  empty,
  leaving,
}: {
  items: ViewItem[];
  onOpen: (i: ViewItem) => void;
  empty: string;
  leaving?: Set<string>;
}) {
  const headingId = useId();
  if (items.length === 0) return <p className="py-2.5 text-[13px] leading-relaxed text-ink-2">{empty}</p>;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {KIND_ORDER.map((kind) => {
        const kindItems = items.filter((i) => kindOf(i) === kind);
        if (kindItems.length === 0) return null;
        const total = kind === "expense" ? kindItems.reduce((sum, i) => sum + (i.amount ?? 0), 0) : undefined;
        const id = `${headingId}-${kind}`;
        return (
          <div key={kind} role="group" aria-labelledby={id}>
            <KindHeading id={id} kind={kind} total={total} />
            <ul className="flex min-w-0 flex-col">
              {kindItems.map((i) =>
                kind === "expense" ? (
                  <MoneyRow key={itemKey(i)} item={i} onOpen={onOpen} isLeaving={!!leaving?.has(itemKey(i))} />
                ) : (
                  <ItemRow key={itemKey(i)} item={i} onOpen={onOpen} isLeaving={!!leaving?.has(itemKey(i))} />
                ),
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 一覧の 1 行。予定ではない項目は、色の点の隣に拡張のアイコンを付ける。色は誰の記録か、アイコンは何の記録かを表す。0056
 * 足した直後は膨らんで入り、消す途中は縮んで消える。動かすのは transform と opacity だけ。0044、0048、#98
 */
function ItemRow({
  item: i,
  onOpen,
  isLeaving,
}: {
  item: ViewItem;
  onOpen: (i: ViewItem) => void;
  isLeaving: boolean;
}) {
  const kind = kindOf(i);
  // 描いた瞬間に 1 度だけ読む。足した直後の再描画と、月・日を移る再描画を見分けるため
  const [entering] = useState(() => takeJustAdded(itemKey(i)));
  const Icon = kind !== "event" ? kindIconOf(i) : null;
  return (
    <li
      className={cn("border-line not-first:border-t", entering && "item-enter")}
      data-leaving={isLeaving || undefined}
    >
      <button
        type="button"
        data-response={i.myResponse}
        className={cn(
          "grid min-h-11 w-full grid-cols-[46px_1fr] items-center gap-1 py-1 text-left",
          i.myResponse === "declined" && "opacity-55",
        )}
        onClick={() => onOpen(i)}
      >
        <time className="text-sm font-medium text-ink-2">{i.allDay ? "終日" : formatTime(i.startsAt)}</time>
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Dot color={i.color} response={i.myResponse} />
          {Icon && <Icon className="size-3.5 flex-none text-ink-2" aria-hidden="true" />}
          {kind !== "event" && <span className="sr-only">{KIND_LABEL[kind]}、</span>}
          <ItemTitle item={i} />
          <span className="ml-auto flex-none pl-1.5 text-[11px] font-normal text-ink-2">{i.groupName}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * 家計簿など、金額の 1 行。円のアイコンと金額を右寄せにする。数字の幅は tabular-nums でそろえる。塗らない札。0056
 * 足した直後は膨らんで入り、消す途中は縮んで消える。動かすのは transform と opacity だけ。0044、0048、#98
 */
function MoneyRow({
  item: i,
  onOpen,
  isLeaving,
}: {
  item: ViewItem;
  onOpen: (i: ViewItem) => void;
  isLeaving: boolean;
}) {
  const [entering] = useState(() => takeJustAdded(itemKey(i)));
  const Icon = kindIconOf(i);
  return (
    <li
      className={cn("border-line not-first:border-t", entering && "item-enter")}
      data-leaving={isLeaving || undefined}
    >
      <button
        type="button"
        className="grid min-h-11 w-full grid-cols-[46px_1fr] items-center gap-1 py-1 text-left"
        onClick={() => onOpen(i)}
      >
        <Icon className="size-4 text-ink-2" aria-hidden="true" />
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Dot color={i.color} />
          <span className="sr-only">{KIND_LABEL.expense}、</span>
          <span className="min-w-0 truncate text-ink-2">{i.groupName}</span>
          <span className="ml-auto font-semibold text-ink tabular-nums">{i.title}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * 選んだ日の予定。大きな日付と、その日の予定を並べる。
 * スマホは月の表の下、PC は右の列に出す。
 *
 * 今日だけ、端末の傾きで中身(数字と予定)を最大 6px ずらして奥行きを出す。ガラスの面自体は動かさない。
 * iOS は、初めて触ったときに 1 度だけ許可を求める。動きを減らしているときは止める。0044、0048、#112
 * @param leaving 消した直後、縮んで消える動きの途中にある項目の itemKey。0044、0048、#98
 */
export function DayPanel({
  day,
  today,
  items,
  onOpen,
  leaving,
}: {
  day: Date;
  today: Date;
  items: ViewItem[];
  onOpen: (i: ViewItem) => void;
  leaving?: Set<string>;
}) {
  const tone = dayTone(day);
  const hol = holidayName(day);
  const mine = items.filter((i) => onDay(i, day));
  const isToday = sameDay(day, today);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { offset, requestOnce } = useDeviceTilt(isToday && !reduced);
  const tiltStyle = isToday ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` } : undefined;
  return (
    <section
      data-testid="day-panel"
      className="glass grid grid-cols-[auto_1fr] items-start gap-4 rounded-panel px-4.5 py-4 xl:grid-cols-1"
      aria-label={`${day.getMonth() + 1}月${day.getDate()}日の予定`}
      onPointerDown={isToday ? requestOnce : undefined}
    >
      <div
        data-tone={tone ?? undefined}
        style={tiltStyle}
        className={cn(
          "flex min-w-[72px] flex-col xl:flex-row xl:items-end xl:gap-3",
          tone && toneText[tone],
          isToday && "transition-transform duration-fast ease-out",
        )}
      >
        <span data-testid="big-day" className="text-[72px] leading-[0.9] font-bold tracking-[-0.04em] xl:text-[88px]">
          {day.getDate()}
        </span>
        <div>
          <div className="mt-2 text-sm font-bold">{WEEKDAYS[day.getDay()]}曜</div>
          {/* 祝日の名前。ガラスの光沢が乗る場所なので、薄い文字だと読めない */}
          {hol && <div className="mt-0.5 text-[11px] text-ink">{hol}</div>}
        </div>
      </div>
      <div style={tiltStyle} className={cn(isToday && "transition-transform duration-fast ease-out")}>
        <ItemList
          items={mine}
          onOpen={onOpen}
          leaving={leaving}
          empty="予定はありません。日付を押すと、その日の予定を足せます。"
        />
      </div>
    </section>
  );
}
