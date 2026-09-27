/**
 * 今日のページを、左右のスワイプで日めくりに送る。0092、issue #240
 *
 * MonthFlipDeck(#99)と同じ組み立て(複製した面を指に追従させ、離したら Web Animations API で
 * めくり切るか戻す)を、月の表ではなく今日のページ全体に使う。テーマ(紙・リキッドガラス)で
 * 動く見た目が違う。紙は綴じ目を軸に回り(rotateY)、リキッドガラスは板が傾いて抜け、次の板は
 * 奥から板が来るように、下の面をわずかに拡大・不透明にする。
 *
 * スワイプは、見出しや余白など「行の外」でだけ効かせる。行の上(ボタン、リンク、入力、
 * 決定 0084 の SwipeRow)から始まった指は無視し、その行自身のタップ・スワイプに譲る。
 *
 * 動きを減らす設定では、めくらず 150ms のクロスフェードで入れ替える。
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { addDays } from "@/lib/dates";

/** 3D でめくる面までの距離 */
const PERSPECTIVE_PX = 1200;
/** 紙がめくり切ったときの傾き */
const MAX_ANGLE_DEG = 100;
/** リキッドガラスが傾いて抜けるときの、いちばん深い角度 */
const GLASS_TILT_DEG = 16;
/** リキッドガラスが抜けるときの、横に動く距離(%) */
const GLASS_SLIDE_PCT = 42;
/** めくれた紙の裏に重ねる、黒の不透明度の最大 */
const MAX_SHADE_OPACITY = 0.28;
/** 横に動いたと決めるまでの遊び */
const LOCK_PX = 10;
/** 指を離したとき、日を送ったと決める幅の割合(表の幅に対して) */
const COMMIT_RATIO = 0.3;
/** 指で追う間、この割合まで動かすと、めくり切った見た目(progress 1)になる */
const VISUAL_RATIO = 0.6;
/** 動きを減らす設定のときの、クロスフェードの長さ(ms) */
const REDUCED_MS = 150;

type Look = "paper" | "glass";

/** その場の見た目の土台。既定はガラス。めくり始めるたびに読み直す */
function readLook(): Look {
  return typeof document !== "undefined" && document.documentElement.dataset.look === "paper" ? "paper" : "glass";
}

/** スワイプを始めた指が、ボタン・リンク・入力・SwipeRow(0084)の上にあるか。あれば行のスワイプに譲る */
function startedOnRow(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('button, a[href], input, textarea, [data-testid="swipe-row"]') !== null;
}

/** 複製した面(top)の transform */
function topTransform(look: Look, progress: number): string {
  if (look === "paper") return `perspective(${PERSPECTIVE_PX}px) rotateY(${-MAX_ANGLE_DEG * progress}deg)`;
  return `perspective(${PERSPECTIVE_PX}px) translateX(${-GLASS_SLIDE_PCT * progress}%) rotateY(${-GLASS_TILT_DEG * progress}deg)`;
}
function topOpacity(look: Look, progress: number): number {
  return look === "glass" ? 1 - progress * 0.85 : 1;
}
function shadeOpacity(look: Look, progress: number): number {
  return look === "paper" ? MAX_SHADE_OPACITY * progress : 0;
}
/** 下の面(base)。リキッドガラスだけ、次の日が奥から来るように少し縮めて薄くしておく */
function baseTransform(look: Look, progress: number): string {
  return look === "glass" ? `scale(${0.95 + 0.05 * progress})` : "none";
}
function baseOpacity(look: Look, progress: number): number {
  return look === "glass" ? 0.75 + 0.25 * progress : 1;
}

/** tokens.css の --dur-page-flip、--ease-page-flip を読む。見つからなければ既定値 */
function motionDuration(): number {
  if (typeof document === "undefined") return 520;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dur-page-flip");
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) ? ms : 520;
}
function motionEasing(): string {
  if (typeof document === "undefined") return "cubic-bezier(0.2, 0.9, 0.25, 1)";
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--ease-page-flip").trim() ||
    "cubic-bezier(0.2, 0.9, 0.25, 1)"
  );
}

type GestureState = {
  startX: number;
  startY: number;
  dir: 1 | -1 | null;
  locked: boolean;
  ignored: boolean;
  width: number;
  lastProgress: number;
  lastVisualProgress: number;
  look: Look;
};

