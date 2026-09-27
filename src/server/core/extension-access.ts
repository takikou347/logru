/**
 * 拡張ごとに、呼んでよいグループを決める。0002 の 5 つ目の約束(グループごとに有効・無効)を守る。
 * カレンダー(0008)と検索(0046)が同じ形で使う。
 *
 * DB を読まない純粋な計算だけをここに置く。D1 への問い合わせは呼び出し側(calendar、search の routes.ts)が行う。
 */
import type { ExtensionManifest } from "@extensions/types";

/** group_extensions の 1 行のうち、この計算で使う列だけ */
export type EnabledExtensionRow = { groupId: string; extensionKey: string };

/**
 * @param manifests 呼び出し得る拡張の manifest。並びは返す Map の並びに影響しない
 * @param groupIds 利用者が入っていて、呼んでよいグループ
 * @param personalGroupId 利用者の自分だけのグループの ID。groupIds に含まれないなら渡さなくてよい
 * @param enabledExtensions 有効にした拡張。グループと拡張の key の組
 * @returns 拡張の key ごとに、その拡張へ渡してよいグループの ID
 */
export function resolveExtensionGroupIds(
  manifests: Pick<ExtensionManifest, "key" | "alwaysOn">[],
  groupIds: string[],
  personalGroupId: string | undefined,
  enabledExtensions: EnabledExtensionRow[],
): Map<string, string[]> {
  // 自分だけのグループで使うと決めた拡張。切り替えられる拡張を自分だけのグループでも呼ぶかの分かれ目
  const used = new Set(enabledExtensions.filter((r) => r.groupId === personalGroupId).map((r) => r.extensionKey));
  const map = new Map<string, string[]>();
  for (const m of manifests) {
    const ids = m.alwaysOn
      ? groupIds
      : used.has(m.key)
        ? groupIds.filter(
            (g) => g === personalGroupId || enabledExtensions.some((r) => r.groupId === g && r.extensionKey === m.key),
          )
        : [];
    map.set(m.key, ids);
  }
  return map;
}
