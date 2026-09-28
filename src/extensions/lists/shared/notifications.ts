/**
 * 共有リストの拡張が積むお知らせの、文言と行き先。0096、issue #247
 * ここは画面とサーバーの両方の tsconfig が読むので、client/types.ts の型は import しない。
 */

/** 積み重ねた件数。無ければ 1 件 */
function countOf(payload: Record<string, unknown>): number {
  return typeof payload.count === "number" && payload.count > 0 ? payload.count : 1;
}

/**
 * チェックした後の項目の一覧が、全部済みかどうか。1 件も無ければ false(まだ何も無いリストを
 * 全部済みとは言わない)。0096、issue #247
 */
export function allItemsChecked(items: { checked: boolean }[]): boolean {
  return items.length > 0 && items.every((i) => i.checked);
}

/**
 * お知らせの kind と payload から、一覧の文言と押したときの行き先を作る。自分の拡張の kind でなければ null。
 *
 * - lists.item_added: 項目が足された。まとめると件数を出す。押すとそのリスト
 * - lists.item_checked: 項目が済みになった。まとめると件数を出す。押すとそのリスト
 * - lists.all_checked: 項目が全部済みになった。押すとそのリスト
 */
export function describeListsNotification(
  kind: string,
  payload: Record<string, unknown>,
): { text: string; path: string } | null {
  const listId = typeof payload.listId === "string" ? payload.listId : "";
  const title = typeof payload.title === "string" && payload.title ? payload.title : "リスト";
  const byUserName = typeof payload.byUserName === "string" ? payload.byUserName : "";
  const path = `/lists/${listId}`;
  if (kind === "lists.item_added") {
    const n = countOf(payload);
    const text =
      n > 1
        ? `${byUserName ? `${byUserName}が` : ""}「${title}」に ${n} 件足しました。`
        : `${byUserName ? `${byUserName}が` : ""}「${title}」に足しました。`;
    return { text, path };
  }
  if (kind === "lists.item_checked") {
    const n = countOf(payload);
    const text = n > 1 ? `「${title}」で ${n} 件、済みになりました。` : `「${title}」で 1 件、済みになりました。`;
    return { text, path };
  }
  if (kind === "lists.all_checked") {
    return { text: `「${title}」の項目が、全部済みになりました。`, path };
  }
  return null;
}
