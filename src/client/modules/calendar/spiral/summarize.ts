/**
 * 年の日ごとに、点の色とひとコマの写真をまとめる。0051
 * カレンダーの項目から拡張の種類を見分けない。secondary と thumb だけを見る
 */
import { onDay } from "@/lib/dates";
import type { ViewItem } from "../model";

export type DaySummary = {
  date: Date;
  /** その日の点の色の名前。予定が無ければ null */
  color: string | null;
  /** その日のひとコマの小さな写真。data URL。無ければ null */
  thumb: string | null;
};

/**
 * @param days その年の日の一覧
 * @param items 年の期間で読んだカレンダーの項目
 */
export function summarizeDays(days: Date[], items: ViewItem[]): DaySummary[] {
  return days.map((date) => {
    const onThisDay = items.filter((i) => onDay(i, date));
    const colorItem = onThisDay.find((i) => !i.secondary);
    const thumbItem = onThisDay.find((i) => i.thumb);
    return { date, color: colorItem?.color ?? null, thumb: thumbItem?.thumb ?? null };
  });
}
