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

/** 拡張の名前。登録に無ければ key をそのまま使う */
export function extensionLabel(key: string): string {
  return clientExtensions.find((x) => x.manifest.key === key)?.manifest.label ?? key;
}

/**
 * 絞り込みの帯の「種類」と、選んだ日の一覧の見出しに出す、拡張ごとの並び。0056
 *
 * 種類は拡張ごとに分ける。名前とアイコンは、この拡張の登録(manifest の名前と、icon か nav.icon)から取る。
 * 予定の拡張を先頭にし、残りは clientExtensions の登録の順のまま。カレンダー本体は拡張の中身を知らない。0001、0002
 */
export function extensionGroups(): { key: string; label: string; icon: LucideIcon }[] {
  return clientExtensions.map((x) => ({
    key: x.manifest.key,
    label: x.manifest.label,
    icon: extensionIcon(x.manifest.key),
  }));
}

/** カードの色味。key から決まるので、同じ拡張はいつも同じ色になる */
export function extensionTileColor(key: string): GroupColor {
  const sum = [...key].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return GROUP_COLOR_KEYS[sum % GROUP_COLOR_KEYS.length]!;
}
