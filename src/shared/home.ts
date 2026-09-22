/**
 * ホーム画面のウィジェットの並びを組み立てる、純粋な関数。画面とサーバーの両方が使う。0028
 *
 * ウィジェットの中身(名前、部品)は画面の側の ClientExtension だけが持つ。ここでは
 * key と大きさの並びだけを扱う。並びの検証はサーバーの入力の検証にも使う。
 */

import type { HomeWidgetEntry, HomeWidgetSize } from "./api-types";

/** カレンダーの本体の key。土台なので外せず、並びから消えても先頭に戻す。0001 */
export const HOME_CALENDAR_WIDGET_KEY = "home.calendar";

/** 選べる大きさ */
export const HOME_WIDGET_SIZES = ["small", "medium", "large"] as const satisfies readonly HomeWidgetSize[];

/** 並びを組み立てるときに要る、カタログの 1 件分の情報だけ */
export type HomeWidgetCatalogEntry = {
  key: string;
  defaultSize: HomeWidgetSize;
  /** 初めて開いたとき、既定で置くか */
  defaultPlaced: boolean;
};

/** 保存がまだ無いときの、既定の並び。カタログの登録順で、最初に置くものだけを拾う */
export function defaultHomeLayout(catalog: readonly HomeWidgetCatalogEntry[]): HomeWidgetEntry[] {
  return catalog.filter((w) => w.defaultPlaced).map((w) => ({ key: w.key, size: w.defaultSize }));
}

/**
 * 保存した並びのうち、いま画面に出してよいものだけを返す。
 * カタログに無い key(拡張を消した後など)と、isVisible が false を返す key(無効な拡張)は除く。
 * カレンダーの本体は、並びに無くても先頭に足す。外せないウィジェットのため
 */
export function visibleHomeLayout(
  saved: readonly HomeWidgetEntry[],
  catalog: readonly HomeWidgetCatalogEntry[],
  isVisible: (key: string) => boolean,
): HomeWidgetEntry[] {
  const byKey = new Map(catalog.map((w) => [w.key, w]));
  const seen = new Set<string>();
  const out: HomeWidgetEntry[] = [];
  for (const entry of saved) {
    const widget = byKey.get(entry.key);
    if (!widget || seen.has(entry.key) || !isVisible(entry.key)) continue;
    seen.add(entry.key);
    out.push(entry);
  }
  if (!seen.has(HOME_CALENDAR_WIDGET_KEY)) {
    const calendar = byKey.get(HOME_CALENDAR_WIDGET_KEY);
    if (calendar) out.unshift({ key: calendar.key, size: calendar.defaultSize });
  }
  return out;
}

/**
 * 編集で直した「見えている並び」に、隠れていたウィジェット(無効な拡張のものなど)を戻して、保存する形を組み立てる。
 * 隠れていたものは、直す前に直後にあった見えるウィジェットの後ろに戻す。0028
 *
 * @param previous 直す前に保存していた並び。隠れていたものも含む
 * @param edited 編集の画面で直した、見えるものだけの並び
 * @param isVisible その key がいま見えるか(有効な拡張か)
 */
export function mergeHomeLayout(
  previous: readonly HomeWidgetEntry[],
  edited: readonly HomeWidgetEntry[],
  isVisible: (key: string) => boolean,
): HomeWidgetEntry[] {
  const after = new Map<string | null, HomeWidgetEntry[]>();
  let anchor: string | null = null;
  for (const entry of previous) {
    if (isVisible(entry.key)) {
      anchor = entry.key;
      continue;
    }
    const list = after.get(anchor) ?? [];
    list.push(entry);
    after.set(anchor, list);
  }
  const out: HomeWidgetEntry[] = [...(after.get(null) ?? [])];
  for (const entry of edited) {
    out.push(entry);
    out.push(...(after.get(entry.key) ?? []));
  }
  // 編集で消えた見えるウィジェットの後ろにあった隠れたウィジェットは、行き場が無いので末尾に付ける
  const placed = new Set(out.map((e) => e.key));
  for (const entry of previous) {
    if (!isVisible(entry.key) && !placed.has(entry.key)) {
      out.push(entry);
      placed.add(entry.key);
    }
  }
  return out;
}

/** 並びに同じ key が 2 つ無く、カレンダーの本体を含むか。サーバーの入力の検証で使う */
export function isValidHomeLayout(widgets: readonly HomeWidgetEntry[]): boolean {
  const keys = widgets.map((w) => w.key);
  return new Set(keys).size === keys.length && keys.includes(HOME_CALENDAR_WIDGET_KEY);
}
