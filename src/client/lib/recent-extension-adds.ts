/**
 * 足した機能の key を短く覚える。機能のタイルが縮みながら並びへ入る動きを、並び替えや読み直しの
 * 描き直しと区別するため。読むと 1 度で覚えを消すので、動きは 1 回だけ再生される。0044、0048、0058
 * calendar/recent-items.ts と同じ仕組み。機能のタイルは複数の画面(FeatureSheet、設定)が描くため、
 * ここに置いて共通で使う
 */

/** 覚えておく長さ。invalidateQueries の読み直しが終わるまでの猶予 */
const RECENT_MS = 3000;

const recent = new Map<string, number>();

/** 「機能を足す」画面で、足すのに成功した直後に呼ぶ */
export function markExtensionJustAdded(key: string): void {
  recent.set(key, Date.now() + RECENT_MS);
}

/** タイルを描くときに呼ぶ。足した直後なら true を 1 度だけ返す */
export function takeExtensionJustAdded(key: string): boolean {
  const expires = recent.get(key);
  if (expires == null) return false;
  recent.delete(key);
  return Date.now() <= expires;
}
