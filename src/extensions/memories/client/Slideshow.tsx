import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import type { MemoryRecord } from "../shared/types";
import { prefersReducedMotion } from "./motion";
import { PhotoImg } from "./parts";

/** 1 枚を出す時間。0.8 秒。F-122 */
const FRAME_MS = 800;

/**
 * ひとコマを時刻の順に続けて流す。F-122
 * 端末が動きを減らす設定なら、流さずに自分で送る。
 */
export function Slideshow({
  records,
  timeZone,
  onClose,
}: {
  records: MemoryRecord[];
  timeZone: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!playing || records.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % records.length), FRAME_MS);
    return () => window.clearInterval(timer);
  }, [playing, records.length]);

  const record = records[index];
  if (!record?.photos[0]) return null;
  const hour = record.komaSlot
    ? new Intl.DateTimeFormat("ja-JP", { hour: "numeric", timeZone }).format(record.komaSlot)
    : "";
  return (
    <ResponsiveSheet title="ひとコマを再生" onClose={onClose}>
      <div className="relative">
        <PhotoImg
          photo={record.photos[0]}
          size="full"
          className="h-[60dvh] max-h-[520px] rounded-[20px]"
          alt={`${hour} のひとコマ`}
        />
        <span
          className="absolute bottom-3 left-3 rounded-full bg-white/88 px-2.5 text-sm leading-7 font-bold text-[#17202c]"
          aria-live="polite"
        >
          {hour}
        </span>
      </div>
      {record.body && <p className="text-[15px]">{record.body}</p>}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="前のひとコマ"
          onClick={() => setIndex((i) => (i - 1 + records.length) % records.length)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button variant="secondary" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "一時停止" : "再生"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="次のひとコマ"
          onClick={() => setIndex((i) => (i + 1) % records.length)}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
