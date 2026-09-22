import { and, eq, inArray } from "drizzle-orm";
import type { ExtensionOverview } from "../../../shared/api-types";
import { toggleableExtensions } from "../../../extensions/registry.server";
import { createRouter } from "../../core/app";
import { requireAgreement, requireUser } from "../../core/auth/middleware";
import { groupExtensions, groupMembers, groups } from "../../core/db/schema";

/**
 * `/api/extensions`。機能の一覧。F-24、0019
 *
 * 切り替えられる拡張ごとに、自分だけのグループで有効か、どの共有のグループで使っているかを返す。
 * 切り替えそのものは、グループの拡張の API で行う。自分だけのグループは本人が管理者なので、同じ API で切り替えられる。
 */
export const extensionRoutes = createRouter()
  .use("*", requireUser, requireAgreement)
  .get("/", async (c) => {
    const db = c.get("db");
    const mine = await db
      .select({ id: groups.id, name: groups.name, isPersonal: groups.isPersonal })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, c.get("user").id));
    const enabled = mine.length
      ? await db
          .select({ groupId: groupExtensions.groupId, key: groupExtensions.extensionKey })
          .from(groupExtensions)
          .where(
            and(
              inArray(
                groupExtensions.groupId,
                mine.map((g) => g.id),
              ),
              eq(groupExtensions.enabled, true),
            ),
          )
      : [];
    const personal = mine.find((g) => g.isPersonal);
    const shared = mine.filter((g) => !g.isPersonal).sort((a, b) => a.name.localeCompare(b.name, "ja"));
    const on = (groupId: string, key: string) => enabled.some((e) => e.groupId === groupId && e.key === key);
    const list: ExtensionOverview[] = toggleableExtensions().map(({ manifest }) => ({
      key: manifest.key,
      label: manifest.label,
      description: manifest.description,
      personal: personal ? on(personal.id, manifest.key) : false,
      groups: shared.filter((g) => on(g.id, manifest.key)).map((g) => ({ id: g.id, name: g.name })),
    }));
    return c.json({ extensions: list, personalGroupId: personal?.id ?? null });
  });
