/**
 * 月の表で、何日も続く予定を週ごとの帯に分け、段を割り当てる。0010
 * 画面に依らない計算だけを置く。日は onDay と同じ数え方にする。
 */
import { DAY_MS, startOfDay } from "../../lib/dates";

type Span = { startsAt: number; endsAt: number | null; allDay: boolean };

/** 週の中の 1 本の帯 */
export type SpanSegment<T> = {
  item: T;
  /** 週の中で始まる列。日曜が 0 */
  col: number;
  /** 何日ぶん伸びるか。1 から 7 */
  span: number;
  /** 上から何段目か。0 から */
  lane: number;
  /** 前の週から続いているか */
  before: boolean;
  /** 次の週へ続くか */
  after: boolean;
};

/** a から b まで何日か */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * 項目がかかる最初の日と最後の日。終わりは含まないので、終わりの 1 ミリ秒前の日が最後の日。
 * 終わりが無いか、始まりと同じなら、始まりの日だけ。
 */
export function daySpan(item: Span): { first: Date; last: Date } {
  const first = startOfDay(new Date(item.startsAt));
  const end = item.endsAt ?? item.startsAt;
  if (end <= item.startsAt) return { first, last: first };
  return { first, last: startOfDay(new Date(end - 1)) };
}

/** 2 日以上にかかるか。終日の予定も、日をまたぐ時刻のある予定も含む */
export function isMultiDay(item: Span): boolean {
  const { first, last } = daySpan(item);
  return last > first;
}

/**
 * 1 週ぶんの帯を作る。週の外にはみ出す分は切り、前後に続くことを印で残す。
 * 段は、始まりが早い順、同じなら長い順に、上から空いている段へ入れる。
 *
 * @param items 何日も続く項目。1 日だけの項目を渡すと、1 日の帯になる
 * @param weekStart 週の頭の日。日曜の 0 時
 * @returns 帯と、使った段の数
 */
export function layoutWeek<T extends Span>(items: T[], weekStart: Date): { segments: SpanSegment<T>[]; lanes: number } {
  const placed = items
    .map((item, index) => {
      const { first, last } = daySpan(item);
      return {
        item,
        index,
        from: first.getTime(),
        length: daysBetween(first, last),
        start: daysBetween(weekStart, first),
        end: daysBetween(weekStart, last),
      };
    })
    .filter((p) => p.end >= 0 && p.start <= 6)
    .sort((a, b) => a.from - b.from || b.length - a.length || a.index - b.index);

  const laneEnds: number[] = [];
  const segments = placed.map(({ item, start, end }) => {
    const col = Math.max(0, start);
    const stop = Math.min(6, end);
    let lane = laneEnds.findIndex((e) => e < col);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = stop;
    return { item, col, span: stop - col + 1, lane, before: start < 0, after: end > 6 };
  });
  return { segments, lanes: laneEnds.length };
}

/**
 * 出しきれない段の帯が、各曜日にいくつあるか。マスの「ほか n 件」に足す。
 * @param maxLanes 出す段の数
 * @returns 日曜から土曜の 7 つの数
 */
export function hiddenPerDay(segments: SpanSegment<unknown>[], maxLanes: number): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of segments) {
    if (s.lane < maxLanes) continue;
    for (let c = s.col; c < s.col + s.span; c++) counts[c]! += 1;
  }
  return counts;
}
