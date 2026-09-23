/**
 * 足した予定の id を短く覚える。チップが膨らんで入る動きを、月を移る・日を選び直すときの
 * 描き直しと区別するため。読むと 1 度で覚えを消すので、動きは 1 回だけ再生される。0044、0048、#98
 */

/** 覚えておく長さ。invalidateQueries の読み直しが終わるまでの猶予 */
const RECENT_MS = 3000;

const recent = new Map<string, number>();

/** 足した(元に戻した)直後に呼ぶ。key は use-undoable-delete の itemKey */
export function markJustAdded(key: string): void {
  recent.set(key, Date.now() + RECENT_MS);
}

/** 一覧の項目を描くときに呼ぶ。足した直後なら true を 1 度だけ返す */
export function takeJustAdded(key: string): boolean {
  const expires = recent.get(key);
  if (expires == null) return false;
  recent.delete(key);
  return Date.now() <= expires;
}
