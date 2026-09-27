import type { GroupSummary } from "@shared/api-types";

/**
 * 新しく足すときに選ぶ既定のグループ。0063、F-40
 *
 * 1. 画面で絞っている、渡された既定のグループ
 * 2. いつもの共有先。ただし、その拡張を足していないグループなら使わない(alwaysOn の拡張はいつも使える)
 * 3. 共有しない(自分だけのグループ)
 *
 * @param groups 選べるグループ。自分だけのグループを含む
 * @param explicitGroupId 画面が絞っている、または渡してきた既定のグループ。無ければ 2 以降を見る
 * @param usual いつもの共有先と、対象の拡張の情報
 */
export function defaultShareGroupId(
  groups: Pick<GroupSummary, "id" | "isPersonal" | "extensions">[],
  explicitGroupId: string | null | undefined,
  usual: { groupId: string | null | undefined; extensionKey: string; alwaysOn: boolean },
): string {
  if (explicitGroupId && groups.some((g) => g.id === explicitGroupId)) return explicitGroupId;
  const usualGroup = usual.groupId ? groups.find((g) => g.id === usual.groupId) : undefined;
  if (usualGroup && (usual.alwaysOn || usualGroup.extensions.includes(usual.extensionKey))) return usualGroup.id;
  return groups.find((g) => g.isPersonal)?.id ?? groups[0]?.id ?? "";
}
