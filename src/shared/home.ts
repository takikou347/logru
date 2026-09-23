/**
 * ホーム画面のウィジェットの並びを組み立てる、純粋な関数。画面とサーバーの両方が使う。0029
 *
 * ウィジェットの中身(名前、部品)は画面の側の ClientExtension だけが持つ。ここでは
 * key の並びだけを扱う。大きさは持たない。0037
 * 並びの検証はサーバーの入力の検証にも使う。
 */

import type { HomeWidgetEntry } from "./api-types";

/** カレンダーの本体の key。土台なので外せず、並びから消えても先頭に戻す。0001 */
export const HOME_CALENDAR_WIDGET_KEY = "home.calendar";

/** 並びを組み立てるときに要る、カタログの 1 件分の情報だけ */
export type HomeWidgetCatalogEntry = {
  key: string;
  /** 初めて開いたとき、既定で置くか */
  defaultPlaced: boolean;
};

/**
 * 保存した 1 件から key だけを取り出す。古い画面が大きさ(size)を付けて送ってきても捨てる。0037
 */
export function toHomeWidgetEntry(entry: HomeWidgetEntry): HomeWidgetEntry {
  return { key: entry.key };
}

/** 保存がまだ無いときの、既定の並び。カタログの登録順で、最初に置くものだけを拾う */
export function defaultHomeLayout(catalog: readonly HomeWidgetCatalogEntry[]): HomeWidgetEntry[] {
  return catalog.filter((w) => w.defaultPlaced).map((w) => ({ key: w.key }));
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
  const keys = new Set(catalog.map((w) => w.key));
  const seen = new Set<string>();
  const out: HomeWidgetEntry[] = [];
  for (const entry of saved) {
    if (!keys.has(entry.key) || seen.has(entry.key) || !isVisible(entry.key)) continue;
    seen.add(entry.key);
    out.push(toHomeWidgetEntry(entry));
  }
  if (!seen.has(HOME_CALENDAR_WIDGET_KEY) && keys.has(HOME_CALENDAR_WIDGET_KEY)) {
    out.unshift({ key: HOME_CALENDAR_WIDGET_KEY });
  }
  return out;
}

/**
 * 編集で直した「見えている並び」に、隠れていたウィジェット(無効な拡張のものなど)を戻して、保存する形を組み立てる。
 * 隠れていたものは、直す前に直後にあった見えるウィジェットの後ろに戻す。0029
 *
 * `isVisible` は、編集を始めたときの「見えるか」を 1 度だけ決めて呼び出し元が渡す。保存するまでの間に
 * 拡張の有効・無効が変わっても、ここでは変わらないものとして扱う。
 * `edited` に既にある key は、`previous` の側では隠れていたと判定されても戻さない(2 重に入るのを防ぐ)。
 * 返す並びは key だけを持つ。前に保存した大きさは落とす。0037
 *
 * @param previous 直す前に保存していた並び。隠れていたものも含む
 * @param edited 編集の画面で直した、見えるものだけの並び
 * @param isVisible 編集を始めたときに、その key が見えていたか(有効な拡張だったか)
 */
export function mergeHomeLayout(
  previous: readonly HomeWidgetEntry[],
  edited: readonly HomeWidgetEntry[],
  isVisible: (key: string) => boolean,
): HomeWidgetEntry[] {
  const editedKeys = new Set(edited.map((e) => e.key));
  const after = new Map<string | null, HomeWidgetEntry[]>();
  let anchor: string | null = null;
  for (const entry of previous) {
    if (isVisible(entry.key)) {
      anchor = entry.key;
      continue;
    }
    // 編集した並びに既にあるなら、隠れていたものとしては戻さない
    if (editedKeys.has(entry.key)) continue;
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
    if (!isVisible(entry.key) && !editedKeys.has(entry.key) && !placed.has(entry.key)) {
      out.push(entry);
      placed.add(entry.key);
    }
  }
  return out.map(toHomeWidgetEntry);
}

/**
 * 並びに同じ key が 2 つ無く、カレンダーの本体を含むか。
 * サーバーの入力の検証と、画面の保存の前の確かめに使う
 */
export function isValidHomeLayout(widgets: readonly HomeWidgetEntry[]): boolean {
  const keys = widgets.map((w) => w.key);
  return new Set(keys).size === keys.length && keys.includes(HOME_CALENDAR_WIDGET_KEY);
}
