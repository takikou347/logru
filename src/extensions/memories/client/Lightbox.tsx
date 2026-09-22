import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import type { GroupSummary, Me } from "@shared/api-types";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import type { MemoryRecord, Photo } from "../shared/types";
import { useSaveMemory } from "./api";
import { authorOf, formatClock, PhotoImg } from "./parts";

/** 大きく見る写真と、その写真が付いた記録 */
export type LightboxEntry = { photo: Photo; record: MemoryRecord };

/**
 * 写真を大きく見る。左右で前後に移る。撮った人と時刻と、記録の文章を出す。F-115
 * @param memoryId 表紙にできる思い出。無ければ「表紙にする」を出さない。F-108
 */
export function Lightbox({
  entries,
  index,
  onIndex,
  onClose,
  groups,
  me,
  memoryId,
  timeZone,
}: {
  entries: LightboxEntry[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  groups: GroupSummary[];
  me: Me;
  memoryId?: string;
  timeZone?: string;
}) {
  const save = useSaveMemory();
  const entry = entries[index];
  const prev = () => onIndex((index - 1 + entries.length) % entries.length);
  const next = () => onIndex((index + 1) % entries.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!entry) return null;
  const author = authorOf(entry.record, groups, me);
  return (
    <ResponsiveSheet title={`写真 ${index + 1} / ${entries.length}`} onClose={onClose}>
      <div className="relative">
        <PhotoImg photo={entry.photo} size="full" className="max-h-[60dvh] min-h-[240px] rounded-[20px] [&_img]:object-contain" alt={entry.record.body ?? ""} />
        {entries.length > 1 && (
          <>
            <button type="button" aria-label="前の写真" onClick={prev} className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" aria-label="次の写真" onClick={next} className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      <p className="text-sm">
        <b>{author.name}</b>
        <span className="ml-2 text-ink-2">{formatClock(entry.photo.takenAt ?? entry.record.occurredAt, timeZone)}</span>
      </p>
      {entry.record.body && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{entry.record.body}</p>}
      {memoryId && (
        <Button
          variant="secondary"
          className="self-start"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              { id: memoryId, body: { coverPhotoId: entry.photo.id } },
              { onSuccess: () => toast("表紙にしました"), onError: (e) => toast.error((e as Error).message) },
            )
          }
        >
          <ImageIcon className="size-4" />
          表紙にする
        </Button>
      )}
    </ResponsiveSheet>
  );
}

/** 記録から、大きく見る写真の並びを作る。記録の時刻の順、記録の中は並び順 */
export function entriesOf(records: MemoryRecord[]): LightboxEntry[] {
  return records.flatMap((record) => record.photos.map((photo) => ({ photo, record })));
}
