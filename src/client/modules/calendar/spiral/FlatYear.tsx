import { Link } from "react-router";
import { Dot } from "@/components/parts/Panel";
import { dateKey, sameDay, WEEKDAYS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DaySummary } from "./summarize";

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => `${i + 1} 月`);

/**
 * 平らな年の表。WebGL が使えない端末と、動きを減らす設定の端末で、らせんの代わりに描く。0051
 * 12 か月をひと続きに並べる。日ごとに予定の色の点と、ひとコマの小さな写真を置く。
 * @param year 西暦
 * @param summaries その年の日ごとの色と写真
 * @param today 今日
 */
export function FlatYear({ year, summaries, today }: { year: number; summaries: DaySummary[]; today: Date }) {
  const byMonth = Array.from({ length: 12 }, (_, m) => summaries.filter((s) => s.date.getMonth() === m));
  return (
    <section
      className="grid h-full auto-rows-min grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label={`${year} 年の表`}
    >
      {byMonth.map((month, m) => (
        <section key={m} className="glass rounded-panel p-3">
          <h2 className="mb-2 text-[15px] font-bold">{MONTH_NAMES[m]}</h2>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-2">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: month[0]?.date.getDay() ?? 0 }, (_, i) => (
              <span key={i} />
            ))}
            {month.map((day) => (
              <Link
                key={dateKey(day.date)}
                to={`/?date=${dateKey(day.date)}&view=day`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-[11px]",
                  sameDay(day.date, today) && "bg-field font-bold",
                )}
                aria-label={`${day.date.getMonth() + 1} 月 ${day.date.getDate()} 日`}
              >
                {day.thumb ? (
                  <img src={day.thumb} alt="" className="size-4 rounded-full object-cover" />
                ) : (
                  day.color && <Dot color={day.color} />
                )}
                <span>{day.date.getDate()}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
