import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Photo } from "../shared/types";
import { prefersReducedMotion } from "./motion";

/** めくり切ったと見なす、指を動かした割合。0050 */
const COMMIT_RATIO = 0.32;
/** 回せる最大の角度 */
const MAX_DEG = 150;

/**
 * しおりの 1 日を、指でめくる。0050
 * 横に動かした分だけ Y 軸で回し、指を離すと閾値を超えていればめくり切って隣の日へ、届かなければ戻す。
 * 動いている間は毎回の描き直しを避けるため、React の状態を経由せず DOM を直に書き換える。
 * 動きを減らす設定と、隣の日が無い向きでは、指の動きを見ない。ページはそのままにする。#103
 *
 * 日が変わるたびに、呼ぶ側が `key` へ日付を渡してこの部品ごと作り直す。姿勢を戻す専用の状態を持たない
 *
 * @param tint めくっている間に見える裏の色。0024 の奥の色と同じ、表紙の縮小画像を広げた塗り
 */
export function PageFlip({
  onPrev,
  onNext,
  tint,
  children,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  tint: { cover: Photo | null; tone: string };
  children: ReactNode;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);

  function apply(progress: number) {
    const node = pageRef.current;
    const shade = shadeRef.current;
    if (!node) return;
    const clamped = Math.max(-1, Math.min(1, progress));
    node.style.transformOrigin = clamped <= 0 ? "left center" : "right center";
    node.style.transform = `rotateY(${clamped * MAX_DEG}deg)`;
    if (shade) {
      shade.style.setProperty("--flip-shade-dir", clamped <= 0 ? "right" : "left");
      shade.style.setProperty("--flip-shade", String(Math.min(0.4, Math.abs(clamped) * 0.6)));
      shade.style.opacity = String(Math.min(1, Math.abs(clamped) * 1.4));
    }
  }

  function settle(commit: "prev" | "next" | null) {
    const node = pageRef.current;
    const shade = shadeRef.current;
    if (!node) return;
    const ms = commit ? "var(--dur-slow)" : "var(--dur-base)";
    node.style.transition = `transform ${ms} var(--ease-out)`;
    if (shade) shade.style.transition = `opacity ${ms} var(--ease-out)`;
    node.style.transform =
      commit === "next" ? `rotateY(${-MAX_DEG}deg)` : commit === "prev" ? `rotateY(${MAX_DEG}deg)` : "none";
    if (shade) shade.style.opacity = commit ? "1" : "0";
    const onEnd = () => {
      node.removeEventListener("transitionend", onEnd);
      if (commit === "next") onNext?.();
      else if (commit === "prev") onPrev?.();
    };
    node.addEventListener("transitionend", onEnd);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (prefersReducedMotion() || (!onPrev && !onNext)) return;
    const node = pageRef.current;
    if (!node) return;
    node.style.transition = "none";
    drag.current = { x: e.clientX, width: node.getBoundingClientRect().width || 1 };
    node.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    let progress = (e.clientX - drag.current.x) / drag.current.width;
    if (progress < 0 && !onNext) progress = 0;
    if (progress > 0 && !onPrev) progress = 0;
    apply(progress);
  }

  /** 指を離したとき。閾値を超えていれば、めくり切って隣の日へ */
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const progress = (e.clientX - drag.current.x) / drag.current.width;
    drag.current = null;
    if (progress <= -COMMIT_RATIO && onNext) settle("next");
    else if (progress >= COMMIT_RATIO && onPrev) settle("prev");
    else settle(null);
  }

  /**
   * 指の動きが途中で途切れたとき。写真の要素をつかんだときの、ブラウザーの既定のドラッグなどで起きる。
   * pointercancel の座標は当てにならないので、進み具合を見ずに必ず戻す
   */
  function onPointerCancel() {
    if (!drag.current) return;
    drag.current = null;
    settle(null);
  }

  const backStyle = tint.cover ? { backgroundImage: `url(${tint.cover.tiny})` } : undefined;

  return (
    <div className="relative [perspective:1600px]">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 指でめくる面。ボタンではなく、中の記録やしおりの操作をそのまま押せる必要がある */}
      <div
        ref={pageRef}
        className="relative touch-pan-y select-none [transform-style:preserve-3d] [will-change:transform]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // 中の写真をつかむと、ブラウザーの既定のドラッグが pointer capture を奪う。#103
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="[backface-visibility:hidden]">
          {children}
          {/* めくる影。ぼかさず、黒から透明のグラデーションを重ねる。0050 */}
          <div
            ref={shadeRef}
            aria-hidden="true"
            className="page-flip-shade pointer-events-none absolute inset-0 rounded-panel opacity-0"
          />
        </div>
        {/* めくっている間だけ見える裏。origin の反対に 180 度回してあり、表が隠れると見える */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-panel bg-cover bg-center [backface-visibility:hidden] [transform:rotateY(180deg)]",
            !tint.cover && `bg-(--c) opacity-70 c-${tint.tone}`,
          )}
          style={backStyle}
        />
      </div>
    </div>
  );
}
