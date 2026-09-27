/**
 * 下のタブの帯の中央の「+」。案 C の放射で、足せる記録の種類を弧に並べて出す。0091、issue #239
 *
 * 種類は、いま開いている画面が `useAppFrame` に渡した addables(その画面の「+」が今まで
 * 出していたものと同じ出どころ)。0 個なら決定 0086 に従って出さない。1 個なら弧を出さず直接開く。
 * 6 個以上は弧を 2 重にする(内側 4 つ、外側は残り)。動きを減らす設定では、弧に並んだ状態を
 * すぐ出す。
 */
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Addable } from "@/components/parts/PrimaryAddButton";
import { angleOf, radialOffset, radialTiers } from "@/lib/radial-layout";
import { useLongPressLabel } from "@/lib/use-long-press";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

function RadialItem({
  addable,
  radius,
  angle,
  delayMs,
  reducedMotion,
  entered,
  onPick,
}: {
  addable: Addable;
  radius: number;
  angle: number;
  delayMs: number;
  reducedMotion: boolean;
  entered: boolean;
  onPick: (a: Addable) => void;
}) {
  const { pressed, consumeLongPress, handlers } = useLongPressLabel();
  const { x, y } = radialOffset(angle, radius);
  const Icon = addable.icon;
  // 弧の中心(幅 0 の基準点)から、-50%,-50% で自分の大きさぶん引いてから (x, y) だけ動かす。
  // 閉じている間・飛ぶ前は基準点に重なって縮んでいる
  return (
    <span
      className="absolute top-0 left-0 transition-transform duration-slow ease-out"
      style={{
        transform: entered ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` : "translate(-50%, -50%) scale(0.4)",
        transitionDelay: reducedMotion ? "0ms" : `${delayMs}ms`,
        transitionDuration: reducedMotion ? "0ms" : undefined,
      }}
    >
      <button
        type="button"
        aria-label={addable.label}
        className="glass grid size-12 place-items-center rounded-full text-ink"
        onClick={(e) => {
          if (consumeLongPress()) {
            e.preventDefault();
            return;
          }
          onPick(addable);
        }}
        {...handlers}
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
      {pressed && (
        <span
          aria-hidden="true"
          data-testid="long-press-label"
          className="glass absolute left-1/2 bottom-[calc(100%+6px)] z-10 -translate-x-1/2 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap"
        >
          {addable.label}
        </span>
      )}
    </span>
  );
}

export function RadialAddButton({ addables, showHint }: { addables: Addable[]; showHint?: boolean }) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { pressed, consumeLongPress, handlers } = useLongPressLabel();

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    // 動きを減らす設定では、弧に並んだ状態をすぐ出す。issue #239
    if (reducedMotion) {
      setEntered(true);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open, reducedMotion]);

  if (addables.length === 0) return null;

  const pick = (a: Addable) => {
    setOpen(false);
    a.onClick();
  };

  if (addables.length === 1) {
    const only = addables[0]!;
    return (
      <span className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5">
        <button
          type="button"
          aria-label="記録する"
          data-testid="global-add"
          className="grid size-11 place-items-center rounded-full text-ink-2"
          onClick={(e) => {
            if (consumeLongPress()) {
              e.preventDefault();
              return;
            }
            only.onClick();
          }}
          {...handlers}
        >
          <Plus className="size-6" aria-hidden="true" />
        </button>
        {showHint && (
          <small aria-hidden="true" data-testid="tab-hint" className="text-[10px] font-bold text-ink-2">
            記録する
          </small>
        )}
        {pressed && (
          <span
            aria-hidden="true"
            data-testid="long-press-label"
            className="glass absolute bottom-[calc(100%+6px)] z-10 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap"
          >
            記録する
          </span>
        )}
      </span>
    );
  }

  const tiers = radialTiers(addables);

  return (
    <span className="relative flex min-w-0 flex-1 flex-col items-center">
      <button
        type="button"
        aria-label={open ? "閉じる" : "記録する"}
        data-testid="global-add"
        aria-expanded={open}
        className="grid size-11 place-items-center rounded-full text-ink-2"
        onClick={(e) => {
          if (consumeLongPress()) {
            e.preventDefault();
            return;
          }
          setOpen((v) => !v);
        }}
        {...handlers}
      >
        <Plus
          className={cn("size-6 transition-transform duration-base ease-in-out", open && "rotate-45")}
          aria-hidden="true"
        />
      </button>
      {!open && showHint && (
        <small aria-hidden="true" data-testid="tab-hint" className="text-[10px] font-bold text-ink-2">
          記録する
        </small>
      )}
      {!open && pressed && (
        <span
          aria-hidden="true"
          data-testid="long-press-label"
          className="glass absolute bottom-[calc(100%+6px)] z-10 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap"
        >
          記録する
        </span>
      )}
      {open && (
        <>
          {/* 外を押すか下へ払うと閉じる。issue #239 */}
          <button
            type="button"
            aria-label="閉じる"
            className="fixed inset-0 z-30 bg-ink/25"
            onClick={() => setOpen(false)}
          />
          <span className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
            <span className="pointer-events-auto relative size-0 bottom-[calc(var(--float-bar-bottom)+var(--float-bar-height)/2)]">
              {tiers.flatMap((tier, ti) =>
                tier.items.map((a, i) => (
                  <RadialItem
                    key={a.key}
                    addable={a}
                    radius={tier.radius}
                    angle={angleOf(i, tier.items.length)}
                    delayMs={(ti * tier.items.length + i) * 45}
                    reducedMotion={reducedMotion}
                    entered={entered}
                    onPick={pick}
                  />
                )),
              )}
            </span>
          </span>
        </>
      )}
    </span>
  );
}
