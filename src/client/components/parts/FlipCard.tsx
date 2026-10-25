/**
 * 札。伏せた面を押すと rotateY で 180 度裏返り、裏の面が出る。0100、F-132
 *
 * 動かすのは transform と opacity だけ。動きを減らすとき(reduced)は裏返さず、2 つの面のクロスフェードにする。
 * 隠れている面は inert にして、フォーカスも読み上げも届かせない。
 * @param tilt 端末の傾きによる傾き(度)。reduced のときは使わない
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FlipCard({
  flipped,
  reduced,
  tiltX = 0,
  tiltY = 0,
  front,
  back,
  className,
}: {
  flipped: boolean;
  reduced: boolean;
  tiltX?: number;
  tiltY?: number;
  front: ReactNode;
  back: ReactNode;
  className?: string;
}) {
  const face = "absolute inset-0 overflow-hidden rounded-[20px]";
  const turn = reduced ? "none" : `rotateX(${tiltX}deg) rotateY(${tiltY + (flipped ? 180 : 0)}deg)`;
  return (
    <div className={cn("relative [perspective:900px]", className)}>
      <div
        data-testid="flip-card"
        data-flipped={flipped}
        className="relative size-full"
        style={{
          transformStyle: reduced ? "flat" : "preserve-3d",
          transform: turn,
          transition: reduced ? "none" : "transform calc(var(--dur-slow) * 2) var(--ease-out, ease-out)",
        }}
      >
        <div
          inert={flipped}
          className={cn(face, reduced && "transition-opacity duration-base")}
          style={{ backfaceVisibility: "hidden", opacity: reduced && flipped ? 0 : 1 }}
        >
          {front}
        </div>
        <div
          inert={!flipped}
          className={cn(face, reduced && "transition-opacity duration-base")}
          style={{
            backfaceVisibility: "hidden",
            transform: reduced ? "none" : "rotateY(180deg)",
            opacity: reduced && !flipped ? 0 : 1,
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