export function DayFlipDeck({
  date,
  reducedMotion,
  onChangeDate,
  renderPage,
}: {
  date: Date;
  reducedMotion: boolean;
  onChangeDate: (dir: 1 | -1) => void;
  /** その日のページを描く */
  renderPage: (d: Date) => ReactNode;
}) {
  const [peek, setPeek] = useState<{ dir: 1 | -1 } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const busyRef = useRef(false);
  // めくり終えて実際に送った先。date がここに追いつくまで複製を残す
  const commitTargetRef = useRef<number | null>(null);

  const settle = useCallback(
    (dir: 1 | -1, look: Look, committed: boolean, fromProgress: number) => {
      const top = topRef.current;
      const shade = shadeRef.current;
      const base = baseRef.current;
      if (!top) {
        busyRef.current = false;
        setPeek(null);
        return;
      }
      const toProgress = committed ? 1 : 0;
      const duration = motionDuration();
      const easing = motionEasing();
      const anim = top.animate(
        [{ transform: topTransform(look, fromProgress) }, { transform: topTransform(look, toProgress) }],
        { duration, easing, fill: "forwards" },
      );
      top.animate([{ opacity: topOpacity(look, fromProgress) }, { opacity: topOpacity(look, toProgress) }], {
        duration,
        easing,
        fill: "forwards",
      });
      shade?.animate([{ opacity: shadeOpacity(look, fromProgress) }, { opacity: shadeOpacity(look, toProgress) }], {
        duration,
        easing,
        fill: "forwards",
      });
      base?.animate(
        [
          { transform: baseTransform(look, fromProgress), opacity: baseOpacity(look, fromProgress) },
          { transform: baseTransform(look, toProgress), opacity: baseOpacity(look, toProgress) },
        ],
        { duration, easing, fill: "forwards" },
      );
      const finish = () => {
        top.style.transform = topTransform(look, toProgress);
        anim.cancel();
        if (committed) {
          commitTargetRef.current = addDays(date, dir).getTime();
          onChangeDate(dir);
        } else {
          busyRef.current = false;
          setPeek(null);
        }
      };
      anim.finished.then(finish, () => {});
    },
    [date, onChangeDate],
  );

  // 実際の date が、めくり終えた先に追いついたら複製を外す
  useEffect(() => {
    const target = commitTargetRef.current;
    if (target === null) return;
    if (date.getTime() === target) {
      commitTargetRef.current = null;
      busyRef.current = false;
      setPeek(null);
    }
  }, [date]);

  // 動きを減らす設定。3D のめくりの代わりに、日が変わった直後だけ 150ms のクロスフェードで入れ替える
  const prevDateRef = useRef(date.getTime());
  useEffect(() => {
    if (!reducedMotion || prevDateRef.current === date.getTime()) {
      prevDateRef.current = date.getTime();
      return;
    }
    prevDateRef.current = date.getTime();
    baseRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_MS, easing: "ease-out" });
  }, [date, reducedMotion]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (busyRef.current || e.touches.length !== 1) return;
      if (startedOnRow(e.target)) {
        gestureRef.current = null;
        return;
      }
      const t = e.touches[0]!;
      gestureRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        dir: null,
        locked: false,
        ignored: false,
        width: el.clientWidth || 1,
        lastProgress: 0,
        lastVisualProgress: 0,
        look: readLook(),
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      const t = e.touches[0];
      if (!g || !t || g.ignored) return;
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      if (!g.locked) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          g.ignored = true;
          return;
        }
        g.locked = true;
        g.dir = dx < 0 ? 1 : -1;
        if (!reducedMotion) {
          busyRef.current = true;
          setPeek({ dir: g.dir });
        }
      }
      if (!g.dir) return;
      e.preventDefault();
      g.lastProgress = Math.min(1, Math.abs(dx) / g.width);
      if (reducedMotion) return;
      g.lastVisualProgress = Math.min(1, Math.abs(dx) / (g.width * VISUAL_RATIO));
      const top = topRef.current;
      const base = baseRef.current;
      const shade = shadeRef.current;
      if (top) {
        top.style.transform = topTransform(g.look, g.lastVisualProgress);
        top.style.opacity = String(topOpacity(g.look, g.lastVisualProgress));
      }
      if (base) {
        base.style.transform = baseTransform(g.look, g.lastVisualProgress);
        base.style.opacity = String(baseOpacity(g.look, g.lastVisualProgress));
      }
      if (shade) shade.style.opacity = String(shadeOpacity(g.look, g.lastVisualProgress));
    };

    const onTouchEnd = () => {
      const g = gestureRef.current;
      gestureRef.current = null;
      if (!g || !g.locked || !g.dir) return;
      const committed = g.lastProgress >= COMMIT_RATIO;
      if (reducedMotion) {
        if (committed) onChangeDate(g.dir);
        return;
      }
      settle(g.dir, g.look, committed, g.lastVisualProgress);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onChangeDate, reducedMotion, settle]);

  const targetDate = peek ? addDays(date, peek.dir) : date;

  return (
    <div ref={viewportRef} data-testid="day-flip-viewport" className={peek ? "relative overflow-hidden" : "relative"}>
      <div ref={baseRef}>{renderPage(targetDate)}</div>
      {peek && (
        <div
          ref={topRef}
          aria-hidden="true"
          className="absolute inset-0 top-0"
          style={{ transformOrigin: "left", backfaceVisibility: "hidden" }}
        >
          {renderPage(date)}
          <div ref={shadeRef} className="pointer-events-none absolute inset-0 bg-black opacity-0" />
        </div>
      )}
    </div>
  );
}
