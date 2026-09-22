/**
 * 画面の側で、いま使える拡張を決める。0019
 *
 * 切り替えられる拡張は、その人が使うと決めたときだけ使える。使うかどうかは、自分だけのグループの切り替えで持つ。
 * 共有のグループで有効でも、本人が使わないと決めていれば、入口も画面も出さない。いつも有効な拡張は、いつも使える。
 */
import { useMemo } from "react";
import type { GroupSummary } from "../../shared/api-types";
import { clientExtensions } from "../../extensions/registry.client";
import type { ClientExtension } from "../../extensions/types.client";
import { useGroups } from "./queries";

/**
 * 使える拡張の key を返す。
 * @param extensions 画面の側の拡張
 * @param groups 入っているグループ
 */
export function enabledKeys(extensions: Pick<ClientExtension, "manifest">[], groups: Pick<GroupSummary, "extensions" | "isPersonal">[]): Set<string> {
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
 * 近道を 1 つ返す。先に登録した拡張のものが勝つ。F-26
 * hook の呼ぶ順を変えないよう、使えない拡張の hook も enabled を false にして呼ぶ。
 */
export function useShortcut() {
  const enabled = useEnabledExtensions();
  const keys = new Set(enabled.map((x) => x.manifest.key));
  const results = clientExtensions.map((x) => (x.useShortcut ? x.useShortcut(keys.has(x.manifest.key)) : null));
  return results.find((r) => r) ?? null;
}
