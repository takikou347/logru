/**
 * アイコンだけの操作 1 つ。下のタブの帯、上の帯の「月」で使う。0091、issue #239
 *
 * 読み上げの名前は aria-label に残す。長押し(0.45 秒)で名前を吹き出しに出し、離しても操作はしない。
 * `showHint` の間は、名前をアイコンの下に常に出す(はじめの 3 回)。
 */
import type { LucideIcon } from "lucide-react";
import { Link, NavLink } from "react-router";
import { useLongPressLabel } from "@/lib/use-long-press";
import { cn } from "@/lib/utils";

export function TabIconButton({
  to,
  end,
  icon: Icon,
  label,
  showHint,
  active,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  showHint?: boolean;
  /**
   * 選ばれた色にするかを、NavLink の既定の判定(to から始まる道順すべて)の代わりに自分で決める。
   * 下のタブの「設定」(`/settings`)は、既定のままだと「機能」(`/settings/extensions`)の道順も
   * 含んでしまい、その画面で両方選ばれた色になる。GlobalBottomTabs が、いまの道順から
   * 1 つのタブだけを選ぶ形で計算して渡す。省くと今までどおり NavLink の既定の判定を使う。issue #243
   */
  active?: boolean;
}) {
  const { pressed, consumeLongPress, handlers } = useLongPressLabel();
  const linkClassName = cn(
    "grid w-11 place-items-center rounded-full text-ink-2 aria-[current=page]:text-ink",
    // 名前を下に出す間は、名前ごと帯の高さに収まるよう、押せる所の高さを詰める
    showHint ? "h-9" : "h-11",
  );
  return (
    <span className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5">
      {active === undefined ? (
        <NavLink
          to={to}
          end={end}
          aria-label={label}
          className={linkClassName}
          onClick={(e) => {
            if (consumeLongPress()) e.preventDefault();
          }}
          {...handlers}
        >
          <Icon className="size-5" aria-hidden="true" />
        </NavLink>
      ) : (
        <Link
          to={to}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={linkClassName}
          onClick={(e) => {
            if (consumeLongPress()) e.preventDefault();
          }}
          {...handlers}
        >
          <Icon className="size-5" aria-hidden="true" />
        </Link>
      )}
      {showHint && (
        <small
          aria-hidden="true"
          data-testid="tab-hint"
          className="text-[10px] leading-none font-bold whitespace-nowrap text-ink-2"
        >
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
