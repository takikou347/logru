/**
 * 今日のページの節の並べ方・開き方・要約。0090、0092、F-45
 *
 * 見た目(TodayPage)からは、計算だけを分けて置く。E2E からは組める拡張が
 * 4 つしか無く「7 個以上で畳む」を実の画面では試せないため、ここの関数は Vitest の単体テストで確かめる。
 */
import type { TodayPagePrefs, TodaySortMode } from "@shared/api-types";

/** これ以下の節の数なら、すべて開く */
export const AUTO_OPEN_ALL_UP_TO = 6;
/** 節が 7 個以上のとき、既定で開く数 */
export const AUTO_OPEN_WHEN_MANY = 3;
/** 畳んだ機能の札に出す要約の、目安の文字数 */
export const SUMMARY_MAX_CHARS = 7;

/**
 * 今日のページに並べる節の順を決める。
 *
 * favorite・added はどちらも、渡された並び(拡張の一覧の順。alwaysOn は含まない)のままにする。
 * よく使う頻度を数える仕組みが無いため、いまは 2 つの並べ方が同じ結果になる。0091 の「困ること」と同じ考え。
 * manual は、保存した並び(manualOrder。0058 の extensionOrder をそのまま使う)を先に敷き、
 * まだ並びに無い(新しく足した)key を、渡された並びの順で末尾に足す。並びに残っていても、
 * いま使える key に無ければ落とす。
 * @param keys 今日のページの節を持つ、使える拡張の key。拡張の一覧の順
 */
export function orderTodaySectionKeys(keys: string[], sortMode: TodaySortMode, manualOrder: string[]): string[] {
  if (sortMode !== "manual") return keys;
  const known = new Set(keys);
  const kept = manualOrder.filter((k) => known.has(k));
  const keptSet = new Set(kept);
  return [...kept, ...keys.filter((k) => !keptSet.has(k))];
}

/**
 * 節の開閉を決める。
 *
 * 6 個までは、並べ替えた順のまま全部開く。7 個以上は、先頭から 3 個だけ開き、残りは畳んだ機能の
 * 札に並べる。openOverrides にある key は、この既定より優先する(機能の画面で開く・畳むを決めたとき)。
 * @param orderedKeys orderTodaySectionKeys で並べ替えたあとの key
 */
export function computeOpenSectionKeys(orderedKeys: string[], openOverrides: Record<string, boolean>): Set<string> {
  const autoOpenKeys =
    orderedKeys.length <= AUTO_OPEN_ALL_UP_TO ? orderedKeys : orderedKeys.slice(0, AUTO_OPEN_WHEN_MANY);
  const open = new Set(autoOpenKeys);
  for (const key of orderedKeys) {
    const override = openOverrides[key];
    if (override === undefined) continue;
    if (override) open.add(key);
    else open.delete(key);
  }
  return open;
}

/** 既定の畳んだ機能の要約。中身が無ければ「まだ」、あれば件数 */
export function defaultTodaySummary(dayItemCount: number): string {
  return dayItemCount > 0 ? `${dayItemCount}件` : "まだ";
}

/** 畳んだ機能の札に出す要約を、目安の文字数(7 文字)に切る */
export function clampSummary(text: string): string {
  return text.length > SUMMARY_MAX_CHARS ? text.slice(0, SUMMARY_MAX_CHARS) : text;
}

/** 今日のページの並べ方・見せ方の既定。GET /api/me がまだ届いていない間に使う */
export const DEFAULT_TODAY_PAGE_PREFS: TodayPagePrefs = {
  sortMode: "added",
  headlineExtension: null,
  openOverrides: {},
};
