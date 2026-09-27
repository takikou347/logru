/**
 * D1 は 1 つの問い合わせに渡せる値(バインドするパラメータ)の数が 100 個までという上限がある。
 * `inArray` に渡す ID などが増えると、この上限を超えて失敗する。これより十分小さい数ごとに
 * 分けて読む。予定(events)、思い出(memories)、家計簿(kakeibo)で使う。#199
 */
export const D1_CHUNK = 90;

/**
 * 配列を size 個ずつの配列に分ける。
 * @param items 分ける配列
 * @param size 1 つあたりの個数
 */
export function chunk<T>(items: T[], size: number = D1_CHUNK): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * ID などの配列を size 個ずつに分けて読み、結果をまとめて返す。1 つの `inArray` にしか使わない
 * (同じ配列を 2 つの `inArray` に OR で渡すときは、行が重なって返ることがあるので使わない)。
 * @param ids inArray などに渡す ID の一覧
 * @param read 1 回分(size 個まで)の ID を受け取り、その分の行を返す
 * @param size 1 回に渡す個数
 */
export async function readByChunk<T, R>(
  ids: T[],
  read: (part: T[]) => Promise<R[]>,
  size: number = D1_CHUNK,
): Promise<R[]> {
  const out: R[] = [];
  for (const part of chunk(ids, size)) out.push(...(await read(part)));
  return out;
}
