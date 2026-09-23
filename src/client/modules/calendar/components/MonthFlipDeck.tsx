import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGroups, useMe } from "@/api/common";
import { addMonths, monthGrid } from "@/lib/dates";
import type { MonthNav } from "../../home/CalendarContext";
import { useMonthGrid } from "../api";
import type { ViewItem } from "../model";
import { viewItemsOf } from "../model";
import { MonthGridBody, WeekdayHeader } from "./MonthGrid";

/** 3D でめくる面までの距離。狭いほど、めくれた面が大きく反って見える */
const PERSPECTIVE_PX = 1400;
/** めくり切ったときの傾き。90 度を越すので、真横を通り過ぎて完全に見えなくなる */
const MAX_ANGLE_DEG = 100;
/** めくれた紙の裏に重ねる、黒の不透明度の最大 */
const MAX_SHADE_OPACITY = 0.35;
/** 横に動いたと決めるまでの遊び。これより小さい動きは、縦のスクロールに譲る */
const LOCK_PX = 10;
/** 指を離したとき、月を送ったと決める幅の割合(表の幅に対して) */
const COMMIT_RATIO = 0.3;
/** 指で追う間、この割合まで動かすと、めくり切った見た目(角度 1)になる */
const VISUAL_RATIO = 0.6;

type FlipMode = "flip" | "slide";

/** ラボで「横に滑るだけ」を選んでいるか。めくり始めるたびに読み直す。#99、0049 */
function readFlipMode(): FlipMode {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-lab-month-slide")
    ? "slide"
    : "flip";
}

/** progress(0〜1)から、複製した表(top)の transform を作る */
function progressTransform(mode: FlipMode, dir: 1 | -1, progress: number): string {
  if (mode === "slide") return `translateX(${-dir * progress * 100}%)`;
  return `perspective(${PERSPECTIVE_PX}px) rotateX(${-MAX_ANGLE_DEG * progress}deg)`;
}

/** progress(0〜1)から、めくれた紙の裏の不透明度を作る。横に滑るだけの版は裏を見せないので常に 0 */
function progressShade(mode: FlipMode, progress: number): number {
  return mode === "slide" ? 0 : MAX_SHADE_OPACITY * progress;
}

/** 複製した表(top)に、いまの progress(0〜1)の見た目をそのまま適用する。指に追従させる間だけ使う */
function applyProgress(
  top: HTMLDivElement,
  shade: HTMLDivElement | null,
  mode: FlipMode,
  dir: 1 | -1,
  progress: number,
) {
  top.style.transform = progressTransform(mode, dir, progress);
  if (shade) shade.style.opacity = String(progressShade(mode, progress));
}

/**
 * 動きの時間と緩急を、tokens.css・globals.css の値から読む。0044
 * 見つからないときは、いまの --dur-base・--ease-out と同じ値を既定にする
 */
function motionDuration(): number {
  if (typeof document === "undefined") return 220;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dur-base");
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) ? ms : 220;
}
function motionEasing(): string {
  if (typeof document === "undefined") return "cubic-bezier(0, 0, 0.2, 1)";
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "cubic-bezier(0, 0, 0.2, 1)"
  );
}

type GestureState = {
  startX: number;
  startY: number;
  dir: 1 | -1 | null;
  locked: boolean;
  width: number;
  /** 指を離したとき、送ったと決めるための比(表の幅に対して) */
  lastProgress: number;
  /** いま複製(top)に適用している見た目の progress。settle の起点に使う */
  lastVisualProgress: number;
  mode: FlipMode;
  reducedMotion: boolean;
};

/**
 * 月の表を、日めくりの 3D で送る。0049、#99
 *
 * スマホは左右のスワイプで前後の月へ。指に追従し、指を離した幅が表の 30% に届かなければ元へ戻る。
 * PC の矢印ボタンとキーは、CalendarPage の move が monthNav.flipRequest を立て、同じめくりを再生する。
 *
 * ガラスの面(section.glass)は動かさない。動かすのは、複製した表の中身(MonthGridBody)の
 * transform と opacity だけ。0044、0010、#3
 *
 * 隣の月の項目は、複製を出す前に先読みしておく。めくり終えた瞬間に、選んでいる日(URL)を
 * 実際に進め、CalendarPage 側の月がこの隣の月に追いついたら複製を外す。追いつく前に外すと、
 * 一瞬もとの月に戻って見えてしまう。
 */
