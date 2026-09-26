/**
 * 1 年をらせんで見る画面が使う、日付の計算。0051
 * 端末の時間帯で 1 月 1 日から 12 月 31 日までを数える。ほかのカレンダーの画面と同じ。
 */
import { addDays, DAY_MS, startOfDay } from "@/lib/dates";

/** `GET /api/calendar` に 1 回で渡せる期間の上限。src/shared/schemas.ts の MAX_RANGE_MS より少し余裕を持たせる */
const CHUNK_DAYS = 90;

/**
 * その年の、日曜始まりではない 1 月 1 日から 12 月 31 日までを並べる。
 * @param year 西暦
 */
export function daysInYear(year: number): Date[] {
  const start = startOfDay(new Date(year, 0, 1));
  const end = startOfDay(new Date(year + 1, 0, 1));
  const days: Date[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  return days;
}

/** 期間。from を含み to を含まない、ミリ秒の UTC */
export type Range = { from: number; to: number };

/**
 * 1 年を `GET /api/calendar` の上限に収まる期間に分ける。
 * @param year 西暦
 * @param chunkDays 1 回に読む日数。既定は 90
 */
export function yearChunks(year: number, chunkDays = CHUNK_DAYS): Range[] {
  const start = startOfDay(new Date(year, 0, 1)).getTime();
  const end = startOfDay(new Date(year + 1, 0, 1)).getTime();
  const span = chunkDays * DAY_MS;
  const chunks: Range[] = [];
  for (let from = start; from < end; from += span) {
    chunks.push({ from, to: Math.min(from + span, end) });
  }
  return chunks;
}
