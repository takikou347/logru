/**
 * 種類の印に使うアイコン。0056
 *
 * 項目の形は、まず item.icon を見る。1 つの拡張の中でさらに種類を分けたいとき(思い出、ひとコマ、記録)に使う名前で、
 * 拡張はこの中から選ぶ。item.icon が無ければ、項目を出した拡張が登録したアイコンを使う。
 * カレンダー本体はどの拡張がどの名前を使うかを知らない。0001、0002
 */
import { Camera, type LucideIcon, Timer } from "lucide-react";
import { extensionIcon } from "@/lib/extension-visuals";

/** item.icon に使える名前と、対応するアイコン */
const ITEM_ICONS: Record<string, LucideIcon> = { camera: Camera, timer: Timer };

/**
 * 項目の形に使うアイコン。予定(kind が無い項目)は色の点のままなので呼ばない。
 * @param item 出す項目
 */
export function kindIconOf(item: { extension: string; icon?: string }): LucideIcon {
  if (item.icon && ITEM_ICONS[item.icon]) return ITEM_ICONS[item.icon]!;
  return extensionIcon(item.extension);
}
