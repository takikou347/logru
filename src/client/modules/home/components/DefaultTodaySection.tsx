/**
 * 今日のページの、既定の節の中身。ext.today を持たない拡張(予定・家計簿・思い出)が使う。0092、issue #240
 *
 * その日のカレンダー項目を、月・週の表と同じ行(ItemRows)でそのまま出す。予定・家計簿・思い出は
 * 日ごとのカレンダー項目をすでに持つので、新しい API は要らない。
 */
import { defaultExtension } from "@extensions/client/registry";
import type { ClientExtension } from "@extensions/client/types";
import { ItemRows } from "@/modules/calendar/components/DayItems";
import type { ViewItem } from "@/modules/calendar/model";

/** その日に項目が無いときの文。予定は「予定はありません。」で固定。ほかは今日か・過去か・未来かで変える */
function emptyMessage(ext: ClientExtension, isToday: boolean, isFuture: boolean): string {
  if (ext.manifest.key === defaultExtension.manifest.key) return "予定はありません。";
  if (isToday) return `${ext.manifest.label}の記録はまだありません。`;
  return isFuture ? "この日になったら記録できます。" : "この日の記録はまだありません。";
}

export function DefaultTodaySection({
  ext,
  isToday,
  isFuture,
  items,
  leaving,
  onOpen,
}: {
  ext: ClientExtension;
  isToday: boolean;
  isFuture: boolean;
  items: ViewItem[];
  /** 消した直後、縮んで消える動きの途中にある項目の itemKey。0044、0048、#98 */
  leaving?: Set<string>;
  onOpen: (item: ViewItem) => void;
}) {
  if (items.length === 0) {
    return <p className="py-1 text-[13px] leading-relaxed text-ink-2">{emptyMessage(ext, isToday, isFuture)}</p>;
  }
  return <ItemRows items={items} onOpen={onOpen} leaving={leaving} />;
}
