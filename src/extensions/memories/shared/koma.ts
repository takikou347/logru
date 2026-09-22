/**
 * ひとコマの枠の決まり。0022
 * 7 時台から 22 時台まで、1 日 16 枠。その枠の 1 時間と、過ぎてから 5 分だけ残せる。
 */
import { dayKeyIn, hourIn } from "./days";

export const KOMA_FIRST_HOUR = 7;
export const KOMA_LAST_HOUR = 22;
/** 枠が過ぎてから残せる時間。5 分 */
export const KOMA_GRACE_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** 枠 1 つ。start は枠の始まりの時刻 */
export type KomaSlot = { start: number; hour: number; day: string };

/**
 * その時刻を含む 1 時間の始まり。時間帯の分と秒で詰めるので、30 分ずれた時間帯でも合う。
 * @param ms ミリ秒の UTC
 * @param timeZone 時間帯
 */
export function hourStartIn(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, minute: "2-digit", second: "2-digit" }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return ms - get("minute") * 60_000 - get("second") * 1000 - (ms % 1000);
}

/** その時刻の枠。7 時台から 22 時台の外なら null */
export function slotAt(ms: number, timeZone: string): KomaSlot | null {
  const hour = hourIn(ms, timeZone);
  if (hour < KOMA_FIRST_HOUR || hour > KOMA_LAST_HOUR) return null;
  return { start: hourStartIn(ms, timeZone), hour, day: dayKeyIn(ms, timeZone) };
}

/**
 * いま残せる枠。いまの枠と、過ぎてから 5 分以内の前の枠。
 * @param now いまの時刻
 * @param timeZone 時間帯
 */
export function openSlots(now: number, timeZone: string): KomaSlot[] {
  const out: KomaSlot[] = [];
  const current = slotAt(now, timeZone);
  if (current) out.push(current);
  const prev = slotAt(hourStartIn(now, timeZone) - 1, timeZone);
  if (prev && now - (prev.start + HOUR_MS) < KOMA_GRACE_MS && now >= prev.start + HOUR_MS) out.push(prev);
  return out;
}

/** その日の枠の始まりの時刻を 16 個並べる。確認画面と 1 日の面の目盛りに使う */
export function slotsOfDay(dayStart: number, timeZone: string): KomaSlot[] {
  const out: KomaSlot[] = [];
  for (let t = dayStart; t < dayStart + 26 * HOUR_MS; t += HOUR_MS) {
    const s = slotAt(t, timeZone);
    if (s && s.day === dayKeyIn(dayStart, timeZone) && !out.some((x) => x.hour === s.hour))
      out.push({ ...s, start: hourStartIn(t, timeZone) });
  }
  return out;
}
