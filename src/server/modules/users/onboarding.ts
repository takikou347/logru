import { eq } from "drizzle-orm";
import type { DB } from "../../core/db/client";
import { groupMembers, groups, userSettings, users } from "../../core/db/schema";
import type { FirebaseClaims } from "../../core/auth/verify-token";

/** D1 の users 表の 1 行 */
export type UserRow = typeof users.$inferSelect;

/**
 * トークンの利用者に当たる D1 の行を返す。無ければ作る。
 *
 * 初めての人には、設定の行と自分だけのグループも作る。0009
 * 規約への同意はここでは記録しない。画面が同意の画面を出す。
 * D1 は途中で止まれるトランザクションが無いので、batch で 1 回に書き込む。
 *
 * @param db D1 を包んだ Drizzle
 * @param claims 確かめた Firebase の ID トークンの中身
 */
export async function ensureUser(db: DB, claims: FirebaseClaims): Promise<UserRow> {
  const found = await db.select().from(users).where(eq(users.id, claims.uid)).get();
  if (found) {
    // メールアドレスとアイコンは Firebase の側が正しい。変わっていれば合わせる。表示名はこのアプリで直せるので触らない
    if (found.email !== claims.email || (claims.picture && found.image !== claims.picture)) {
      const patch = { email: claims.email, image: claims.picture ?? found.image, updatedAt: new Date() };
      await db.update(users).set(patch).where(eq(users.id, found.id));
      return { ...found, ...patch };
    }
    return found;
  }

  const name = claims.name?.trim() || claims.email.split("@")[0] || "名前なし";
  // 初めての要求が同時に 2 つ来ても、行を入れられた方だけがグループを作る
  const inserted = await db
    .insert(users)
    .values({ id: claims.uid, name, email: claims.email, image: claims.picture })
    .onConflictDoNothing()
    .returning()
    .get();
  if (!inserted) return (await db.select().from(users).where(eq(users.id, claims.uid)).get())!;

  const groupId = crypto.randomUUID();
  await db.batch([
    db.insert(userSettings).values({ userId: claims.uid }).onConflictDoNothing(),
    db.insert(groups).values({ id: groupId, name: "自分", color: "wakatake", isPersonal: true, createdBy: claims.uid }),
    db.insert(groupMembers).values({ groupId, userId: claims.uid, role: "admin" }),
  ]);
  return inserted;
}
