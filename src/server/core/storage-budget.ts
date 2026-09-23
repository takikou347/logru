/**
 * 写真とアバターの合計に上限を置く。R2 の無料枠は 10 GB で、超えると請求が出る。0066、#162
 *
 * 合計は D1 の bytes の列から足し算で測る。R2 に聞かない。R2 の一覧は数が増えると遅く、
 * 無料枠にも入っていない ClassB の操作を余分に使うため。
 */
import { totalExtensionStorageBytes } from "@extensions/server/registry";
import { HttpError } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import { userSettings } from "@server/core/db/schema";
import { sql } from "drizzle-orm";

/** 写真とアバターの合計の上限。R2 の無料枠 10 GB の 8 割。0066 */
export const STORAGE_BUDGET_BYTES = 8 * 1024 * 1024 * 1024;

/** アバターの合計バイト数。userSettings.avatar_bytes の列だけで測る */
async function totalAvatarBytes(db: DB): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${userSettings.avatarBytes}), 0)` })
    .from(userSettings)
    .get();
  return row?.total ?? 0;
}

/** いま置いている写真とアバターの合計バイト数 */
async function totalStorageBytes(db: DB): Promise<number> {
  const [avatarBytes, extensionBytes] = await Promise.all([totalAvatarBytes(db), totalExtensionStorageBytes(db)]);
  return avatarBytes + extensionBytes;
}

/** いまの合計に、これから足す分を入れると上限を超えるか。D1 を読まない、確かめるだけの形にしてテストしやすくする */
export function exceedsStorageBudget(currentTotal: number, incomingBytes: number): boolean {
  return currentTotal + incomingBytes > STORAGE_BUDGET_BYTES;
}

/**
 * これから足す分を入れても上限を超えないかを確かめる。超えるなら 409 を投げる。
 * 失敗のときの文言は、決定 0025 の「保存できなかった」の形にそのまま乗る。
 * @param db D1 を包んだ Drizzle
 * @param incomingBytes これから R2 に置こうとしているバイト数
 */
export async function assertStorageBudget(db: DB, incomingBytes: number): Promise<void> {
  const total = await totalStorageBytes(db);
  if (exceedsStorageBudget(total, incomingBytes)) throw new HttpError(409, "いまは写真を足せません。");
}
