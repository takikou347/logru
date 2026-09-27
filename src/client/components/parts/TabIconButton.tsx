/**
 * アイコンだけの操作 1 つ。下のタブの帯、上の帯の「月」で使う。0091、issue #239
 *
 * 読み上げの名前は aria-label に残す。長押し(0.45 秒)で名前を吹き出しに出し、離しても操作はしない。
 * `showHint` の間は、名前をアイコンの下に常に出す(はじめの 3 回)。
 */
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import { useLongPressLabel } from "@/lib/use-long-press";
import { cn } from "@/lib/utils";

export function TabIconButton({
  to,
  end,
  icon: Icon,
  label,
  showHint,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  showHint?: boolean;
}) {
  const { pressed, consumeLongPress, handlers } = useLongPressLabel();
  return (
    <span className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <NavLink
        to={to}
        end={end}
        aria-label={label}
        className="grid size-11 place-items-center rounded-full text-ink-2 aria-[current=page]:text-ink"
        onClick={(e) => {
          if (consumeLongPress()) e.preventDefault();
        }}
        {...handlers}
      >
        <Icon className="size-5" aria-hidden="true" />
      </NavLink>
      {showHint && (
        <small aria-hidden="true" data-testid="tab-hint" className="truncate text-[10px] font-bold text-ink-2">
          {label}
        </small>
      )}
      {pressed && (
        <span
          aria-hidden="true"
          data-testid="long-press-label"
          className={cn(
            "glass absolute z-10 -translate-x-1/2 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap",
            "left-1/2 bottom-[calc(100%+6px)]",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
