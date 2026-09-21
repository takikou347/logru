import { LEGAL_VERSIONS } from "../../shared/legal";
import type { DB } from "../db/client";
import { groupMembers, groups, legalAgreements, userSettings } from "../db/schema";

/**
 * 登録した人の土台を作る。設定、自分だけのグループ、同意の記録。
 * agreed が false のときは同意を記録しない。次のログインで同意の画面を出す。
 */
export async function setUpNewUser(db: DB, userId: string, agreed: boolean): Promise<void> {
  const groupId = crypto.randomUUID();
  const writes = [
    db.insert(userSettings).values({ userId }).onConflictDoNothing(),
    db.insert(groups).values({ id: groupId, name: "自分", color: "wakatake", isPersonal: true, createdBy: userId }),
    db.insert(groupMembers).values({ groupId, userId, role: "admin" }),
    ...(agreed
      ? (Object.entries(LEGAL_VERSIONS) as [keyof typeof LEGAL_VERSIONS, string][]).map(([document, version]) =>
          db.insert(legalAgreements).values({ userId, document, version }).onConflictDoNothing(),
        )
      : []),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
}
