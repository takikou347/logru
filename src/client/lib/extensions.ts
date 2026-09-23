/**
 * 画面の側で、いま使える拡張を決める。0019
 *
 * 切り替えられる拡張は、その人が使うと決めたときだけ使える。使うかどうかは、自分だけのグループの切り替えで持つ。
 * 共有のグループで有効でも、本人が使わないと決めていれば、入口も画面も出さない。いつも有効な拡張は、いつも使える。
 */

import { clientExtensions } from "@extensions/client/registry";
import type { ClientExtension } from "@extensions/client/types";
import type { GroupSummary } from "@shared/api-types";
import { useMemo } from "react";
import { useGroups, useMe } from "@/api/common";

/**
 * 使える拡張の key を返す。
 * @param extensions 画面の側の拡張
 * @param groups 入っているグループ
 */
export function enabledKeys(
  extensions: Pick<ClientExtension, "manifest">[],
  groups: Pick<GroupSummary, "extensions" | "isPersonal">[],
): Set<string> {
  const on = new Set(groups.filter((g) => g.isPersonal).flatMap((g) => g.extensions));
  return new Set(extensions.filter((x) => x.manifest.alwaysOn || on.has(x.manifest.key)).map((x) => x.manifest.key));
}

/** 使える拡張を、拡張の一覧の順で返す。グループを読むまでは、いつも有効な拡張だけ */
export function useEnabledExtensions(): ClientExtension[] {
  const groups = useGroups();
  return useMemo(() => {
    const keys = enabledKeys(clientExtensions, groups.data ?? []);
    return clientExtensions.filter((x) => keys.has(x.manifest.key));
  }, [groups.data]);
}

/**
 * いつも足された状態で出す拡張。足す・外すの対象にせず、機能のタイルの並びの先頭に固定で置く。0058
 * 設定の欄(SettingsSection)を持つ拡張だけをタイルにする。持たなければ、そもそも移る先が無い
 */
export function permanentExtensionTiles(): ClientExtension[] {
  return clientExtensions.filter((x) => x.SettingsSection && (x.manifest.alwaysOn || x.manifest.perUser));
}

/**
 * 保存した並びの中から、いまも足している key だけを残し、まだ並びに無い(新しく足した)key を
 * 拡張の一覧の順で末尾に足す。外した key は、保存した並びに残っていても消える。0058
 * @param savedOrder 保存してある並び
 * @param enabledKeysInRegistryOrder いま足している key。拡張の一覧の順
 */
export function orderedExtensionKeys(savedOrder: string[], enabledKeysInRegistryOrder: string[]): string[] {
  const enabled = new Set(enabledKeysInRegistryOrder);
  const kept = savedOrder.filter((k) => enabled.has(k));
  const known = new Set(kept);
  return [...kept, ...enabledKeysInRegistryOrder.filter((k) => !known.has(k))];
}

/** 保存した並びが空のときに useMemo へ渡す、いつも同じ配列。依存の配列が毎回新しくならないようにする */
const EMPTY_ORDER: string[] = [];

/**
 * 足した(切り替えられる)拡張を、保存した並びの順で返す。並べ替え、外すの対象になる。0058
 * いつも足された状態の拡張(permanentExtensionTiles)は含めない
 */
export function useOrderedEnabledExtensions(): ClientExtension[] {
  const groups = useGroups();
  const savedOrder = useMe().data?.settings.extensionOrder ?? EMPTY_ORDER;
  return useMemo(() => {
    const keys = enabledKeys(clientExtensions, groups.data ?? []);
    const removable = clientExtensions.filter((x) => keys.has(x.manifest.key) && !x.manifest.alwaysOn);
    const byKey = new Map(removable.map((x) => [x.manifest.key, x]));
    return orderedExtensionKeys(
      savedOrder,
      removable.map((x) => x.manifest.key),
    ).map((k) => byKey.get(k)!);
  }, [groups.data, savedOrder]);
}

/** まだ足していない(切り替えられる)拡張。「機能を足す」画面に並べる。0058 */
export function useAddableExtensions(): ClientExtension[] {
  const groups = useGroups();
  return useMemo(() => {
    const keys = enabledKeys(clientExtensions, groups.data ?? []);
    return clientExtensions.filter((x) => !x.manifest.alwaysOn && !keys.has(x.manifest.key));
  }, [groups.data]);
}

/**
 * 機能のタイルに出す短い字を拡張ごとに集める。hook なので、呼ぶ順を変えないよう拡張の一覧の順にいつも呼ぶ。
 * 使えない拡張の hook も enabled を false にして呼ぶ。0058
 */
export function useExtensionTileHints(): Record<string, string> {
  const enabled = useEnabledExtensions();
  const keys = new Set(enabled.map((x) => x.manifest.key));
  // biome-ignore lint/correctness/useHookAtTopLevel: clientExtensions の並びは起動時に固定なので、呼ぶ順は毎回同じ
  const hints = clientExtensions.map((x) => (x.useTileHint ? x.useTileHint(keys.has(x.manifest.key)) : null));
  const entries = clientExtensions.map((x, i) => [x.manifest.key, hints[i] ?? null] as const);
  return Object.fromEntries(entries.filter((h): h is [string, string] => h[1] !== null));
}

/**
 * 近道を 1 つ返す。先に登録した拡張のものが勝つ。F-26
 * hook の呼ぶ順を変えないよう、使えない拡張の hook も enabled を false にして呼ぶ。
 */
export function useShortcut() {
  const enabled = useEnabledExtensions();
  const keys = new Set(enabled.map((x) => x.manifest.key));
  // biome-ignore lint/correctness/useHookAtTopLevel: clientExtensions の並びは起動時に固定なので、呼ぶ順は毎回同じ
  const results = clientExtensions.map((x) => (x.useShortcut ? x.useShortcut(keys.has(x.manifest.key)) : null));
  return results.find((r) => r) ?? null;
}
