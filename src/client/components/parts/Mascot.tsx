/**
 * 空の画面のマスコット。犬を最初の 1 体にする。0053
 *
 * 線画。線はいつも var(--ink)、首の帯だけテーマカラー var(--accent) で塗る。色は CSS 変数で持つので、
 * テーマカラーとライト・ダークが変わると描き直さずに追随する。絵は飾りなので、いつも `aria-hidden` を付ける。
 *
 * 持ち物だけを画面ごとに変える。犬でない種類を足すときの手順は 0053 に書く。
 */
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

export type MascotPose = "calendar" | "camera" | "coin" | "compass" | "bell" | "search";

/** まばたきを待つ間。決まった値ではなく、この幅でゆらす。0044 は動きそのものの速さにだけ使う */
const BLINK_WAIT_MIN_MS = 2600;
const BLINK_WAIT_RANGE_MS = 2600;
/** まぶたを閉じたままにする間 */
const BLINK_HOLD_MS = 120;

/** 持ち物。前足の脇に置く小物で、線の太さは胴より少し細くする */
function Prop({ pose }: { pose: MascotPose }) {
  switch (pose) {
    case "calendar":
      return (
        <g transform="translate(43,39)" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
          <rect x="0" y="3" width="15" height="12" rx="2.5" strokeWidth="2" />
          <path d="M4 0 L4 5" />
          <path d="M11 0 L11 5" />
          <path d="M3.5 9.5 L11.5 9.5" strokeWidth="1.4" />
        </g>
      );
    case "camera":
      return (
        <g
          transform="translate(42,40)"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="0" y="3" width="17" height="11" rx="3" strokeWidth="2" />
          <rect x="5.5" y="0" width="6" height="3" rx="1.2" />
          <circle cx="8.5" cy="8.5" r="3.2" />
        </g>
      );
    case "coin":
      return (
        <g transform="translate(43,40)" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="7" cy="8" r="7" strokeWidth="2" />
          <path d="M7 4.6 L7 11.4" />
          <path d="M4.6 6.2 C4.6 5 5.6 4.6 7 4.6 C8.6 4.6 9.4 5.3 9.4 6.1 C9.4 8 4.6 7.1 4.6 9.4 C4.6 10.4 5.6 11.4 7 11.4 C8.4 11.4 9.4 10.9 9.4 9.7" />
        </g>
      );
    case "compass":
      return (
        <g
          transform="translate(42,39)"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="8" strokeWidth="2" />
          <path d="M10.6 4.8 L8.8 8.9 L5.4 11.2 L7.2 7.1 Z" fill="var(--ink)" stroke="none" />
        </g>
      );
    case "bell":
      return (
        <g
          transform="translate(44,38)"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 0.5 C9.3 0.5 11 3.3 11 7 L11 9.5 L1 9.5 L1 7 C1 3.3 2.7 0.5 6 0.5 Z" strokeWidth="2" />
          <path d="M4 12 C4 13.1 4.9 14 6 14 C7.1 14 8 13.1 8 12" />
        </g>
      );
    case "search":
      return (
        <g transform="translate(43,40)" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="6" cy="6" r="5.5" strokeWidth="2" />
          <path d="M10 10 L14 14" strokeWidth="2.4" />
        </g>
      );
  }
}

/**
 * まばたきする目。動きを減らす設定では止め、開いたまま。動きの速さは 0044 の --dur-fast
 * (Tailwind の `duration-fast`)。待つ間隔だけは動きの速さの決まりの外で、自分でゆらす。
 */
function Eyes() {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [closed, setClosed] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    const schedule = () => {
      const wait = BLINK_WAIT_MIN_MS + Math.random() * BLINK_WAIT_RANGE_MS;
      timer.current = window.setTimeout(() => {
        if (cancelled) return;
        setClosed(true);
        timer.current = window.setTimeout(() => {
          if (cancelled) return;
          setClosed(false);
          schedule();
        }, BLINK_HOLD_MS);
      }, wait);
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [reduceMotion]);

  return (
    <g
      className="origin-center transition-transform duration-fast ease-in-out"
      style={{ transformBox: "fill-box", transform: closed ? "scaleY(0.1)" : "scaleY(1)" }}
    >
      <circle cx="26.5" cy="25" r="2.1" fill="var(--ink)" />
      <circle cx="37.5" cy="25" r="2.1" fill="var(--ink)" />
    </g>
  );
}

/**
 * 犬のマスコット。頭・耳・胴・しっぽ・前足は共通、`pose` で前足の脇の持ち物だけ変える。
 * @param pose 出す持ち物。空の画面ごとに変える
 * @param size 一辺のおおよその大きさ(px)
 */
export function Mascot({ pose, size = 56, className }: { pose: MascotPose; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
      fill="none"
      stroke="var(--ink)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* しっぽ。胴の左手前から少しだけ覗かせる。持ち物と反対側に置き、重ねない */}
      <circle cx="15" cy="52" r="5" />
      {/* 耳。頭の横から立て、犬らしく先を外へ向ける */}
      <path d="M20 21 C13 18 11 7 19 5 C26 6 27 15 23 20 Z" />
      <path d="M44 21 C51 18 53 7 45 5 C38 6 37 15 41 20 Z" />
      {/* 胴。丸皿型で座っている形にする */}
      <rect x="15" y="39" width="34" height="21" rx="15" />
      {/* 前足。胴の下から覗く */}
      <rect x="26.5" y="55" width="11" height="7" rx="3.5" />
      {/* 頭 */}
      <circle cx="32" cy="27" r="15" />
      {/* 鼻先(マズル)の縁。目にかからない下寄りにする */}
      <ellipse cx="32" cy="33.5" rx="8" ry="5" strokeWidth="1.6" />
      {/* 鼻と口 */}
      <circle cx="32" cy="32.5" r="1.6" fill="var(--ink)" stroke="none" />
      <path d="M28.5 37 Q32 39.5 35.5 37" strokeWidth="1.8" />
      <Eyes />
      {/* 首の帯。マスコットで唯一、テーマカラーを塗る場所。0053 */}
      <path d="M20 39 Q32 45.5 44 39 L44 42.5 Q32 49 20 42.5 Z" fill="var(--accent)" stroke="none" />
      <Prop pose={pose} />
    </svg>
  );
}
