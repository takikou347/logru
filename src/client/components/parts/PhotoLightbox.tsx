import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";

/**
 * 写真を大きく見る、共通の形。決定 0067。思い出の拡大表示(F-115)と同じ見た目にする。
 * シート・大きな画像・左右の矢印だけを持つ。撮った人や文章など、呼び出し側だけの情報は children で足す。
 * 0051 のらせんの写真から使う。#256
 *
 * @param onPrev 前の写真。渡さなければ矢印を出さない
 * @param onNext 次の写真。渡さなければ矢印を出さない
 */
export function PhotoLightbox({
  title,
  src,
  alt = "",
  onPrev,
  onNext,
  onClose,
  children,
}: {
  title: string;
  src: string;
  alt?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <ResponsiveSheet title={title} onClose={onClose}>
      <div className="relative">
        <img src={src} alt={alt} className="max-h-[60dvh] min-h-[240px] w-full rounded-[20px] object-contain" />
        {onPrev && (
          <button
            type="button"
            aria-label="前の写真"
            onClick={onPrev}
            className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            aria-label="次の写真"
            onClick={onNext}
            className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
      {children}
    </ResponsiveSheet>
  );
}
