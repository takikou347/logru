/**
 * アイコンだけの操作 1 つ。下のタブ(TabIconButton)と同じ仕組みを、ナビゲーションではない
 * ただのボタン(コピーする、外す、役割を変えるなど)でも使うための部品。新しい見た目・スマホの
 * グループの画面などで使う。決定 0067、issue #243
 *
 * 読み上げの名前は aria-label に残す。長押し(0.45 秒)で名前を吹き出しに出し、離しても操作はしない。
 */
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { useLongPressLabel } from "@/lib/use-long-press";
import { cn } from "@/lib/utils";

export function IconOnlyButton({
  icon: Icon,
  label,
  className,
  onClick,
  ...props
}: {
  icon: LucideIcon;
  label: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">) {
  const { pressed, consumeLongPress, handlers } = useLongPressLabel();
  return (
    <span className="relative inline-flex flex-none">
      <button
        type="button"
        aria-label={label}
        className={cn("grid size-11 flex-none place-items-center rounded-full text-ink-2", className)}
        onClick={(e) => {
          if (consumeLongPress()) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        {...handlers}
        {...props}
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </button>
      {pressed && (
        <span
          aria-hidden="true"
          data-testid="long-press-label"
          className="glass absolute bottom-[calc(100%+6px)] left-1/2 z-10 -translate-x-1/2 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap"
        >
          {label}
        </span>
      )}
    </span>
  );
}
