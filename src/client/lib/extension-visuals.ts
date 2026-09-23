/**
 * 拡張の見た目を、登録した icon と nav.icon から自動に決める。issue #102
 *
 * 拡張は manifest と、画面の側の icon か nav.icon だけ登録すれば、設定の「機能」のカードが自動で出る。
 * カレンダーは、予定ではない項目の形の印(0056)にも、同じアイコンを既定として使う。
 * 見本の画像を持たない拡張のための色味も、ここで自動に決める。
 */
import { clientExtensions } from "@extensions/client/registry";
import { GROUP_COLOR_KEYS, type GroupColor } from "@shared/colors";
import type { LucideIcon } from "lucide-react";
import { Puzzle } from "lucide-react";

/** 拡張のアイコン。拡張の icon、無ければ nav.icon、どちらも無ければ既定のアイコン */
export function extensionIcon(key: string): LucideIcon {
  const ext = clientExtensions.find((x) => x.manifest.key === key);
  return ext?.icon ?? ext?.nav?.icon ?? Puzzle;
}

/** カードの色味。key から決まるので、同じ拡張はいつも同じ色になる */
export function extensionTileColor(key: string): GroupColor {
  const sum = [...key].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return GROUP_COLOR_KEYS[sum % GROUP_COLOR_KEYS.length]!;
}
