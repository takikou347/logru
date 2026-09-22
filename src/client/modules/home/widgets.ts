/**
 * ホームに置けるウィジェットの一覧。土台のウィジェットと、拡張が widgets に登録したものをまとめる。
 * 並びは、土台が先頭、そのあと拡張の登録順(registry.ts の並び)、拡張の中では widgets 配列の順。0029
 */
import { clientExtensions } from "@extensions/client/registry";
import type { HomeWidget } from "@extensions/client/types";
import { baseHomeWidgets } from "./BaseWidgets";

/** ホームに置けるすべてのウィジェット。有効かどうかは見ない静的な一覧 */
export const HOME_WIDGET_CATALOG: HomeWidget[] = [
  ...baseHomeWidgets,
  ...clientExtensions.flatMap((x) => x.widgets ?? []),
];

/** key からウィジェットを引く */
export function homeWidget(key: string): HomeWidget | undefined {
  return HOME_WIDGET_CATALOG.find((w) => w.key === key);
}

/**
 * ウィジェットの持ち主の拡張の key。土台のウィジェットは null。
 * 一覧に無い key は undefined(拡張を消したなどで、いまは存在しない)
 */
export function homeWidgetOwner(key: string): string | null | undefined {
  if (baseHomeWidgets.some((w) => w.key === key)) return null;
  for (const x of clientExtensions) {
    if ((x.widgets ?? []).some((w) => w.key === key)) return x.manifest.key;
  }
  return undefined;
}
