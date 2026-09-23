import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import type { Photo } from "../shared/types";
import { prefersReducedMotion } from "./motion";
import { smallSrc } from "./parts";

type Rect = { top: number; left: number; width: number; height: number };
type Anim = { rect: Rect; dx: number; dy: number; sx: number; sy: number };
type Phase = "idle" | "lift" | "open";

/** 表紙が中央で開くまでの大きさと向き。0050 */
const OPEN_MS = 320;

/**
 * 思い出の表紙を押したときの演出。0050
 * 表紙の写真だけを複製した層が、押した位置から中央へ浮き、Y 軸で表紙のように開いてから移る。
 * 幅と高さは動かさず、伸び縮みは transform の scale だけで表す。0044
 * 動きを減らす設定と、新しいタブで開く押し方では、演出をせずいつもの Link のまま移る。#103
 *
 * @param cover 表紙の写真。無ければ tone の色を奥にも表にも使う
 * @param tone 表紙が無いときの色。`c-<名前>` の名前だけを渡す
 */
export function CoverOpen({
  to,
  cover,
  tone,
  className,
  ariaLabel,
  children,
}: {
  to: string;
  cover: Photo | null;
  tone: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const navigate = useNavigate();
  const [anim, setAnim] = useState<Anim | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || prefersReducedMotion()) return;
    const node = ref.current;
    if (!node) return;
    e.preventDefault();
    const box = node.getBoundingClientRect();
    const width = Math.min(window.innerWidth * 0.74, 300);
    const height = width * 1.32;
    const left = (window.innerWidth - width) / 2;
    const top = Math.max(24, (window.innerHeight - height) / 2 - 16);
    setPhase("idle");
    setAnim({
      rect: { top: box.top, left: box.left, width: box.width, height: box.height },
      sx: width / box.width,
      sy: height / box.height,
      dx: left + width / 2 - (box.left + box.width / 2),
      dy: top + height / 2 - (box.top + box.height / 2),
    });
  }

  // 2 回の rAF を挟み、動かす前の見た目を 1 度描かせてから transform を掛ける。transition を確実に効かせるため
  useEffect(() => {
    if (!anim || phase !== "idle") return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("lift")));
    return () => cancelAnimationFrame(raf);
  }, [anim, phase]);

  useEffect(() => {
    if (phase !== "lift") return;
    const timer = window.setTimeout(() => setPhase("open"), OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") return;
    const timer = window.setTimeout(() => navigate(to), OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [phase, navigate, to]);

  const face = cn(
    "absolute inset-0 overflow-hidden rounded-[22px] bg-cover bg-center",
    !cover && `c-${tone} bg-(--c) opacity-70`,
  );
  // 奥の色は 0024 のとおり縮小画像(tiny)を広げる。表紙そのものは、一覧の表紙と同じ small(#158)で見せる
  const insideStyle = cover ? { backgroundImage: `url(${cover.tiny})` } : undefined;
  const coverStyle = cover ? { backgroundImage: `url(${smallSrc(cover)})` } : undefined;

  return (
    <>
      <Link ref={ref} to={to} className={className} aria-label={ariaLabel} onClick={onClick}>
        {children}
      </Link>
      {anim && (
        <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
          <div
            className="fixed inset-0 transition-opacity duration-slow ease-out"
            style={{ backgroundColor: "var(--scrim)", opacity: phase === "idle" ? 0 : 1 }}
          />
          <div
            className="fixed"
            style={{ top: anim.rect.top, left: anim.rect.left, width: anim.rect.width, height: anim.rect.height }}
          >
            <div
              className="relative size-full transition-transform duration-slow ease-out"
              style={
                {
                  perspective: 1400,
                  transform:
                    phase === "idle" ? "none" : `translate(${anim.dx}px, ${anim.dy}px) scale(${anim.sx}, ${anim.sy})`,
                } as CSSProperties
              }
            >
              {/* 開いた表紙の奥の色。表紙の縮小画像を広げる。0024 */}
              <div className={face} style={insideStyle} />
              {/* 表紙。Y 軸で開く。origin は左端、裏は描かない */}
              <div
                className={cn(
                  face,
                  "origin-left transition-transform duration-slow ease-out [backface-visibility:hidden]",
                  phase === "open" && "[transform:rotateY(-108deg)]",
                )}
                style={coverStyle}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
