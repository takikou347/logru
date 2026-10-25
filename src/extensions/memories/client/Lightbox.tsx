import type { GroupSummary, Me } from "@shared/api-types";
import { ChevronLeft, ChevronRight, ImageIcon, Share2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { vibrateFlip } from "@/lib/haptics";
import { useMediaQuery } from "@/lib/use-media-query";
import { canShareFiles, photoShareFile, sharePhoto } from "@/lib/web-share";
import type { MemoryRecord, Photo } from "../shared/types";
import { useSaveMemory } from "./api";
import { authorOf, formatClock, PhotoImg, useIconOnly } from "./parts";

/** 大きく見る写真と、その写真が付いた記録 */
export type LightboxEntry = { photo: Photo; record: MemoryRecord };

/** 横になぞり始めたと見なす距離(px)。境界値の理由は 0101 */
const SWIPE_LOCK_PX = 8;
/** 払ったと見なす速さ(px/ms)と、その最小の距離(px)。0101 */
const FLICK_SPEED = 0.5;
const FLICK_MIN_PX = 24;
/** 端で写真が動く割合。0101 */
const EDGE_RESISTANCE = 0.25;
/** めくったあと、次の写真が入ってくる位置(px)と時間(ms)。0101 */
const ENTER_PX = 48;
const ENTER_MS = 200;

/**
 * 写真を指で左右になぞってめくる。#303
 * 付いてくるのは transform の translateX だけ。移るか戻るかの境界と端の抵抗は 0101。
 * 移ったときは transition を外し、めくった向きの反対側から次の写真を入れる。戻るときだけ transition をかける。
 * 動きを減らしているときは付いてこさせず、離した瞬間に切り替える。
 */
function useSwipe(index: number, count: number, onMove: (to: number) => void) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // 戻るときだけ transition をかける。移ったときの dx の戻りは見せない
  const [snapBack, setSnapBack] = useState(false);
  const el = useRef<HTMLDivElement | null>(null);
  const enter = useRef(0);
  const start = useRef<{ id: number; x: number; y: number; t: number; locked: boolean; lastX: number } | null>(null);
  const width = useRef(1);

  const reset = (snap = true) => {
    start.current = null;
    setDragging(false);
    setSnapBack(snap);
    setDx(0);
  };
  // めくった向きの反対側から入ってくる。次の写真に替わった直後に 1 回だけ動かす
  // biome-ignore lint/correctness/useExhaustiveDependencies: 写真が替わったときだけ動かす
  useLayoutEffect(() => {
    const dir = enter.current;
    enter.current = 0;
    if (dir === 0 || reduced || !el.current?.animate) return;
    el.current.animate(
      [
        { transform: `translateX(${dir * ENTER_PX}px)`, opacity: 0.3 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: ENTER_MS, easing: "ease-out" },
    );
  }, [index, reduced]);
  const offsetOf = (raw: number) => {
    const atEdge = (raw > 0 && index === 0) || (raw < 0 && index === count - 1);
    return atEdge ? raw * EDGE_RESISTANCE : raw;
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (count < 2) return;
      // 写真の外で離したマウスは pointerup が届かず、古い分が残る。マウスは押すたびに捨てて取り直す
      if (start.current) {
        if (e.pointerType !== "mouse") return;
        reset();
      }
      width.current = e.currentTarget.getBoundingClientRect().width || 1;
      start.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, locked: false, lastX: e.clientX };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return reset();
      s.lastX = e.clientX;
      const raw = e.clientX - s.x;
      if (!s.locked) {
        if (Math.abs(raw) < SWIPE_LOCK_PX || Math.abs(raw) < Math.abs(e.clientY - s.y)) return;
        s.locked = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }
      if (!reduced) setDx(offsetOf(raw));
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      // 離したときの座標は端末によって入らないので、最後に動いた位置で測る
      const raw = s.lastX - s.x;
      const speed = Math.abs(raw) / Math.max(1, e.timeStamp - s.t);
      const far = Math.abs(raw) > width.current / 4 || (speed > FLICK_SPEED && Math.abs(raw) > FLICK_MIN_PX);
      const to = raw < 0 ? index + 1 : index - 1;
      const moves = s.locked && far && to >= 0 && to < count;
      reset(!moves);
      if (moves) {
        enter.current = raw < 0 ? 1 : -1;
        vibrateFlip();
        onMove(to);
      }
    },
    onPointerCancel: () => reset(),
    // 中の img から取り上げられた分(setPointerCapture で移すとき)は数えない
    onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && start.current) reset();
    },
  };
  const style: React.CSSProperties = {
    touchAction: "pan-y",
    transform: dx ? `translateX(${dx}px)` : undefined,
    transition: dragging || reduced || !snapBack ? "none" : "transform 200ms ease-out",
  };
  return { handlers, style, ref: el };
}

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
  const iconOnly = useIconOnly();
  const entry = entries[index];
  const prev = () => onIndex((index - 1 + entries.length) % entries.length);
  const next = () => onIndex((index + 1) % entries.length);
  // ファイルの共有に対応した端末だけ、共有ボタンを出す。#258
  const shareOk = canShareFiles();

  async function handleShare() {
    if (!entry) return;
    try {
      const file = await photoShareFile(entry.photo.fullUrl, `logru-${entry.photo.id}.jpg`);
      await sharePhoto(file);
    } catch (e) {
      // シートを閉じただけなら AbortError。共有をやめただけなので、失敗として出さない
      if ((e as { name?: string }).name !== "AbortError") toast.error("共有できませんでした。");
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const swipe = useSwipe(index, entries.length, onIndex);

  if (!entry) return null;
  const author = authorOf(entry.record, groups, me);
  return (
    <ResponsiveSheet title={`写真 ${index + 1} / ${entries.length}`} onClose={onClose}>
      <div className="relative">
        <div ref={swipe.ref} data-testid="lightbox-photo" {...swipe.handlers} style={swipe.style}>
          <PhotoImg
            photo={entry.photo}
            size="full"
            className="max-h-[60dvh] min-h-[240px] rounded-[20px] [&_img]:object-contain [&_img]:pointer-events-none"
            alt={entry.record.body ?? ""}
          />
        </div>
        {entries.length > 1 && (
          <>
            <button
              type="button"
              aria-label="前の写真"
              onClick={prev}
              className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="次の写真"
              onClick={next}
              className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white"
            >
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
      {(memoryId || shareOk) && (
        <div className="flex flex-wrap gap-2">
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
          {shareOk && (
            <Button variant="secondary" className="self-start" aria-label="共有する" onClick={handleShare}>
              <Share2 className="size-4" />
              {!iconOnly && "共有する"}
            </Button>
          )}
        </div>
      )}
    </ResponsiveSheet>
  );
}

/** 記録から、大きく見る写真の並びを作る。記録の時刻の順、記録の中は並び順 */
export function entriesOf(records: MemoryRecord[]): LightboxEntry[] {
  return records.flatMap((record) => record.photos.map((photo) => ({ photo, record })));
}
