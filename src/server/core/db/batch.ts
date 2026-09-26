import type { DB } from "./client";

/** db.batch に渡す 1 件分の文の型 */
type BatchQuery = Parameters<DB["batch"]>[0][number];

/**
 * db.batch を呼ぶ。#205
 *
 * `...(cond ? [x] : [])` のように、実行するかを実行時に決めて組み立てた配列は、
 * 中身が 1 件以上でも TypeScript には「長さの分からない配列」としか伝わらず、
 * db.batch がそのままでは受け取らない。その食い違いを、呼び出しごとに書かず、ここへ集める。
 * @param queries 実行時には 1 件以上のはずの、まとめて実行する文
 */
export function runBatch(db: DB, queries: BatchQuery[]) {
  return db.batch(queries as unknown as Parameters<DB["batch"]>[0]);
}
