import holidayJp from "@holiday-jp/holiday_jp";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 日曜始まりで、その月を含む週をすべて並べる。5 週か 6 週になる */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function weekDays(d: Date): Date[] {
  const start = addDays(startOfDay(d), -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function holidayName(d: Date): string | null {
  const table = holidayJp.holidays as Record<string, { name: string } | undefined>;
  return table[dateKey(d)]?.name ?? null;
}

/** 日曜と祝日は朱、土曜は瑠璃にする */
export function dayTone(d: Date): "sun" | "sat" | null {
  if (d.getDay() === 0 || holidayName(d)) return "sun";
  if (d.getDay() === 6) return "sat";
  return null;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDay(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}曜`;
}

export function toTimeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function withTime(day: Date, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 0, m ?? 0).getTime();
}

type Span = { startsAt: number; endsAt: number | null; allDay: boolean };

/** 項目がその日にかかるか。終わりが無いものは始まりの日だけ */
export function onDay(item: Span, day: Date): boolean {
  const from = startOfDay(day).getTime();
  const to = addDays(day, 1).getTime();
  const end = item.endsAt ?? item.startsAt;
  if (item.allDay) return item.startsAt < to && Math.max(end, item.startsAt + 1) > from;
  return item.startsAt < to && (item.endsAt == null ? item.startsAt >= from : end > from);
}
