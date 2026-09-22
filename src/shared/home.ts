/**
 * ホーム画面のウィジェットの並びを組み立てる、純粋な関数。画面とサーバーの両方が使う。0029
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
 * 隠れていたものは、直す前に直後にあった見えるウィジェットの後ろに戻す。0029
 *
 * `isVisible` は、編集を始めたときの「見えるか」を 1 度だけ決めて呼び出し元が渡す。保存するまでの間に
 * 拡張の有効・無効が変わっても、ここでは変わらないものとして扱う。
 * `edited` に既にある key は、`previous` の側では隠れていたと判定されても戻さない(2 重に入るのを防ぐ)。
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
  return out;
}

/**
 * 大きさを選べる key の一覧。載っていない key は 3 つとも選べる。
 * ウィジェットの本当の sizes は画面の側の拡張(React の部品)が持ち、サーバーは読み込めないので、
 * 検証に要る分だけここに複製する。ウィジェットの sizes を変えたら、ここも合わせる
 */
export const HOME_WIDGET_SIZE_LIMITS: Readonly<Record<string, readonly HomeWidgetSize[]>> = {
  "memories.shortcut": ["small", "medium"],
};

/** その key で、その大きさを選べるか */
function isSizeAllowed(key: string, size: HomeWidgetSize): boolean {
  const allowed = HOME_WIDGET_SIZE_LIMITS[key];
  return !allowed || allowed.includes(size);
}

/**
 * 並びに同じ key が 2 つ無く、カレンダーの本体を含み、それぞれの大きさがその key で選べるものか。
 * サーバーの入力の検証と、画面の保存の前の確かめに使う
 */
export function isValidHomeLayout(widgets: readonly HomeWidgetEntry[]): boolean {
  const keys = widgets.map((w) => w.key);
  return (
    new Set(keys).size === keys.length &&
    keys.includes(HOME_CALENDAR_WIDGET_KEY) &&
    widgets.every((w) => isSizeAllowed(w.key, w.size))
  );
}
