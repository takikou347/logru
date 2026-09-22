import { Camera, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { slotsOfDay } from "../shared/koma";
import type { MemoryRecord } from "../shared/types";
import { PhotoImg } from "./parts";
import { Slideshow } from "./Slideshow";

/**
 * ひとコマの目盛り。7 時台から 22 時台の 16 枠を横に並べる。0024
 * 空の枠は薄い線、これからの枠は破線、いまの枠はテーマカラーで囲み、上にしおりを垂らす。
 *
 * @param dayStart その日の 0 時
 * @param records その日のひとコマ
 * @param nowPath いまの枠を押したときに移る先。今日だけ
 * @param onOpen 撮った枠を押したとき
 */
export function KomaStrip({
  dayStart,
  timeZone,
  records,
  title = "ひとコマ",
  nowPath,
  onOpen,
  header,
}: {
  dayStart: number;
  timeZone: string;
  records: MemoryRecord[];
  title?: string;
  nowPath?: string;
  onOpen?: (r: MemoryRecord) => void;
  header?: React.ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const now = Date.now();
  const slots = slotsOfDay(dayStart, timeZone);
  const shots = records.filter((r) => r.kind === "koma" && r.photos[0]);
  return (
    <section className="glass rounded-3xl px-3.5 pt-3 pb-2" aria-label={title}>
      <header className="mb-2 flex items-baseline gap-2">
        <h2 className="text-[13px] font-bold">{title}</h2>
        {header ?? <span className="text-[11px] text-ink-2">{shots.length} 枚</span>}
        {shots.length > 0 && (
          <button type="button" className="ml-auto inline-flex min-h-9 items-center gap-1 text-xs font-bold" onClick={() => setPlaying(true)}>
            <Play className="size-3 fill-current" aria-hidden="true" />
            再生
          </button>
        )}
      </header>
      <ScrollArea orientation="horizontal" viewportClassName="pb-2">
        <ol className="flex w-max gap-[5px]">
          {slots.map((s) => {
            const shot = shots.find((r) => r.komaSlot === s.start);
            const current = now >= s.start && now < s.start + 3_600_000;
            const later = s.start > now;
            const label = `${s.hour} 時`;
            return (
              <li key={s.hour} className="flex w-10 flex-none flex-col items-center gap-1">
                <span className={cn("text-xs leading-none font-medium text-ink-2", current && "font-extrabold text-ink", later && "text-ink-3")}>{s.hour}</span>
                {shot ? (
                  <button type="button" className="h-[54px] w-10 overflow-hidden rounded-[10px]" aria-label={`${label} のひとコマ`} onClick={() => onOpen?.(shot)}>
                    <PhotoImg photo={shot.photos[0]!} className="size-full" />
                  </button>
                ) : current && nowPath ? (
                  <Link
                    to={nowPath}
                    aria-label={`${label} のひとコマを撮る`}
                    className="relative grid h-[54px] w-10 place-items-center rounded-[10px] border-2 border-primary text-ink before:absolute before:-top-0.5 before:left-1/2 before:h-[5px] before:w-3.5 before:-translate-x-1/2 before:rounded-b-[3px] before:bg-primary before:content-['']"
                  >
                    <Camera className="size-4" />
                  </Link>
                ) : (
                  <span
                    aria-label={later ? `${label}、これから` : `${label}、写真なし`}
                    className={cn("h-[54px] w-10 rounded-[10px] border-[1.5px] border-[color-mix(in_srgb,var(--ink)_16%,transparent)]", later && "border-dashed")}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </ScrollArea>
      {playing && <Slideshow records={shots} timeZone={timeZone} onClose={() => setPlaying(false)} />}
    </section>
  );
}
