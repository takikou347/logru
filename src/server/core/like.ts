import { type Column, type SQL, sql } from "drizzle-orm";

/**
 * `%` と `_` はワイルドカードなので、検索文字列に含まれていたら `\` を前置いて逃がす。
 * `\` 自身も先に逃がす。#199、#277
 */
export function escapeLike(query: string): string {
  return query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/**
 * 列が検索文字列を含む、という LIKE の条件。ワイルドカードは逃がし、ESCAPE を付ける。
 * @param column 探す列
 * @param query 探す文字列
 */
export function likeContains(column: Column, query: string): SQL {
  return sql`${column} like ${`%${escapeLike(query)}%`} escape '\\'`;
}