export function MonthFlipDeck({
  monthAnchor,
  today,
  selected,
  items,
  leaving,
  onPressDay,
  onOpenItem,
  monthNav,
}: {
  monthAnchor: Date;
  today: Date;
  selected: Date;
  items: ViewItem[];
  /** 消した直後、縮んで消える動きの途中にある項目の itemKey。0044、0048、#98 */
  leaving?: Set<string>;
  onPressDay: (d: Date) => void;
  onOpenItem: (item: ViewItem) => void;
  monthNav: MonthNav;
}) {
  const { groupFilter, hiddenIds, hiddenKinds, deletedKeys, flipRequest, onChangeMonth, reducedMotion } = monthNav;
  const groups = useGroups();
  const me = useMe();
  const allGroups = groups.data ?? [];

  const time = monthAnchor.getTime();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Date は毎回新しい参照になるので、時刻の値で比べる
  const days = useMemo(() => monthGrid(monthAnchor), [time]);
  const month = monthAnchor.getMonth();
  // biome-ignore lint/correctness/useExhaustiveDependencies: 同上
  const prevAnchor = useMemo(() => addMonths(monthAnchor, -1), [time]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 同上
  const nextAnchor = useMemo(() => addMonths(monthAnchor, 1), [time]);
  const prevGrid = useMonthGrid(prevAnchor);
  const nextGrid = useMonthGrid(nextAnchor);
  const prevItems = useMemo(
    () => viewItemsOf(prevGrid.raw, allGroups, me.data, hiddenIds, deletedKeys, groupFilter, hiddenKinds),
    [prevGrid.raw, allGroups, me.data, hiddenIds, deletedKeys, groupFilter, hiddenKinds],
  );
  const nextItems = useMemo(
    () => viewItemsOf(nextGrid.raw, allGroups, me.data, hiddenIds, deletedKeys, groupFilter, hiddenKinds),
    [nextGrid.raw, allGroups, me.data, hiddenIds, deletedKeys, groupFilter, hiddenKinds],
  );

  const [peek, setPeek] = useState<{ dir: 1 | -1 } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureState | null>(null);
  // めくって(または送って)いる間、次の操作を受け付けない
  const busyRef = useRef(false);
  // めくり終えて実際に月を送った先。CalendarPage 側の月がここに追いつくまで複製を残す
  const commitTargetRef = useRef<{ year: number; month: number } | null>(null);
  const lastFlipId = useRef<number | null>(null);
  // PC の矢印ボタンとキーで、複製(top)が画面に挿さるのを待ってから動かし始める予約
  const pendingSettleRef = useRef<{ dir: 1 | -1; mode: FlipMode } | null>(null);

  /**
   * いまの見た目(fromProgress)から、めくり切る(1)かもとに戻る(0)かへ動かし切る。
   * Web Animations API を使う。CSS の transition と transitionend は、値の変化がほぼ無いときに
   * 発火しないことがあり、そこで止まってしまうため使わない
   */
  const settle = useCallback(
    (dir: 1 | -1, mode: FlipMode, committed: boolean, fromProgress: number) => {
      const top = topRef.current;
      const shade = shadeRef.current;
      if (!top) {
        busyRef.current = false;
        setPeek(null);
        return;
      }
      const toProgress = committed ? 1 : 0;
      const duration = motionDuration();
      const easing = motionEasing();
      const anim = top.animate(
        [
          { transform: progressTransform(mode, dir, fromProgress) },
          { transform: progressTransform(mode, dir, toProgress) },
        ],
        { duration, easing, fill: "forwards" },
      );
      shade?.animate([{ opacity: progressShade(mode, fromProgress) }, { opacity: progressShade(mode, toProgress) }], {
        duration,
        easing,
        fill: "forwards",
      });
      const finish = () => {
        top.style.transform = progressTransform(mode, dir, toProgress);
        anim.cancel();
        if (committed) {
          const target = addMonths(monthAnchor, dir);
          commitTargetRef.current = { year: target.getFullYear(), month: target.getMonth() };
          onChangeMonth(dir);
        } else {
          busyRef.current = false;
          setPeek(null);
        }
      };
      // 途中で外れた(unmount やキャンセル)ときは、そのまま何もしない
      anim.finished.then(finish, () => {});
    },
    [monthAnchor, onChangeMonth],
  );

  // 実際の月(monthAnchor)が、めくり終えた先に追いついたら複製を外す
  useEffect(() => {
    const target = commitTargetRef.current;
    if (!target) return;
    if (monthAnchor.getFullYear() === target.year && monthAnchor.getMonth() === target.month) {
      commitTargetRef.current = null;
      busyRef.current = false;
      setPeek(null);
    }
  }, [monthAnchor]);

  // PC の矢印ボタンとキー。CalendarPage の move が id を進める。複製(top)を画面に挿してから動かす
  useEffect(() => {
    if (!flipRequest || flipRequest.id === lastFlipId.current || busyRef.current) return;
    lastFlipId.current = flipRequest.id;
    busyRef.current = true;
    pendingSettleRef.current = { dir: flipRequest.dir, mode: readFlipMode() };
    setPeek({ dir: flipRequest.dir });
  }, [flipRequest]);

  // 複製(top)が実際に画面へ挿さった直後(DOM が更新された直後)に、予約していためくりを始める。
  // setPeek のすぐ後で requestAnimationFrame を使うと、複製がまだ挿さっていないことがある
  // biome-ignore lint/correctness/useExhaustiveDependencies: peek は値を読まないが、変わるたびに topRef が挿さったか見直したい
  useLayoutEffect(() => {
    const pending = pendingSettleRef.current;
    if (!pending || !topRef.current) return;
    pendingSettleRef.current = null;
    settle(pending.dir, pending.mode, true, 0);
  }, [peek, settle]);

  // スマホのスワイプ。縦のスクロールと取り合わないよう、横に動いたと決まるまでは何もしない
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (busyRef.current || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      gestureRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        dir: null,
        locked: false,
        width: el.clientWidth || 1,
        lastProgress: 0,
        lastVisualProgress: 0,
        mode: readFlipMode(),
        reducedMotion,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      const t = e.touches[0];
      if (!g || !t) return;
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      if (!g.locked) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          // 縦の動き。この操作からは手を引き、スクロールに譲る
          gestureRef.current = null;
          return;
        }
        g.locked = true;
        g.dir = dx < 0 ? 1 : -1;
        if (!g.reducedMotion) {
          busyRef.current = true;
          setPeek({ dir: g.dir });
        }
      }
      e.preventDefault();
      g.lastProgress = Math.min(1, Math.abs(dx) / g.width);
      if (g.reducedMotion) return;
      g.lastVisualProgress = Math.min(1, Math.abs(dx) / (g.width * VISUAL_RATIO));
      const top = topRef.current;
      if (top) applyProgress(top, shadeRef.current, g.mode, g.dir!, g.lastVisualProgress);
    };

    const onTouchEnd = () => {
      const g = gestureRef.current;
      gestureRef.current = null;
      if (!g || !g.locked || !g.dir) return;
      const committed = g.lastProgress >= COMMIT_RATIO;
      if (g.reducedMotion) {
        if (committed) onChangeMonth(g.dir);
        return;
      }
      settle(g.dir, g.mode, committed, g.lastVisualProgress);
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
  }, [onChangeMonth, reducedMotion, settle]);

  const base =
    peek?.dir === 1
      ? { days: nextGrid.days, month: nextAnchor.getMonth(), items: nextItems, leaving: undefined }
      : peek?.dir === -1
        ? { days: prevGrid.days, month: prevAnchor.getMonth(), items: prevItems, leaving: undefined }
        : { days, month, items, leaving };

  return (
    <section
      className="glass rounded-panel px-2 pt-2.5 pb-2 lg:flex lg:min-h-[calc(100dvh-106px)] lg:flex-col lg:p-3 lg:pb-2.5"
      aria-label="月の表"
    >
      <WeekdayHeader />
      <div
        ref={viewportRef}
        data-testid="month-flip-viewport"
        className={`relative lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${peek ? "overflow-hidden" : ""}`}
      >
        <MonthGridBody
          days={base.days}
          month={base.month}
          today={today}
          selected={selected}
          items={base.items}
          leaving={base.leaving}
          onPressDay={onPressDay}
          onOpenItem={onOpenItem}
        />
        {peek && (
          <div
            ref={topRef}
            aria-hidden="true"
            className="absolute inset-0 lg:flex lg:min-h-0 lg:flex-col"
            style={{ transformOrigin: "top", backfaceVisibility: "hidden" }}
          >
            <MonthGridBody
              days={days}
              month={month}
              today={today}
              selected={selected}
              items={items}
              leaving={leaving}
              onPressDay={onPressDay}
              onOpenItem={onOpenItem}
            />
            <div ref={shadeRef} className="pointer-events-none absolute inset-0 bg-black opacity-0" />
          </div>
        )}
      </div>
    </section>
  );
}
