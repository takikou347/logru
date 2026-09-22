/** お知らせの一覧を 25 件ずつのページに切る。カーソルは、いちばん古い行の created_at。#32 */

/** 1 ページの件数 */
export const NOTIFICATIONS_PAGE_SIZE = 25;

type Row = { createdAt: Date };

/**
 * 1 ページ分を切り出す。呼ぶ側は pageSize + 1 件を created_at の新しい順に渡す。
 * 余った 1 件があれば、次のページがあるということなので、切り捨てて次のカーソルを作る。
 */
export function buildPage<T extends Row>(
  rows: T[],
  pageSize: number = NOTIFICATIONS_PAGE_SIZE,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? String(last.createdAt.getTime()) : null };
}
