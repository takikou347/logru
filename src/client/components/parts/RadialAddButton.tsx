/**
 * 下のタブの帯の中央の「+」。案 C の放射で、足している機能すべての記録の種類を弧に並べて出す。
 * 0091、issue #239
 *
 * 種類は `useQuickAdds`(足している拡張の actions を全部集めたもの)。どの画面から押しても同じ
 * 並びになる。0 個なら決定 0086 に従って出さない。1 個なら弧を出さず直接開く。6 個以上は弧を
 * 2 重にする(内側 4 つ、外側は残り)。動きを減らす設定では、弧に並んだ状態をすぐ出す。
 * 上には、家計簿のよく使う記録(`useFavoriteAdds`、F-326)があれば並べる。
 */
import type { ExtensionAction, FavoriteAdd } from "@extensions/client/types";
import { Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { angleOf, favoritesOffset, radialOffset, radialTiers } from "@/lib/radial-layout";
import { useLongPressLabel } from "@/lib/use-long-press";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

function RadialItem({
  item,
  radius,
  angle,
  delayMs,
  reducedMotion,
  entered,
  onPick,
}: {
  item: ExtensionAction;
  radius: number;
  angle: number;
  delayMs: number;
  reducedMotion: boolean;
  entered: boolean;
  onPick: (path: string) => void;
}) {
  const { pressed, consumeLongPress, handlers } = useLongPressLabel();
  const { x, y } = radialOffset(angle, radius);
  const Icon = item.icon;
  // 弧の中心(幅 0 の基準点)から、-50%,-50% で自分の大きさぶん引いてから (x, y) だけ動かす。
  // 閉じている間・飛ぶ前は基準点に重なって縮んでいる
  return (
    <span
      // 長押しの名前が隣の丸の後ろに隠れないよう、押している丸を前に出す
      className={cn("absolute top-0 left-0 transition-transform duration-slow ease-out", pressed && "z-10")}
      style={{
        transform: entered ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` : "translate(-50%, -50%) scale(0.4)",
        transitionDelay: reducedMotion ? "0ms" : `${delayMs}ms`,
        transitionDuration: reducedMotion ? "0ms" : undefined,
      }}
    >
      <button
        type="button"
        aria-label={item.label}
        className="glass grid size-12 place-items-center rounded-full text-ink"
        onClick={(e) => {
          if (consumeLongPress()) {
            e.preventDefault();
            return;
          }
          onPick(item.path);
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
          {item.label}
        </span>
      )}
    </span>
  );
}

/** 上に並ぶ、よく使う記録のカード。押すと 1 タップでその記録が入った状態のシートへ移る */
function FavoriteCard({ favorite, onPick }: { favorite: FavoriteAdd; onPick: (path: string) => void }) {
  const Icon = favorite.icon ?? Star;
  return (
    <button
      type="button"
      className="glass flex min-h-11 items-center gap-2 rounded-full py-1.5 pr-4 pl-2.5 text-[13px] font-bold whitespace-nowrap text-ink"
      onClick={() => onPick(favorite.path)}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {favorite.label}
    </button>
  );
}

export function RadialAddButton({
  items,
  favorites,
  showHint,
  pending,
}: {
  items: ExtensionAction[];
  favorites: FavoriteAdd[];
  showHint?: boolean;
  /** 足している機能をまだ読んでいる間。items は「いつも使える機能」だけで、本当の数より少ない */
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // 透明度を下げる設定では、幕をぼかさず暗くするだけにする。issue #239
  const reducedTransparency = useMediaQuery("(prefers-reduced-transparency: reduce)");
  const { pressed, consumeLongPress, handlers } = useLongPressLabel();
  const navigate = useNavigate();

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

  // 機能を読み終える前に押されたら、読み終えてから、そのときの種類の数に合わせて開く。
  // 読む前は「いつも使える機能」の 1 つだけに見えるので、そのまま予定のシートを開くと、ほかの種類を選べない
  const [queued, setQueued] = useState(false);
  const firstPath = items[0]?.path;
  const single = items.length === 1;
  useEffect(() => {
    if (!queued || pending) return;
    setQueued(false);
    if (single && firstPath) navigate(firstPath);
    else if (!single) setOpen(true);
  }, [queued, pending, single, firstPath, navigate]);

  // 決定 0086 と同じ扱い。足せるものが 1 つも無ければ出さない
  if (items.length === 0) return null;

  const pick = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  if (items.length === 1) {
    const only = items[0]!;
    return (
      <span className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5">
        <button
          type="button"
          aria-label="記録する"
          data-testid="global-add"
          className={cn("grid w-11 place-items-center rounded-full text-ink-2", showHint ? "h-9" : "h-11")}
          onClick={(e) => {
            if (consumeLongPress()) {
              e.preventDefault();
              return;
            }
            if (pending) {
              setQueued(true);
              return;
            }
            navigate(only.path);
          }}
          {...handlers}
        >
          <Plus className="size-6" aria-hidden="true" />
        </button>
        {showHint && (
          <small aria-hidden="true" data-testid="tab-hint" className="text-[10px] leading-none font-bold text-ink-2">
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

  const tiers = radialTiers(items);
  const favoritesBottom = favoritesOffset(tiers);

  return (
    <span className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={open ? "閉じる" : "記録する"}
        data-testid="global-add"
        aria-expanded={open}
        className={cn("grid w-11 place-items-center rounded-full text-ink-2", !open && showHint ? "h-9" : "h-11")}
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
        <small aria-hidden="true" data-testid="tab-hint" className="text-[10px] leading-none font-bold text-ink-2">
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
      {open &&
        createPortal(
          <>
            {/*
              後ろの幕。案 C の motion-radial-add と同じく、中身の丸が背景の文字と重ならないよう
              暗くしてぼかす。どのテーマ(紙・リキッドガラス)でも同じ形。動きを減らす・透明度を
              下げる設定では、ぼかさず暗くするだけにする。外を押すか下へ払うと閉じる。issue #239
              下のタブの帯(nav)は `.glass` の backdrop-filter を持ち、fixed の基準(containing
              block)になってしまうので、幕と弧は document.body へ portal で出す。画面全体を覆う
            */}
            <button
              type="button"
              aria-label="閉じる"
              data-testid="radial-scrim"
              className={cn(
                "fixed inset-0 z-40 bg-black/55 transition-opacity duration-slow",
                !reducedMotion && !reducedTransparency && "backdrop-blur-md backdrop-saturate-150",
              )}
              style={{
                opacity: entered ? 1 : 0,
                transitionDuration: reducedMotion ? "0ms" : undefined,
              }}
              onClick={() => setOpen(false)}
            />
            <span className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex justify-center">
              <span className="pointer-events-auto relative size-0 bottom-[calc(var(--float-bar-bottom)+var(--float-bar-height)/2)]">
                {tiers.flatMap((tier, ti) =>
                  tier.items.map((a, i) => (
                    <RadialItem
                      key={a.path}
                      item={a}
                      radius={tier.radius}
                      angle={angleOf(i, tier.items.length, tier.from, tier.to)}
                      delayMs={(ti * tier.items.length + i) * 45}
                      reducedMotion={reducedMotion}
                      entered={entered}
                      onPick={pick}
                    />
                  )),
                )}
                {favorites.length > 0 && (
                  <span
                    role="group"
                    aria-label="よく使う記録"
                    className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 transition-opacity duration-slow"
                    style={{
                      bottom: `${favoritesBottom}px`,
                      opacity: entered ? 1 : 0,
                      transitionDelay: reducedMotion ? "0ms" : "260ms",
                      transitionDuration: reducedMotion ? "0ms" : undefined,
                    }}
                  >
                    {favorites.map((f) => (
                      <FavoriteCard key={f.key} favorite={f} onPick={pick} />
                    ))}
                  </span>
                )}
              </span>
            </span>
          </>,
          document.body,
        )}
    </span>
  );
}
