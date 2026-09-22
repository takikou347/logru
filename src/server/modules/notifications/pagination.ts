/**
 * お知らせの一覧を 25 件ずつのページに切る。カーソルは `(created_at, id)` の組。#32
 *
 * created_at だけを境にすると、同じミリ秒に複数件が入ったとき、ページの境をまたいだ 1 件が抜けることがある。
 * id も一緒に境にし、並びも `(created_at, id)` の 2 つにする。
 */

/** 1 ページの件数 */
export const NOTIFICATIONS_PAGE_SIZE = 25;

type Row = { id: string; createdAt: Date };

/** カーソルの形。数字と id の間を `_` で区切る */
const CURSOR_RE = /^(\d+)_(.+)$/;

/** 行からカーソルの文字列を作る */
export function encodeCursor(row: Row): string {
  return `${row.createdAt.getTime()}_${row.id}`;
}

/**
 * カーソルの文字列を読む。壊れた形なら null を返す。呼ぶ側は 400 にする
 */
export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const m = CURSOR_RE.exec(cursor);
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms)) return null;
  return { createdAt: new Date(ms), id: m[2]! };
}

/**
 * 1 ページ分を切り出す。呼ぶ側は pageSize + 1 件を `(created_at, id)` の新しい順に渡す。
 * 余った 1 件があれば、次のページがあるということなので、切り捨てて次のカーソルを作る。
 */
export function buildPage<T extends Row>(
  rows: T[],
  pageSize: number = NOTIFICATIONS_PAGE_SIZE,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
}
