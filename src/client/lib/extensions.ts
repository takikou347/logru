/**
 * 画面の側で、いま使える拡張を決める。0019
 *
 * 切り替えられる拡張は、その人が使うと決めたときだけ使える。使うかどうかは、自分だけのグループの切り替えで持つ。
 * 共有のグループで有効でも、本人が使わないと決めていれば、入口も画面も出さない。いつも有効な拡張は、いつも使える。
 */

import { clientExtensions, defaultExtension } from "@extensions/client/registry";
import type { ClientExtension, DayItem, ExtensionAction, FavoriteAdd } from "@extensions/client/types";
import type { GroupSummary } from "@shared/api-types";
import { useMemo } from "react";
import { useGroups, useMe } from "@/api/common";
import { clampSummary, defaultTodaySummary } from "./today-sections";

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

/**
 * 下のタブの帯の「+」の放射に出す、記録の種類。足している拡張の actions を、拡張の一覧の順に
 * すべて集める。0 個なら決定 0086 と同じ扱い(呼び出し側が出さない)。0091、issue #239
 */
export function useQuickAdds(): ExtensionAction[] {
  const enabled = useEnabledExtensions();
  return useMemo(() => enabled.flatMap((x) => x.actions ?? []), [enabled]);
}

/**
 * 「+」の放射の上に出す、よく使う記録。いまは家計簿だけが返す。
 * hook の呼ぶ順を変えないよう、useShortcut と同じ形で、使えない拡張の hook も enabled を false にして呼ぶ。0091、issue #239
 */
export function useFavoriteAdds(): FavoriteAdd[] {
  const enabled = useEnabledExtensions();
  const keys = new Set(enabled.map((x) => x.manifest.key));
  // biome-ignore lint/correctness/useHookAtTopLevel: clientExtensions の並びは起動時に固定なので、呼ぶ順は毎回同じ
  const results = clientExtensions.map((x) => (x.useFavoriteAdds ? x.useFavoriteAdds(keys.has(x.manifest.key)) : null));
  return results.flatMap((r) => r ?? []);
}

/**
 * 今日のページに節を持つ、使える拡張。拡張の一覧の順。0092、issue #240
 *
 * 今のホームウィジェットと同じ考えで、widgets を持つ拡張(家計簿・共有リスト・思い出)と、
 * 節の中身を自分で決める拡張(today)を対象にする。予定(events)は widgets も today も持たないが、
 * カレンダーの土台として、今のホームの土台のウィジェット(baseHomeWidgets)と同じ扱いで、
 * いつも先頭の節にする。defaultExtension(いつも有効で、拡張の一覧の先頭)がそれに当たる。
 */
export function useTodaySections(): ClientExtension[] {
  const enabled = useEnabledExtensions();
  return useMemo(
    () =>
      enabled.filter(
        (x) => x.manifest.key === defaultExtension.manifest.key || !!x.today || (x.widgets?.length ?? 0) > 0,
      ),
    [enabled],
  );
}

/** 今日のページの「見出し」に選べる拡張。useHeadline を持つ、使える拡張。0092、issue #240 */
export function useHeadlineCandidates(): ClientExtension[] {
  const enabled = useEnabledExtensions();
  return useMemo(() => enabled.filter((x) => !!x.useHeadline), [enabled]);
}

/**
 * 今日のページの見出しの 1 行。設定の「機能」の「見出し」で選んだ拡張の useHeadline を呼ぶ。
 * 選んでいない、その拡張をいま使っていない、hook が null を返すときは出さない。
 * hook の呼ぶ順を変えないよう、使えない拡張の hook も enabled を false にして呼ぶ。0092、issue #240
 * @param itemsForDate 見せている日の、すべての拡張のカレンダー項目
 */
export function useHeadlineText(headlineExtension: string | null, date: Date, itemsForDate: DayItem[]): string | null {
  const enabled = useEnabledExtensions();
  const keys = new Set(enabled.map((x) => x.manifest.key));
  const results = clientExtensions.map((x) => {
    const own = itemsForDate.filter((i) => i.extension === x.manifest.key);
    // biome-ignore lint/correctness/useHookAtTopLevel: clientExtensions の並びは起動時に固定なので、呼ぶ順は毎回同じ
    return x.useHeadline ? x.useHeadline(keys.has(x.manifest.key), date, own) : null;
  });
  const index = clientExtensions.findIndex((x) => x.manifest.key === headlineExtension);
  return index >= 0 ? (results[index] ?? null) : null;
}

/**
 * 今日のページで、節を畳んだときの要約を、節ごとに集める。拡張の useTodaySummary があれば使い、
 * 無ければその日の項目の件数(defaultTodaySummary)を使う。どちらも 7 文字ほどに切る(clampSummary)。
 * hook の呼ぶ順を変えないよう、使えない拡張の hook も enabled を false にして呼ぶ。0092、issue #240
 * @param sections useTodaySections で決めた、節を持つ拡張
 * @param itemsForDate 見せている日の、すべての拡張のカレンダー項目
 */
export function useTodaySummaries(
  sections: ClientExtension[],
  date: Date,
  itemsForDate: DayItem[],
): Record<string, string> {
  const enabled = useEnabledExtensions();
  const keys = new Set(enabled.map((x) => x.manifest.key));
  const customs = clientExtensions.map((x) => {
    const own = itemsForDate.filter((i) => i.extension === x.manifest.key);
    // biome-ignore lint/correctness/useHookAtTopLevel: clientExtensions の並びは起動時に固定なので、呼ぶ順は毎回同じ
    return x.useTodaySummary ? x.useTodaySummary(keys.has(x.manifest.key), date, own) : null;
  });
  return Object.fromEntries(
    sections.map((x) => {
      const idx = clientExtensions.indexOf(x);
      const own = itemsForDate.filter((i) => i.extension === x.manifest.key);
      const custom = idx >= 0 ? customs[idx] : null;
      return [x.manifest.key, clampSummary(custom ?? defaultTodaySummary(own.length))];
    }),
  );
}
